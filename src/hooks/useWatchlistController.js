import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { toastiva } from 'toastiva';
import { useBottomSheet } from '../components/StackBottomSheet';
import {
  WatchlistCollectionsSheet,
  EditCollectionSheet,
} from '../components/WatchlistCollectionsSheet';
import {
  getUserWatchlistCollections,
  getStatusLabel,
  isInUserLibrary,
  itemInCollection,
  normalizeWatchlistCollections,
  normalizeWatchlistItem,
  watchlistEntryKey,
  HIGHLY_RECOMMEND_COLLECTION_ID,
} from '../lib/watchlistModel';
import { fetchOriginalLanguageCode } from '../lib/tmdb';
import {
  mergeResolvedSynopsisIntoWatchlistRow,
  applyCreateCollection,
  applyToggleCollection,
  applyRenameCollection,
  applyDeleteCollection,
  removeCollectionFromWatchlist,
  applySetStatus,
  upsertItem,
  recordRecentDestination,
  removeItem,
  markItemWatched,
} from '../lib/watchlistActions';
import {
  loadWatchlist,
  saveWatchlist,
  loadWatchlistCollections,
  saveWatchlistCollections,
  loadRecentDestinations,
  saveRecentDestinations,
} from '../lib/storage';

/**
 * Owns the user's library: the `watchlist` rows and `watchlistCollections`,
 * their derived selectors, every mutation handler, and the manage-collections
 * bottom sheet. The `*Ref` mirrors keep the long-lived sheet callbacks reading
 * the latest state without re-creating the sheet.
 *
 * @param {{ showToast: (message: string, options?: object) => void }} deps
 */
export function useWatchlistController({ showToast }) {
  const { show: showSheet, update: updateSheet, dismiss: dismissSheet } = useBottomSheet();

  const [watchlist, setWatchlist] = useState([]);
  const [watchlistCollections, setWatchlistCollections] = useState([]);
  const watchlistSheetIdRef = useRef(null);
  const watchlistRef = useRef([]);
  const watchlistCollectionsRef = useRef([]);
  // Most-recently-used collection ids — powers the save sheet's "Recent" row.
  const recentDestinationsRef = useRef([]);

  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  useEffect(() => {
    watchlistCollectionsRef.current = watchlistCollections;
  }, [watchlistCollections]);

  useEffect(() => {
    async function init() {
      const [saved, collections, recents] = await Promise.all([
        loadWatchlist(),
        loadWatchlistCollections(),
        loadRecentDestinations(),
      ]);
      setWatchlist(saved);
      setWatchlistCollections(collections);
      recentDestinationsRef.current = recents;
    }
    init();
  }, []);

  // ── One-time language backfill ─────────────────────────────────────────────
  // Titles saved before the app captured `originalLanguageCode` at save time have
  // no language data, so Discover's personalized Quick Picks would ignore them.
  // Once, after the list loads, fetch the code for any Highly Recommend row that
  // is missing it (undefined = never checked) and persist. Rate-limited and
  // capped so a large list doesn't hammer TMDB on launch. Rows that come back
  // with no language are stored as '' so they aren't retried every launch.
  const languageBackfillRanRef = useRef(false);
  useEffect(() => {
    if (languageBackfillRanRef.current) return;
    if (!watchlist.length) return; // wait until the saved list has loaded

    const pending = watchlist.filter(
      (row) =>
        row &&
        row.originalLanguageCode === undefined &&
        itemInCollection(row, HIGHLY_RECOMMEND_COLLECTION_ID),
    );

    languageBackfillRanRef.current = true;
    if (!pending.length) return;

    let cancelled = false;
    (async () => {
      const codeByKey = new Map();
      for (const row of pending.slice(0, 50)) {
        if (cancelled) return;
        const code = await fetchOriginalLanguageCode(row.mediaType, row.tmdbId);
        codeByKey.set(watchlistEntryKey(row), code || '');
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      if (cancelled || codeByKey.size === 0) return;

      setWatchlist((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          const key = watchlistEntryKey(row);
          if (codeByKey.has(key) && row.originalLanguageCode === undefined) {
            changed = true;
            return normalizeWatchlistItem({ ...row, originalLanguageCode: codeByKey.get(key) });
          }
          return row;
        });
        if (!changed) return prev;
        watchlistRef.current = next;
        saveWatchlist(next).catch(() => {});
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [watchlist]);

  const recordRecentDestinationId = useCallback((collectionId) => {
    if (!collectionId) return;
    const next = recordRecentDestination(recentDestinationsRef.current, collectionId);
    recentDestinationsRef.current = next;
    saveRecentDestinations(next).catch(() => {});
  }, []);

  const userWatchlistCollections = useMemo(
    () => getUserWatchlistCollections(watchlistCollections),
    [watchlistCollections],
  );

  const savedWatchlistKeys = useMemo(
    () => watchlist.filter(isInUserLibrary).map(watchlistEntryKey).filter(Boolean),
    [watchlist],
  );

  const syncWatchlistFromResolvedDetail = useCallback(async (fullResult) => {
    if (!fullResult?.tmdbId || !fullResult?.mediaType) return;
    setWatchlist((prev) => {
      const idx = prev.findIndex(
        (w) => w.tmdbId === fullResult.tmdbId && w.mediaType === fullResult.mediaType,
      );
      if (idx < 0) return prev;

      const prevRow = prev[idx];
      const merged = mergeResolvedSynopsisIntoWatchlistRow(prevRow, fullResult);

      const same =
        merged.synopsis === prevRow.synopsis &&
        (merged.omdbRatings?.plot || '') === (prevRow.omdbRatings?.plot || '') &&
        (merged.omdbRatings?.imdbRating || '') === (prevRow.omdbRatings?.imdbRating || '');

      if (same) return prev;

      const toPersist = [...prev];
      toPersist[idx] = merged;

      // Fire-and-forget save since we're inside the updater and can't await cleanly here
      saveWatchlist(toPersist).catch(() => {
        // In-memory list is updated; next explicit watchlist edit will retry storage.
      });

      return toPersist;
    });
  }, []);

  const handleRenameCollection = useCallback(
    async (collectionId, newName) => {
      const clean = (newName || '').trim();
      if (!clean || !collectionId) return;
      const previousCollections = watchlistCollectionsRef.current;
      const nextCollections = applyRenameCollection(previousCollections, collectionId, clean);
      if (nextCollections === previousCollections) return;

      setWatchlistCollections(nextCollections);
      watchlistCollectionsRef.current = nextCollections;
      try {
        await saveWatchlistCollections(nextCollections);
        showToast(`Renamed to ${clean}`, {
          title: 'Watchlist',
          icon: 'create-outline',
        });
      } catch {
        setWatchlistCollections(previousCollections);
        watchlistCollectionsRef.current = previousCollections;
        toastiva.error('Failed to rename list');
      }
    },
    [showToast],
  );

  const handleDeleteCollection = useCallback(
    async (collectionId) => {
      if (!collectionId) return;
      const previousCollections = watchlistCollectionsRef.current;
      const nextCollections = applyDeleteCollection(previousCollections, collectionId);
      const previousWatchlist = watchlistRef.current;
      const nextWatchlist = removeCollectionFromWatchlist(previousWatchlist, collectionId);

      setWatchlistCollections(nextCollections);
      watchlistCollectionsRef.current = nextCollections;
      setWatchlist(nextWatchlist);
      watchlistRef.current = nextWatchlist;

      try {
        await Promise.all([
          saveWatchlistCollections(nextCollections),
          saveWatchlist(nextWatchlist),
        ]);
        showToast('List deleted', {
          title: 'Watchlist',
          icon: 'trash-outline',
        });
      } catch {
        setWatchlistCollections(previousCollections);
        watchlistCollectionsRef.current = previousCollections;
        setWatchlist(previousWatchlist);
        watchlistRef.current = previousWatchlist;
        toastiva.error('Failed to delete list');
      }
    },
    [showToast],
  );

  const openWatchlistSheet = useCallback(
    (sheetItem) => {
      const itemKey = watchlistEntryKey(sheetItem);
      if (!itemKey) return;

      // Was this title already in the library when the sheet opened? Drives the
      // header eyebrow only; the live committed state is recomputed per render.
      const initialExisting = watchlistRef.current.find(
        (item) => watchlistEntryKey(item) === itemKey,
      );
      const openedCommitted = !!initialExisting && isInUserLibrary(initialExisting);

      const closeSheet = () => {
        if (watchlistSheetIdRef.current) {
          dismissSheet(watchlistSheetIdRef.current);
          watchlistSheetIdRef.current = null;
        }
      };

      // Insert-or-replace the row. This is the single commit path: in save mode
      // the first destination the user taps creates the row here; nothing is
      // persisted until then, so dismissing without a pick saves nothing.
      const persistItem = async (nextItem, successMessage) => {
        const previous = watchlistRef.current;
        const { item: normalized, watchlist: next } = upsertItem(previous, nextItem);
        if (!normalized) return null;
        setWatchlist(next);
        watchlistRef.current = next;
        try {
          await saveWatchlist(next);
          if (successMessage) {
            toastiva.success(successMessage);
            // A committed save earns a firmer confirmation than the selection
            // tick the bookmark already fired; removals/status flips do not.
            if (/^Saved/.test(successMessage)) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }
          }
          return normalized;
        } catch {
          setWatchlist(previous);
          watchlistRef.current = previous;
          toastiva.error('Failed to update Library');
          return null;
        }
      };

      const collectionName = (collectionId, currentCollections) =>
        currentCollections.find((collection) => collection.id === collectionId)?.name || 'list';

      const renderContent = (currentItem, currentCollections = userWatchlistCollections) => {
        const liveExisting = watchlistRef.current.find(
          (item) => watchlistEntryKey(item) === itemKey,
        );
        const committed = !!liveExisting && isInUserLibrary(liveExisting);

        return (
          <WatchlistCollectionsSheet
            item={currentItem}
            collections={currentCollections}
            committed={committed}
            recentCollectionIds={recentDestinationsRef.current}
            onCreateCollection={async (name) => {
              const collection = {
                id: `custom_${Date.now().toString(36)}`,
                name,
                icon: 'albums-outline',
                source: 'custom',
                createdAt: new Date().toISOString(),
              };
              const previousCollections = watchlistCollectionsRef.current;
              const nextCollections = normalizeWatchlistCollections([
                ...previousCollections,
                collection,
              ]);
              setWatchlistCollections(nextCollections);
              watchlistCollectionsRef.current = nextCollections;
              try {
                await saveWatchlistCollections(nextCollections);
              } catch {
                setWatchlistCollections(previousCollections);
                watchlistCollectionsRef.current = previousCollections;
                toastiva.error('Failed to create collection');
                return;
              }
              const nextItem = applyCreateCollection(currentItem, collection);
              const saved = await persistItem(nextItem, `Saved to ${name}`);
              recordRecentDestinationId(collection.id);
              updateSheet(
                watchlistSheetIdRef.current,
                renderContent(saved || nextItem, getUserWatchlistCollections(nextCollections)),
              );
            }}
            onToggleCollection={async (collectionId) => {
              const selected = currentItem.collectionIds?.includes(collectionId);
              const nextItem = applyToggleCollection(currentItem, collectionId);
              const name = collectionName(collectionId, currentCollections);
              const saved = await persistItem(
                nextItem,
                selected ? `Removed from ${name}` : `Saved to ${name}`,
              );
              if (!selected) recordRecentDestinationId(collectionId);
              updateSheet(
                watchlistSheetIdRef.current,
                renderContent(saved || nextItem, currentCollections),
              );
            }}
            onEditCollection={(collection) => {
              if (!collection || collection.immutable) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const editSheetId = showSheet(
                (sheetId) => (
                  <EditCollectionSheet
                    collection={collection}
                    onSave={async (newName) => {
                      await handleRenameCollection(collection.id, newName);
                      dismissSheet(sheetId);
                      if (watchlistSheetIdRef.current) {
                        const nextCols = getUserWatchlistCollections(
                          watchlistCollectionsRef.current,
                        );
                        const liveExisting = watchlistRef.current.find(
                          (item) => watchlistEntryKey(item) === itemKey,
                        );
                        updateSheet(
                          watchlistSheetIdRef.current,
                          renderContent(liveExisting || currentItem, nextCols),
                        );
                      }
                    }}
                    onDelete={async () => {
                      await handleDeleteCollection(collection.id);
                      dismissSheet(sheetId);
                      if (watchlistSheetIdRef.current) {
                        const nextCols = getUserWatchlistCollections(
                          watchlistCollectionsRef.current,
                        );
                        const liveExisting = watchlistRef.current.find(
                          (item) => watchlistEntryKey(item) === itemKey,
                        );
                        updateSheet(
                          watchlistSheetIdRef.current,
                          renderContent(liveExisting || currentItem, nextCols),
                        );
                      }
                    }}
                    onClose={() => dismissSheet(sheetId)}
                  />
                ),
                {
                  eyebrow: 'Watchlist',
                  title: 'Edit List',
                  subtitle: collection.name,
                  size: 'small',
                  scrollable: false,
                },
              );
            }}
            onSetStatus={async (status) => {
              const wasCommitted = committed;
              const nextItem = applySetStatus(currentItem, status);
              const saved = await persistItem(
                nextItem,
                wasCommitted ? `Status: ${getStatusLabel(status)}` : 'Saved to Library',
              );
              updateSheet(
                watchlistSheetIdRef.current,
                renderContent(saved || nextItem, currentCollections),
              );
            }}
            onSave={async () => {
              const saved = await persistItem(currentItem, 'Saved to Library');
              if (saved) closeSheet();
            }}
            onRemove={async () => {
              const previous = watchlistRef.current;
              const next = previous.filter((item) => watchlistEntryKey(item) !== itemKey);
              setWatchlist(next);
              watchlistRef.current = next;
              try {
                await saveWatchlist(next);
                toastiva.success('Removed from Library');
                closeSheet();
              } catch {
                setWatchlist(previous);
                watchlistRef.current = previous;
                toastiva.error('Failed to update Library');
              }
            }}
            onClose={closeSheet}
          />
        );
      };

      const id = showSheet(renderContent(sheetItem), {
        eyebrow: openedCommitted ? 'Manage' : 'Save to',
        title: sheetItem?.title || 'Library',
        size: 'large',
        scrollable: false,
        onClose: () => {
          if (watchlistSheetIdRef.current === id) watchlistSheetIdRef.current = null;
        },
      });
      watchlistSheetIdRef.current = id;
    },
    [
      userWatchlistCollections,
      dismissSheet,
      showSheet,
      updateSheet,
      recordRecentDestinationId,
      handleRenameCollection,
      handleDeleteCollection,
    ],
  );

  // Bookmark tap: always open the destination picker — never an instant save.
  // Already-in-library → manage; otherwise a draft the sheet commits on pick.
  const handleToggleWatchlist = useCallback(
    (result) => {
      const key = watchlistEntryKey(result);
      const existing = key
        ? watchlist.find((item) => watchlistEntryKey(item) === key)
        : null;

      if (existing && isInUserLibrary(existing)) {
        openWatchlistSheet(existing);
        return;
      }

      // Build a draft — NOT persisted. Preserve a dropped row's prior lists.
      const draft = normalizeWatchlistItem({
        ...(existing || {}),
        ...result,
        status: 'saved',
        collectionIds: existing?.collectionIds || [],
      });
      if (!draft) return;
      openWatchlistSheet(draft);
    },
    [watchlist, openWatchlistSheet],
  );

  const handleEnrichWatchlistItem = useCallback(async (tmdbId, mediaType, fields) => {
    const key = `${mediaType}:${tmdbId}`;
    setWatchlist((prev) => {
      const idx = prev.findIndex((w) => watchlistEntryKey(w) === key);
      if (idx < 0) return prev;

      const prevRow = prev[idx];
      const originalLanguage = fields.originalLanguage || [];
      const countryOfOrigin = fields.countryOfOrigin || [];
      const basedOn = fields.basedOn || [];
      const soundtracks = fields.soundtracks || [];
      const awards = fields.awards || [];
      const wikidataEnriched = fields.wikidataEnriched === true;

      const languagesSame =
        JSON.stringify(prevRow.originalLanguage || []) === JSON.stringify(originalLanguage);
      const countriesSame =
        JSON.stringify(prevRow.countryOfOrigin || []) === JSON.stringify(countryOfOrigin);
      const basedOnSame = JSON.stringify(prevRow.basedOn || []) === JSON.stringify(basedOn);
      const soundtracksSame =
        JSON.stringify(prevRow.soundtracks || []) === JSON.stringify(soundtracks);
      const awardsSame = JSON.stringify(prevRow.awards || []) === JSON.stringify(awards);
      const enrichedSame = prevRow.wikidataEnriched === wikidataEnriched;

      if (
        languagesSame &&
        countriesSame &&
        basedOnSame &&
        soundtracksSame &&
        awardsSame &&
        enrichedSame
      )
        return prev;

      const merged = normalizeWatchlistItem({
        ...prevRow,
        originalLanguage,
        countryOfOrigin,
        basedOn,
        soundtracks,
        awards,
        wikidataEnriched,
      });
      if (!merged) return prev;

      const toPersist = [...prev];
      toPersist[idx] = merged;

      watchlistRef.current = toPersist;

      saveWatchlist(toPersist).catch(() => {});
      return toPersist;
    });
  }, []);

  const persistWatchlistChange = useCallback(
    async (nextWatchlist, rollbackWatchlist, successMessage, successIcon) => {
      setWatchlist(nextWatchlist);
      watchlistRef.current = nextWatchlist;
      try {
        await saveWatchlist(nextWatchlist);
        showToast(successMessage, {
          title: 'Watchlist',
          icon: successIcon,
        });
      } catch {
        setWatchlist(rollbackWatchlist);
        watchlistRef.current = rollbackWatchlist;
        toastiva.error('Failed to update Watchlist');
      }
    },
    [showToast],
  );

  const handleRemoveWatchlistItem = useCallback(
    async (target) => {
      const nextWatchlist = removeItem(watchlist, watchlistEntryKey(target));
      if (nextWatchlist === watchlist) return;
      await persistWatchlistChange(
        nextWatchlist,
        watchlist,
        'Removed from Watchlist.',
        'trash-outline',
      );
    },
    [watchlist, persistWatchlistChange],
  );

  const handleMarkWatched = useCallback(
    async (target) => {
      const nextWatchlist = markItemWatched(watchlist, watchlistEntryKey(target));
      if (nextWatchlist === watchlist) return;
      await persistWatchlistChange(
        nextWatchlist,
        watchlist,
        'Marked as watched.',
        'checkmark-circle-outline',
      );
    },
    [watchlist, persistWatchlistChange],
  );

  const persistCollectionsChange = useCallback(async (nextCollections, rollbackCollections) => {
    setWatchlistCollections(nextCollections);
    watchlistCollectionsRef.current = nextCollections;
    try {
      await saveWatchlistCollections(nextCollections);
    } catch {
      setWatchlistCollections(rollbackCollections);
      watchlistCollectionsRef.current = rollbackCollections;
      toastiva.error('Failed to update collections');
    }
  }, []);

  return {
    watchlist,
    watchlistCollections,
    userWatchlistCollections,
    savedWatchlistKeys,
    syncWatchlistFromResolvedDetail,
    openWatchlistSheet,
    handleToggleWatchlist,
    handleEnrichWatchlistItem,
    handleRemoveWatchlistItem,
    handleMarkWatched,
    handleRenameCollection,
    handleDeleteCollection,
    persistWatchlistChange,
    persistCollectionsChange,
  };
}
