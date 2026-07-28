import { useState, useRef, useCallback, useReducer } from 'react';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { searchTitleCandidates, searchLiveCandidates } from '../lib/tmdb';
import { classifyAppError } from '../lib/errors';
import { navigateToTabRoot } from '../navigation/navigationRef';
import { isSearchableQuery } from '../lib/searchRanker';
import { INITIAL_SEARCH_SESSION, SEARCH_PHASE, searchSessionReducer } from '../lib/searchSession';

/**
 * Owns text search: the query, the committed `results` + `filter`, the
 * search-as-you-type suggestions (`typeResults`/`typeLoading`), and the recent
 * search history. Detail resolution and the shared spinner live in the detail
 * controller and are injected here.
 *
 * The submitted-results surface is an explicit state machine rather than a
 * boolean plus an old `results` array. That distinction matters: the screen
 * must never say "Arrival" in the field while it still renders Alien below it.
 *
 * @param {{
 *   openResolvedDetail: (queryTitle: string, match: object, navigation: object, fallbackMessage?: string) => Promise<void>,
 *   handlePersonPress: (personId: any, personName: string, role: any, navigation: object) => void,
 *   setOfflineBanner: (value: object | null) => void,
 * }} deps
 */
export function useSearchController({ openResolvedDetail, handlePersonPress, setOfflineBanner }) {
  const [query, setQuery] = useState('');
  const [searchSession, dispatchSearchSession] = useReducer(
    searchSessionReducer,
    INITIAL_SEARCH_SESSION,
  );
  const [typeResults, setTypeResults] = useState([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const typeDebounceRef = useRef(null);
  const typeRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const loading = searchSession.phase === SEARCH_PHASE.LOADING;

  const clearTypeResults = useCallback(() => {
    if (typeDebounceRef.current) clearTimeout(typeDebounceRef.current);
    typeRequestRef.current += 1;
    setTypeResults([]);
    setTypeLoading(false);
  }, []);

  const clearSearchResults = useCallback(() => {
    searchRequestRef.current += 1;
    dispatchSearchSession({ type: 'CLEAR' });
    setQuery('');
  }, []);

  /** What the ✕ button does: wipe the text, the suggestions and the results. */
  const clearSearch = useCallback(() => {
    clearSearchResults();
    clearTypeResults();
  }, [clearSearchResults, clearTypeResults]);

  // Debounced search-as-you-type: fires 300 ms after the user stops typing
  const handleQueryChange = useCallback(
    (text) => {
      setQuery(text);
      // The moment the field changes, the committed answer is no longer an
      // answer to the visible query. This also invalidates a pending submit.
      searchRequestRef.current += 1;
      dispatchSearchSession({ type: 'EDIT' });
      if (typeDebounceRef.current) clearTimeout(typeDebounceRef.current);
      // One-character queries return the fattest payloads we ask for and
      // effectively never contain the title being typed, so they aren't worth a
      // request. Two is the floor rather than three because "M", "Up" and "It"
      // are real titles.
      if (!isSearchableQuery(text)) {
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

  // Selecting a live suggestion goes straight to the detail view
  const handleTypeSelect = useCallback(
    async (match, navigation) => {
      clearTypeResults();
      Keyboard.dismiss();

      if (match.resultType === 'person') {
        const personName = match.personName || match.title;
        setQuery(personName);
        handlePersonPress(match.personId, personName, match.role, navigation);
        return;
      }

      await openResolvedDetail(match.title, match, navigation, 'Unable to fetch movie details.');
    },
    [clearTypeResults, handlePersonPress, openResolvedDetail],
  );

  const handleSearch = useCallback(
    async (searchQuery = query, navigation) => {
      const committedQuery = searchQuery.trim();
      if (!committedQuery) return;

      clearTypeResults();
      Keyboard.dismiss();
      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;
      // A submit retires visible cards before the network starts. The loading
      // state owns the surface until this exact request resolves or fails.
      dispatchSearchSession({ type: 'SUBMIT', query: committedQuery });
      setQuery(committedQuery);

      try {
        // People come back as rows in this list now rather than hijacking the
        // whole query — see `searchTitleCandidates`.
        const candidates = await searchTitleCandidates(committedQuery);
        if (requestId !== searchRequestRef.current) return;
        setOfflineBanner(null);

        dispatchSearchSession({ type: 'RESOLVE', results: candidates });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigateToTabRoot('search');

        // History is secondary persistence, not part of the request's visual
        // lifecycle. A storage failure must not turn correct results into an
        // error surface.
      } catch (err) {
        if (requestId !== searchRequestRef.current) return;
        const classified = classifyAppError(err);
        if (classified.code === 'NO_RESULTS') {
          dispatchSearchSession({ type: 'EMPTY' });
          navigateToTabRoot('search');
        } else {
          // A transport/service failure is not a "no matches" answer. Keep it
          // in the Search surface, with the submitted query available for retry.
          if (classified.severity === 'offline') {
            setOfflineBanner({
              message: "You're offline. Some features may be unavailable.",
              title: 'Offline',
            });
          }
          dispatchSearchSession({ type: 'FAIL', error: classified });
          navigateToTabRoot('search');
        }
      }
    },
    [query, clearTypeResults, setOfflineBanner],
  );

  const handleSelectMatch = useCallback(
    async (match, navigation) => {
      // The results list is mixed now, so the same handler has to know the
      // difference. Other callers (watchlist, detail rails) only ever pass
      // titles, so this branch is inert for them.
      if (match?.resultType === 'person') {
        handlePersonPress(
          match.personId ?? match.tmdbId,
          match.personName || match.title,
          match.role,
          navigation,
        );
        return;
      }
      await openResolvedDetail(
        searchSession.submittedQuery || query,
        match,
        navigation,
        'Unable to fetch movie details.',
      );
    },
    [query, searchSession.submittedQuery, openResolvedDetail, handlePersonPress],
  );

  // Called when a card in DiscoverScreen is tapped
  const handleSelectDiscoverItem = useCallback(
    async (item, navigation) => {
      // Pass item.title as query — detail screen uses it as a fallback
      await openResolvedDetail(item.title, item, navigation, 'Unable to fetch details.');
    },
    [openResolvedDetail],
  );

  return {
    loading,
    query,
    setQuery,
    results: searchSession.results,
    searchPhase: searchSession.phase,
    searchError: searchSession.error,
    submittedQuery: searchSession.submittedQuery,
    typeResults,
    typeLoading,
    clearTypeResults,
    clearSearchResults,
    clearSearch,
    handleQueryChange,
    handleTypeSelect,
    handleSearch,
    handleSelectMatch,
    handleSelectDiscoverItem,
  };
}
