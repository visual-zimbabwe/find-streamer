import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toastiva } from 'toastiva';
import { useBottomSheet } from '../components/StackBottomSheet';
import { WatchlistCollectionsSheet } from '../components/WatchlistCollectionsSheet';
import {
  getUserWatchlistCollections,
  getStatusLabel,
  isInUserLibrary,
  normalizeWatchlistCollections,
  normalizeWatchlistItem,
  watchlistEntryKey,
} from '../lib/watchlistModel';
import {
  mergeResolvedSynopsisIntoWatchlistRow,
  applyCreateCollection,
  applyToggleCollection,
  applySetStatus,
  addOrRestoreItem,
  removeItem,
  markItemWatched,
} from '../lib/watchlistActions';
import {
  loadWatchlist,
  saveWatchlist,
  loadWatchlistCollections,
  saveWatchlistCollections,
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

  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  useEffect(() => {
    watchlistCollectionsRef.current = watchlistCollections;
  }, [watchlistCollections]);

  useEffect(() => {
    async function init() {
      const [saved, collections] = await Promise.all([loadWatchlist(), loadWatchlistCollections()]);
      setWatchlist(saved);
      setWatchlistCollections(collections);
    }
    init();
  }, []);

  const userWatchlistCollections = useMemo(
    () => getUserWatchlistCollections(watchlistCollections),
    [watchlistCollections],
  );

  const savedWatchlistKeys = useMemo(
    () => watchlist.filter(isInUserLibrary).map(watchlistEntryKey).filter(Boolean),
    [watchlist],
  );

  const hasHighlyRecommendedSeeds = useMemo(
    () =>
      watchlist.some(
        (item) => item.collectionIds?.includes('highly_recommend') && isInUserLibrary(item),
      ),
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

  const openWatchlistSheet = useCallback(
    (sheetItem) => {
      const itemKey = watchlistEntryKey(sheetItem);
      if (!itemKey) return;

      const closeSheet = () => {
        if (watchlistSheetIdRef.current) {
          dismissSheet(watchlistSheetIdRef.current);
          watchlistSheetIdRef.current = null;
        }
      };

      const updateOne = async (updater, successMessage) => {
        const previous = watchlistRef.current;
        const next = previous.map((item) =>
          watchlistEntryKey(item) === itemKey ? normalizeWatchlistItem(updater(item)) : item,
        );
        if (!next.some((item) => watchlistEntryKey(item) === itemKey)) return;
        setWatchlist(next);
        watchlistRef.current = next;
        try {
          await saveWatchlist(next);
          if (successMessage) toastiva.success(successMessage);
        } catch {
          setWatchlist(previous);
          watchlistRef.current = previous;
          toastiva.error('Failed to update Watchlist');
        }
      };

      const renderContent = (currentItem, currentCollections = userWatchlistCollections) => (
        <WatchlistCollectionsSheet
          item={currentItem}
          collections={currentCollections}
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
            await updateOne(
              (item) => applyCreateCollection(item, collection),
              'Collection created',
            );
            updateSheet(
              watchlistSheetIdRef.current,
              renderContent(
                applyCreateCollection(currentItem, collection),
                getUserWatchlistCollections(nextCollections),
              ),
            );
          }}
          onToggleCollection={async (collectionId) => {
            const selected = currentItem.collectionIds?.includes(collectionId);
            const nextItem = applyToggleCollection(currentItem, collectionId);
            await updateOne(
              () => nextItem,
              selected ? 'Removed from collection' : 'Added to collection',
            );
            updateSheet(watchlistSheetIdRef.current, renderContent(nextItem));
          }}
          onSetStatus={async (status) => {
            const nextItem = applySetStatus(currentItem, status);
            await updateOne(() => nextItem, `Status set to ${getStatusLabel(status)}`);
            updateSheet(watchlistSheetIdRef.current, renderContent(nextItem));
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
              toastiva.error('Failed to update Watchlist');
            }
          }}
          onClose={closeSheet}
        />
      );

      const id = showSheet(renderContent(sheetItem), {
        title: 'Manage Collections',
        size: 'large',
        scrollable: true,
        onClose: () => {
          if (watchlistSheetIdRef.current === id) watchlistSheetIdRef.current = null;
        },
      });
      watchlistSheetIdRef.current = id;
    },
    [userWatchlistCollections, dismissSheet, showSheet, updateSheet],
  );

  const handleToggleWatchlist = useCallback(
    async (result) => {
      const { action, item, watchlist: nextWatchlist } = addOrRestoreItem(watchlist, result);

      if (action === 'exists') {
        openWatchlistSheet(item);
        return;
      }

      setWatchlist(nextWatchlist);
      watchlistRef.current = nextWatchlist;
      try {
        await saveWatchlist(nextWatchlist);
        toastiva.success('Added to Library');
        openWatchlistSheet(item);
      } catch {
        setWatchlist(watchlist);
        watchlistRef.current = watchlist;
        toastiva.error('Failed to save to Watchlist');
      }
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
    hasHighlyRecommendedSeeds,
    syncWatchlistFromResolvedDetail,
    openWatchlistSheet,
    handleToggleWatchlist,
    handleEnrichWatchlistItem,
    handleRemoveWatchlistItem,
    handleMarkWatched,
    persistWatchlistChange,
    persistCollectionsChange,
  };
}
