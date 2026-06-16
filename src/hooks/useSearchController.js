import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { toastiva } from 'toastiva';
import { searchTitleCandidates, searchLiveCandidates } from '../lib/tmdb';
import { classifyAppError } from '../lib/errors';
import { navigateToTabRoot } from '../navigation/navigationRef';
import { loadRecentSearches, saveRecentSearches } from '../lib/storage';

/**
 * Owns text search: the query, the committed `results` + `filter`, the
 * search-as-you-type suggestions (`typeResults`/`typeLoading`), and the recent
 * search history. Detail resolution and the shared spinner live in the detail
 * controller and are injected here.
 *
 * @param {{
 *   setLoading: (value: boolean) => void,
 *   openResolvedDetail: (queryTitle: string, match: object, navigation: object, fallbackMessage?: string) => Promise<void>,
 *   handlePersonPress: (personId: any, personName: string, role: any, navigation: object) => void,
 *   handleRequestError: (err: unknown, fallbackMessage: string, options?: object) => void,
 *   setError: (value: string | null) => void,
 *   setErrorInfo: (value: object | null) => void,
 *   setOfflineBanner: (value: object | null) => void,
 * }} deps
 */
export function useSearchController({
  setLoading,
  openResolvedDetail,
  handlePersonPress,
  handleRequestError,
  setError,
  setErrorInfo,
  setOfflineBanner,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [filter, setFilter] = useState(null); // 'movie' | 'tv' | null
  const [recentSearches, setRecentSearches] = useState([]);
  const [typeResults, setTypeResults] = useState([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const typeDebounceRef = useRef(null);
  const typeRequestRef = useRef(0);

  useEffect(() => {
    loadRecentSearches().then(setRecentSearches);
  }, []);

  const clearTypeResults = useCallback(() => {
    if (typeDebounceRef.current) clearTimeout(typeDebounceRef.current);
    typeRequestRef.current += 1;
    setTypeResults([]);
    setTypeLoading(false);
  }, []);

  const clearSearchResults = useCallback(() => {
    setResults([]);
    setQuery('');
  }, []);

  // Debounced search-as-you-type: fires 300 ms after the user stops typing
  const handleQueryChange = useCallback(
    (text) => {
      setQuery(text);
      if (typeDebounceRef.current) clearTimeout(typeDebounceRef.current);
      if (!text.trim()) {
        typeRequestRef.current += 1;
        setTypeResults([]);
        setTypeLoading(false);
        return;
      }
      const requestId = typeRequestRef.current + 1;
      typeRequestRef.current = requestId;
      const trimmedText = text.trim();
      setTypeLoading(true);
      typeDebounceRef.current = setTimeout(async () => {
        try {
          const candidates = await searchLiveCandidates(trimmedText);
          if (requestId === typeRequestRef.current) {
            setTypeResults(candidates);
            setOfflineBanner(null);
          }
        } catch {
          if (requestId === typeRequestRef.current) {
            setTypeResults([]);
          }
        } finally {
          if (requestId === typeRequestRef.current) {
            setTypeLoading(false);
          }
        }
      }, 300);
    },
    [setOfflineBanner],
  );

  const rememberSearch = useCallback(
    async (searchQuery) => {
      const newHistory = [searchQuery, ...recentSearches.filter((q) => q !== searchQuery)].slice(
        0,
        3,
      );
      setRecentSearches(newHistory);
      await saveRecentSearches(newHistory);
    },
    [recentSearches],
  );

  // Selecting a live suggestion goes straight to the detail view
  const handleTypeSelect = useCallback(
    async (match, navigation) => {
      clearTypeResults();
      Keyboard.dismiss();

      if (match.resultType === 'person') {
        const personName = match.personName || match.title;
        setQuery(personName);
        await rememberSearch(personName);
        handlePersonPress(match.personId, personName, match.role, navigation);
        return;
      }

      await openResolvedDetail(match.title, match, navigation, 'Unable to fetch movie details.');
    },
    [clearTypeResults, handlePersonPress, openResolvedDetail, rememberSearch],
  );

  const handleSearch = useCallback(
    async (searchQuery = query, navigation) => {
      if (!searchQuery.trim()) return;

      clearTypeResults();
      Keyboard.dismiss();
      setLoading(true);
      setError(null);
      setErrorInfo(null);
      setQuery(searchQuery);

      try {
        const candidates = await searchTitleCandidates(searchQuery);
        setOfflineBanner(null);

        // If TMDB's top hit is a person (e.g. "Tom Hanks"), skip the results list
        // and go straight to their filmography.
        if (candidates.isPerson) {
          setLoading(false);
          await rememberSearch(searchQuery);
          handlePersonPress(
            candidates.personId,
            candidates.personName,
            candidates.role,
            navigation,
          );
          return;
        }

        setResults(candidates);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigateToTabRoot('search');
        setFilter(null); // Reset filter on new search

        // Update history
        await rememberSearch(searchQuery);
      } catch (err) {
        const classified = classifyAppError(err);
        if (classified.code === 'NO_RESULTS') {
          setResults([]);
          navigateToTabRoot('search');
          setFilter(null);
          await rememberSearch(searchQuery);
          toastiva.info('No matches found', { description: 'Try another search term' });
        } else {
          handleRequestError(err, 'Unable to search right now.', { fullScreen: true });
          navigateToTabRoot('search');
        }
      } finally {
        setLoading(false);
      }
    },
    [
      query,
      clearTypeResults,
      handlePersonPress,
      rememberSearch,
      handleRequestError,
      setLoading,
      setError,
      setErrorInfo,
      setOfflineBanner,
    ],
  );

  const handleSelectMatch = useCallback(
    async (match, navigation) => {
      await openResolvedDetail(query, match, navigation, 'Unable to fetch movie details.');
    },
    [query, openResolvedDetail],
  );

  // Called when a card in DiscoverScreen is tapped
  const handleSelectDiscoverItem = useCallback(
    async (item, navigation) => {
      // Pass item.title as query — detail screen uses it as a fallback
      await openResolvedDetail(item.title, item, navigation, 'Unable to fetch details.');
    },
    [openResolvedDetail],
  );

  const filteredResults = useMemo(() => {
    if (!filter) return results;
    return results.filter((item) => item.mediaType === filter);
  }, [results, filter]);

  return {
    query,
    setQuery,
    results,
    filter,
    setFilter,
    filteredResults,
    recentSearches,
    typeResults,
    typeLoading,
    clearTypeResults,
    clearSearchResults,
    handleQueryChange,
    rememberSearch,
    handleTypeSelect,
    handleSearch,
    handleSelectMatch,
    handleSelectDiscoverItem,
  };
}
