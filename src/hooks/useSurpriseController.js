import { useState, useCallback } from 'react';
import { Keyboard } from 'react-native';
import { resolveMatch, fetchSurpriseRecommendation, fetchSurpriseByGenre } from '../lib/tmdb';
import { isInUserLibrary } from '../lib/watchlistModel';

/**
 * Owns the "Surprise Me" flow: its own loading flag (independent of the main
 * detail spinner) and the genre-picker visibility. Seeds the recommendation
 * from the user's highly-recommended library entries.
 *
 * @param {{
 *   watchlist: object[],
 *   clearTypeResults: () => void,
 *   rememberViewed: (result: object) => Promise<void>,
 *   syncWatchlistFromResolvedDetail: (fullResult: object) => Promise<void>,
 *   openDetail: (fullResult: object, navigation: object) => void,
 *   handleRequestError: (err: unknown, fallbackMessage: string, options?: object) => void,
 *   setOfflineBanner: (value: object | null) => void,
 * }} deps
 */
export function useSurpriseController({
  watchlist,
  clearTypeResults,
  rememberViewed,
  syncWatchlistFromResolvedDetail,
  openDetail,
  handleRequestError,
  setOfflineBanner,
}) {
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [surprisePickerVisible, setSurprisePickerVisible] = useState(false);

  const handleSurpriseMe = useCallback(
    async (navigation) => {
      const seeds = watchlist.filter(
        (item) => item.collectionIds?.includes('highly_recommend') && isInUserLibrary(item),
      );
      setSurpriseLoading(true);
      clearTypeResults();
      Keyboard.dismiss();
      try {
        const pick = await fetchSurpriseRecommendation(seeds);
        const fullResult = await resolveMatch(pick.title, pick);
        await rememberViewed(fullResult);
        await syncWatchlistFromResolvedDetail(fullResult);
        openDetail(fullResult, navigation);
        setOfflineBanner(null);
      } catch (err) {
        handleRequestError(err, 'Unable to find a surprise pick right now.');
      } finally {
        setSurpriseLoading(false);
      }
    },
    [
      watchlist,
      clearTypeResults,
      openDetail,
      rememberViewed,
      syncWatchlistFromResolvedDetail,
      handleRequestError,
      setOfflineBanner,
    ],
  );

  const handleSurpriseByGenre = useCallback(
    async (genreId, mediaType, navigation) => {
      setSurprisePickerVisible(false);
      setSurpriseLoading(true);
      clearTypeResults();
      Keyboard.dismiss();
      try {
        const pick = await fetchSurpriseByGenre(genreId, mediaType);
        const fullResult = await resolveMatch(pick.title, pick);
        await rememberViewed(fullResult);
        await syncWatchlistFromResolvedDetail(fullResult);
        openDetail(fullResult, navigation);
        setOfflineBanner(null);
      } catch (err) {
        handleRequestError(err, 'No surprise picks found for that genre.');
      } finally {
        setSurpriseLoading(false);
      }
    },
    [
      clearTypeResults,
      openDetail,
      rememberViewed,
      syncWatchlistFromResolvedDetail,
      handleRequestError,
      setOfflineBanner,
    ],
  );

  return {
    surpriseLoading,
    surprisePickerVisible,
    setSurprisePickerVisible,
    handleSurpriseMe,
    handleSurpriseByGenre,
  };
}
