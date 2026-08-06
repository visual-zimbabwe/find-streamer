import { useState, useEffect, useCallback, useRef } from 'react';
import { resolveMatch } from '../lib/tmdb';
import { fetchTvmazeNextEpisode } from '../lib/tvmaze';
import { createAppError } from '../lib/errors';
import { pushOnCurrentTab } from '../navigation/navigationRef';
import { loadRecentViewed, saveRecentViewed } from '../lib/storage';
import {
  DETAIL_RESOLVE_DEADLINE_MS,
  OPEN_DETAIL_DEBOUNCE_MS,
  seedDetailResult,
} from '../lib/detailResult';

/**
 * Owns the Detail screens: one entry per *push*, the recently-viewed history,
 * and the "open a title" flow used by search, discover, rails and filmography.
 *
 * Two things changed here after the opening-a-title critique:
 *
 * 1. There is no longer a single `selectedResult`. Every `DetailScreenRoute`
 *    read the same slot, so pushing a second Detail (tapping a card in More Like
 *    This) overwrote the one underneath: backing out of the second screen landed
 *    on the first one rendering the second one's hero, ratings, synopsis,
 *    availability and rails, with Share and the bookmark both retargeted. Each
 *    push now gets its own id and its own entry, released when the screen
 *    unmounts.
 *
 * 2. The screen is pushed on the tap, not after `resolveMatch` returns. The
 *    resolve is five serial network legs — 648ms of unmarked dead time measured
 *    on device — during which the app sat on the list with no spinner, no
 *    disabled card and no transition. The push now happens immediately against
 *    a seed built from the tapped row, and the payload merges in when it lands.
 *
 * @param {{
 *   syncWatchlistFromResolvedDetail: (fullResult: object) => Promise<void>,
 *   handleRequestError: (err: unknown, fallbackMessage: string, options?: object) => void,
 *   setOfflineBanner: (value: object | null) => void,
 * }} deps
 */
export function useDetailController({
  syncWatchlistFromResolvedDetail,
  handleRequestError,
  setOfflineBanner,
}) {
  /** `{ [detailId]: { result, loading, error } }` — one entry per pushed screen. */
  const [details, setDetails] = useState({});
  const [recentViewed, setRecentViewed] = useState([]);
  const detailIdRef = useRef(0);
  /** Timestamp of the last accepted open, for the double-push guard. */
  const lastOpenAtRef = useRef(0);
  /** `{ [detailId]: { query, match, fallbackMessage } }` — what a retry needs. */
  const pendingRef = useRef({});

  useEffect(() => {
    loadRecentViewed().then(setRecentViewed);
  }, []);

  const nextDetailId = useCallback(() => {
    detailIdRef.current += 1;
    return `detail-${detailIdRef.current}`;
  }, []);

  /**
   * Two taps dispatched in the same frame used to push two screens. Nothing
   * downstream can undo that once both pushes land, so it is refused here.
   */
  const claimOpen = useCallback(() => {
    const now = Date.now();
    if (now - lastOpenAtRef.current < OPEN_DETAIL_DEBOUNCE_MS) return false;
    lastOpenAtRef.current = now;
    return true;
  }, []);

  const pushDetail = useCallback((detailId, navigation) => {
    if (navigation) {
      navigation.push('Detail', { detailId });
    } else {
      pushOnCurrentTab('Detail', { detailId });
    }
  }, []);

  /** Drop a screen's entry once it unmounts, so the map can't grow unbounded. */
  const releaseDetail = useCallback((detailId) => {
    delete pendingRef.current[detailId];
    setDetails((prev) => {
      if (!(detailId in prev)) return prev;
      const next = { ...prev };
      delete next[detailId];
      return next;
    });
  }, []);

  const rememberViewed = useCallback(
    async (result) => {
      if (!result?.tmdbId || !result?.title || !result?.mediaType) return;
      const nextViewed = [
        result,
        ...recentViewed.filter(
          (item) => !(item.tmdbId === result.tmdbId && item.mediaType === result.mediaType),
        ),
      ].slice(0, 8);
      setRecentViewed(nextViewed);
      await saveRecentViewed(nextViewed);
    },
    [recentViewed],
  );

  /**
   * Recent is the only history Search shows now, so it has to be editable —
   * previously nothing in the app could remove a history entry at all, and the
   * only way to evict one was to push eight newer ones in front of it.
   */
  const removeRecentViewed = useCallback(
    async (item) => {
      if (!item?.tmdbId || !item?.mediaType) return;
      const nextViewed = recentViewed.filter(
        (entry) => !(entry.tmdbId === item.tmdbId && entry.mediaType === item.mediaType),
      );
      setRecentViewed(nextViewed);
      await saveRecentViewed(nextViewed);
    },
    [recentViewed],
  );

  const clearRecentViewed = useCallback(async () => {
    setRecentViewed([]);
    await saveRecentViewed([]);
  }, []);

  /**
   * The five legs of `resolveMatch`, bounded. Each leg allows a 12s timeout and
   * two retries; without a deadline a bad connection can hold a half-built
   * screen for minutes rather than failing into a retry the user can act on.
   */
  const resolveWithDeadline = useCallback(async (queryTitle, match) => {
    let timer;
    try {
      return await Promise.race([
        resolveMatch(queryTitle, match),
        new Promise((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(createAppError('Please check your connection and try again.', 'TIMEOUT', {})),
            DETAIL_RESOLVE_DEADLINE_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  /**
   * View-only enrichment: TMDb's `next_episode_to_air` is often null and never
   * carries an air time, so for a resolved TV title we ask TVmaze (free, keyed
   * off the IMDb id we already have) for the next scheduled episode and merge it
   * into the live result. Fire-and-forget and idempotent — it never blocks the
   * open, is never written to the watchlist store, and no-ops if the screen was
   * popped or the field is already set.
   */
  const enrichNextEpisode = useCallback(async (detailId, imdbId) => {
    const nextEpisode = await fetchTvmazeNextEpisode(imdbId);
    if (!nextEpisode) return;
    setDetails((prev) => {
      const entry = prev[detailId];
      if (!entry?.result || entry.result.nextEpisode) return prev;
      return { ...prev, [detailId]: { ...entry, result: { ...entry.result, nextEpisode } } };
    });
  }, []);

  const runResolve = useCallback(
    async (detailId, queryTitle, match, fallbackMessage) => {
      try {
        const fullResult = await resolveWithDeadline(queryTitle, match);
        // Liveness is read off the ref, not off a flag set inside the state
        // updater: `setDetails` here runs outside an event handler, so React
        // schedules the updater rather than running it inline and the flag
        // would always still be false by the time we looked at it.
        const stillMounted = Boolean(pendingRef.current[detailId]);
        setDetails((prev) => {
          if (!prev[detailId]) return prev;
          return { ...prev, [detailId]: { result: fullResult, loading: false, error: null } };
        });
        // The screen was popped mid-flight — don't touch history or the
        // watchlist for a title the user has already walked away from.
        if (!stillMounted) return;
        if (fullResult?.mediaType === 'tv' && fullResult?.imdbId) {
          enrichNextEpisode(detailId, fullResult.imdbId);
        }
        await rememberViewed(fullResult);
        await syncWatchlistFromResolvedDetail(fullResult);
        setOfflineBanner(null);
      } catch (err) {
        setDetails((prev) => {
          if (!prev[detailId]) return prev;
          return { ...prev, [detailId]: { ...prev[detailId], loading: false, error: err } };
        });
        // The Detail screen carries its own retry now, so the toast is a
        // notification rather than the only surface — it names the title, which
        // a bare "check your connection" never did.
        handleRequestError(err, fallbackMessage, { titleName: match?.title });
      }
    },
    [
      resolveWithDeadline,
      enrichNextEpisode,
      rememberViewed,
      syncWatchlistFromResolvedDetail,
      handleRequestError,
      setOfflineBanner,
    ],
  );

  /**
   * Push a Detail screen for a picked match and resolve into it. Returns once
   * the resolve settles so callers can still await the full open.
   */
  const openResolvedDetail = useCallback(
    async (queryTitle, match, navigation, fallbackMessage = 'Unable to fetch details.') => {
      if (!claimOpen()) return;
      const detailId = nextDetailId();
      pendingRef.current[detailId] = { queryTitle, match, fallbackMessage };
      setDetails((prev) => ({
        ...prev,
        [detailId]: { result: seedDetailResult(queryTitle, match), loading: true, error: null },
      }));
      pushDetail(detailId, navigation);
      await runResolve(detailId, queryTitle, match, fallbackMessage);
    },
    [claimOpen, nextDetailId, pushDetail, runResolve],
  );

  /** In-page retry for a screen whose resolve failed. */
  const retryDetail = useCallback(
    (detailId) => {
      const pending = pendingRef.current[detailId];
      if (!pending) return;
      setDetails((prev) => {
        if (!prev[detailId]) return prev;
        return { ...prev, [detailId]: { ...prev[detailId], loading: true, error: null } };
      });
      runResolve(detailId, pending.queryTitle, pending.match, pending.fallbackMessage);
    },
    [runResolve],
  );

  return {
    details,
    recentViewed,
    removeRecentViewed,
    clearRecentViewed,
    releaseDetail,
    retryDetail,
    rememberViewed,
    openResolvedDetail,
  };
}
