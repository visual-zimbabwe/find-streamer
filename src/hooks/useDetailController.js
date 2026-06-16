import { useState, useEffect, useCallback } from 'react';
import { resolveMatch } from '../lib/tmdb';
import { pushOnCurrentTab } from '../navigation/navigationRef';
import { loadRecentViewed, saveRecentViewed } from '../lib/storage';

/**
 * Owns the detail view: the `selectedResult`, the recently-viewed history, and
 * the shared "resolve a match then push the Detail screen" flow used by search,
 * discover, and filmography. The `loading` flag here is the cross-cutting
 * spinner for resolving a title to open it.
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
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [recentViewed, setRecentViewed] = useState([]);

  useEffect(() => {
    loadRecentViewed().then(setRecentViewed);
  }, []);

  const openDetail = useCallback((fullResult, navigation) => {
    setSelectedResult(fullResult);
    if (navigation) {
      navigation.push('Detail');
    } else {
      pushOnCurrentTab('Detail');
    }
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
   * Resolve a picked match/result to a full detail object, record it as viewed,
   * sync it back into the watchlist, and push the Detail screen. Toggles the
   * shared `loading` spinner and reports failures through `handleRequestError`.
   */
  const openResolvedDetail = useCallback(
    async (queryTitle, match, navigation, fallbackMessage = 'Unable to fetch details.') => {
      setLoading(true);
      try {
        const fullResult = await resolveMatch(queryTitle, match);
        await rememberViewed(fullResult);
        await syncWatchlistFromResolvedDetail(fullResult);
        openDetail(fullResult, navigation);
        setOfflineBanner(null);
      } catch (err) {
        handleRequestError(err, fallbackMessage);
      } finally {
        setLoading(false);
      }
    },
    [
      rememberViewed,
      syncWatchlistFromResolvedDetail,
      openDetail,
      handleRequestError,
      setOfflineBanner,
    ],
  );

  return {
    loading,
    setLoading,
    selectedResult,
    setSelectedResult,
    recentViewed,
    openDetail,
    rememberViewed,
    openResolvedDetail,
  };
}
