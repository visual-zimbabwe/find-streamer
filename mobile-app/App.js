import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Keyboard, BackHandler, Modal, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeProvider } from './src/theme/ThemeProvider';
import { AppHeader } from './src/components/AppHeader';
import { BottomNav } from './src/components/BottomNav';
import { SearchPanel } from './src/components/SearchPanel';
import { MatchResults } from './src/components/MatchResults';
import { ResultView } from './src/components/ResultView';
import { SettingsView } from './src/components/SettingsView';
import { WatchlistView } from './src/components/WatchlistView';
import { DiscoverScreen } from './src/components/DiscoverScreen';
import { HomeScreen } from './src/components/HomeScreen';
import { FilmographyScreen } from './src/components/FilmographyScreen';
import { StatePanel } from './src/components/StatePanel';
import { EmptyState } from './src/components/EmptyState';
import { BottomSheetProvider, BottomSheetPortal } from './src/components/StackBottomSheet';
import { ErrorBanner } from './src/components/ErrorBanner';
import { searchTitleCandidates, searchLiveCandidates, resolveMatch, fetchPersonFilmography, fetchProductionCompanyCatalog, fetchSurpriseRecommendation, fetchSurpriseByGenre } from './src/lib/tmdb';
import { useDiscoverViewModel } from './src/lib/discoverViewModel';
import { useVoiceSearch } from './src/lib/useVoiceSearch';
import { loadRecentSearches, saveRecentSearches, loadRecentViewed, saveRecentViewed, loadWatchlist, saveWatchlist } from './src/lib/storage';
import { ToastivaProvider, toastiva } from 'toastiva';
import { getWatchlistCategory, WATCHLIST_CATEGORIES } from './src/lib/watchlistCategories';
import { classifyAppError } from './src/lib/errors';

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ToastivaProvider position="top-center">
          <BottomSheetProvider>
            <MobileApp />
          </BottomSheetProvider>
        </ToastivaProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

// Genre list for the Surprise Me picker (TMDB genre IDs)
const QUICK_SURPRISE_GENRES = [
  { id: 28,    mediaType: 'movie', label: '⚡ Action' },
  { id: 35,    mediaType: 'movie', label: '😂 Comedy' },
  { id: 18,    mediaType: 'movie', label: '🎭 Drama' },
  { id: 27,    mediaType: 'movie', label: '😱 Horror' },
  { id: 878,   mediaType: 'movie', label: '🚀 Sci-Fi' },
  { id: 53,    mediaType: 'movie', label: '🔪 Thriller' },
  { id: 16,    mediaType: 'movie', label: '✨ Animation' },
  { id: 10749, mediaType: 'movie', label: '💕 Romance' },
  { id: 99,    mediaType: 'movie', label: '📽 Documentary' },
  { id: 80,    mediaType: 'movie', label: '🔫 Crime' },
  { id: 14,    mediaType: 'movie', label: '🧙 Fantasy' },
  { id: 10759, mediaType: 'tv',    label: '⚔️ Action & Adventure (TV)' },
  { id: 10765, mediaType: 'tv',    label: '🧬 Sci-Fi & Fantasy (TV)' },
  { id: 9648,  mediaType: 'tv',    label: '🔍 Mystery (TV)' },
];

/** Align with ResultView: TMDB synopsis unless placeholder, else OMDb plot. */
function mergeResolvedSynopsisIntoWatchlistRow(row, fullResult) {
  const nextSynopsis =
    (fullResult.synopsis && fullResult.synopsis !== 'No synopsis available.')
      ? fullResult.synopsis
      : (fullResult.omdbRatings?.plot || fullResult.synopsis || row.synopsis || '');
  return {
    ...row,
    synopsis: (nextSynopsis && String(nextSynopsis).trim()) || row.synopsis,
    ...(fullResult.omdbRatings ? { omdbRatings: fullResult.omdbRatings } : {}),
  };
}

function MobileApp() {
  const { theme, resolvedMode } = useTheme();
  const { colors, typography, radii } = theme;

  const [activeView, setActiveView] = useState('home');
  const [activeTab, setActiveTab] = useState('home');
  const [navigationHistory, setNavigationHistory] = useState([]);
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [offlineBanner, setOfflineBanner] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentViewed, setRecentViewed] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [surprisePickerVisible, setSurprisePickerVisible] = useState(false);
  const [pendingWatchlistItem, setPendingWatchlistItem] = useState(null); // { ...item, _isReCategorize: bool }
  const [filter, setFilter] = useState(null); // 'movie' | 'tv' | null
  const [typeResults, setTypeResults] = useState([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const typeDebounceRef = useRef(null);
  const typeRequestRef = useRef(0);
  const [filmographyPerson, setFilmographyPerson] = useState(null); // { id, name, role }
  const [filmographyResults, setFilmographyResults] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const discoverVm = useDiscoverViewModel();
  const insets = useSafeAreaInsets();

  const showToast = useCallback((message, options = {}) => {
    const icon = options.icon || 'alert-circle-outline';
    const opts = { description: options.title };
    if (icon === 'trash-outline' || icon === 'checkmark-circle-outline' || icon === 'bookmark-outline') {
      toastiva.success(message, opts);
    } else if (icon === 'alert-circle-outline') {
      toastiva.error(message, opts);
    } else if (icon === 'mic-off-outline') {
      toastiva.warning(message, opts);
    } else {
      toastiva.info(message, opts);
    }
  }, []);

  const handleRequestError = useCallback((err, fallbackMessage, options = {}) => {
    const classified = classifyAppError(err);
    const message = classified.message || fallbackMessage || 'Something went wrong. Please try again.';
    if (classified.severity === 'offline') {
      setOfflineBanner({
        message: "You're offline. Some features may be unavailable.",
        title: 'Offline',
      });
    }
    if (options.fullScreen) {
      setError(message);
      setErrorInfo(classified);
    } else {
      showToast(message, {
        title: classified.title,
        icon: classified.severity === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline',
      });
    }
    return classified;
  }, [showToast]);

  const navigateTo = useCallback((view, updates = {}) => {
    // Save current state to history
    setNavigationHistory(prev => [...prev, {
      view: activeView,
      activeTab,
      query,
      results,
      selectedResult,
      filter,
      filmographyPerson,
      filmographyResults,
    }]);

    // Apply updates for the new view
    if (updates.activeTab !== undefined) setActiveTab(updates.activeTab);
    if (updates.query !== undefined) setQuery(updates.query);
    if (updates.results !== undefined) setResults(updates.results);
    if (updates.selectedResult !== undefined) setSelectedResult(updates.selectedResult);
    if (updates.filter !== undefined) setFilter(updates.filter);
    if (updates.filmographyPerson !== undefined) setFilmographyPerson(updates.filmographyPerson);
    if (updates.filmographyResults !== undefined) setFilmographyResults(updates.filmographyResults);
    
    setActiveView(view);
  }, [activeView, activeTab, query, results, selectedResult, filter, filmographyPerson, filmographyResults]);

  const handleBack = useCallback(() => {
    // If an error is showing, dismiss it
    if (error) {
      setError(null);
      setErrorInfo(null);
      if (activeView === 'search' && results.length === 0) {
        setActiveView('search');
      }
      return;
    }

    if (navigationHistory.length === 0) {
      // If on search with results visible, clear them first
      if (activeView === 'search' && results.length > 0) {
        setResults([]);
        setQuery('');
        return;
      }
      // From any other root tab/screen, return to the Home tab
      if (!(activeView === 'home' && activeTab === 'home')) {
        setActiveTab('home');
        setActiveView('home');
        setQuery('');
      }
      return;
    }

    // Pop the top item from history and restore state
    const prev = navigationHistory[navigationHistory.length - 1];
    setNavigationHistory(h => h.slice(0, -1));

    setActiveView(prev.view);
    setActiveTab(prev.activeTab);
    setQuery(prev.query);
    setResults(prev.results);
    setSelectedResult(prev.selectedResult);
    setFilter(prev.filter);
    setFilmographyPerson(prev.filmographyPerson);
    setFilmographyResults(prev.filmographyResults);
  }, [error, activeView, activeTab, navigationHistory, results]);

  // Handle hardware back button
  useEffect(() => {
    const onBackPress = () => {
      // If we are at the root with no history and no error, allow app to close
      const atHomeRoot =
        activeView === 'home' && activeTab === 'home' && !error && navigationHistory.length === 0;
      const atSearchRoot =
        activeView === 'search' && activeTab === 'search' && !error && navigationHistory.length === 0 && results.length === 0;
      if (atHomeRoot || atSearchRoot) {
        return false;
      }
      
      // Otherwise, handle it within our navigation
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeView, activeTab, error, handleBack, navigationHistory, results.length]);

  // Initialization
  useEffect(() => {
    async function init() {
      const [history, viewed, saved] = await Promise.all([
        loadRecentSearches(),
        loadRecentViewed(),
        loadWatchlist()
      ]);
      setRecentSearches(history);
      setRecentViewed(viewed);
      setWatchlist(saved);
    }
    init();
  }, []);

  const clearTypeResults = useCallback(() => {
    if (typeDebounceRef.current) clearTimeout(typeDebounceRef.current);
    typeRequestRef.current += 1;
    setTypeResults([]);
    setTypeLoading(false);
  }, []);

  // Debounced search-as-you-type: fires 300 ms after the user stops typing
  const handleQueryChange = useCallback((text) => {
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
  }, []);

  const handleVoiceSearchError = useCallback((message) => {
    showToast(message, {
      title: 'Voice Search',
      icon: 'mic-off-outline',
    });
  }, [showToast]);

  const { listening: voiceListening, toggleVoiceSearch } = useVoiceSearch({
    onTranscript: handleQueryChange,
    onError: handleVoiceSearchError,
  });

  const handlePersonPress = useCallback(async (personId, personName, role) => {
    setFilmographyLoading(true);
    setFilmographyPerson({ id: personId, name: personName, role, profileUrl: null });
    setFilmographyResults([]);
    navigateTo('filmography');
    try {
      const { results, profileUrl } = await fetchPersonFilmography(personId, personName, role);
      setFilmographyResults(results);
      setFilmographyPerson(prev => ({ ...prev, profileUrl }));
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch filmography.');
    } finally {
      setFilmographyLoading(false);
    }
  }, [navigateTo, handleRequestError]);

  const handleCompanyPress = useCallback(async (companyId, companyName, logoUrl) => {
    setFilmographyLoading(true);
    setFilmographyPerson({ id: companyId, name: companyName, role: 'company', profileUrl: logoUrl || null });
    setFilmographyResults([]);
    navigateTo('filmography');
    try {
      const { results, profileUrl } = await fetchProductionCompanyCatalog(companyId, companyName, logoUrl);
      setFilmographyResults(results);
      setFilmographyPerson(prev => ({ ...prev, profileUrl: profileUrl ?? prev.profileUrl }));
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to load titles from this studio.');
    } finally {
      setFilmographyLoading(false);
    }
  }, [navigateTo, handleRequestError]);

  const rememberSearch = useCallback(async (searchQuery) => {
    const newHistory = [searchQuery, ...recentSearches.filter(q => q !== searchQuery)].slice(0, 3);
    setRecentSearches(newHistory);
    await saveRecentSearches(newHistory);
  }, [recentSearches]);

  const rememberViewed = useCallback(async (result) => {
    if (!result?.tmdbId || !result?.title || !result?.mediaType) return;
    const nextViewed = [
      result,
      ...recentViewed.filter((item) => !(item.tmdbId === result.tmdbId && item.mediaType === result.mediaType)),
    ].slice(0, 8);
    setRecentViewed(nextViewed);
    await saveRecentViewed(nextViewed);
  }, [recentViewed]);

  const syncWatchlistFromResolvedDetail = useCallback(async (fullResult) => {
    if (!fullResult?.tmdbId || !fullResult?.mediaType) return;
    setWatchlist((prev) => {
      const idx = prev.findIndex(
        (w) => w.tmdbId === fullResult.tmdbId && w.mediaType === fullResult.mediaType
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

  // Selecting a live suggestion goes straight to the detail view
  const handleTypeSelect = useCallback(async (match) => {
    clearTypeResults();
    Keyboard.dismiss();

    if (match.resultType === 'person') {
      const personName = match.personName || match.title;
      setQuery(personName);
      await rememberSearch(personName);
      handlePersonPress(match.personId, personName, match.role);
      return;
    }

    setLoading(true);
    try {
      const fullResult = await resolveMatch(match.title, match);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      navigateTo('detail', { selectedResult: fullResult });
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch movie details.');
    } finally {
      setLoading(false);
    }
  }, [clearTypeResults, handlePersonPress, navigateTo, rememberSearch, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleSearch = useCallback(async (searchQuery = query) => {
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
        handlePersonPress(candidates.personId, candidates.personName, candidates.role);
        return;
      }

      setResults(candidates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setActiveTab('search');
      setFilter(null); // Reset filter on new search
      
      // Update history
      await rememberSearch(searchQuery);
    } catch (err) {
      const classified = classifyAppError(err);
      if (classified.code === 'NO_RESULTS') {
        setResults([]);
        setActiveTab('search');
        setFilter(null);
        await rememberSearch(searchQuery);
        toastiva.info("No matches found", { description: "Try another search term" });
      } else {
        handleRequestError(err, 'Unable to search right now.', { fullScreen: true });
        setActiveView('search');
      }
    } finally {
      setLoading(false);
    }
  }, [query, clearTypeResults, handlePersonPress, navigateTo, rememberSearch, handleRequestError]);

  const handleSelectMatch = useCallback(async (match) => {
    setLoading(true);
    try {
      const fullResult = await resolveMatch(query, match);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      navigateTo('detail', { selectedResult: fullResult });
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch movie details.');
    } finally {
      setLoading(false);
    }
  }, [query, navigateTo, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  // Called when a card in DiscoverScreen is tapped
  const handleSelectDiscoverItem = useCallback(async (item) => {
    setLoading(true);
    try {
      // Pass empty string as query — detail screen uses item.title as fallback
      const fullResult = await resolveMatch(item.title, item);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      navigateTo('detail', { selectedResult: fullResult });
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch details.');
    } finally {
      setLoading(false);
    }
  }, [navigateTo, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleSelectFilmographyItem = useCallback(async (item) => {
    setLoading(true);
    try {
      const fullResult = await resolveMatch(item.title, item);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      navigateTo('detail', { selectedResult: fullResult });
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch details.');
    } finally {
      setLoading(false);
    }
  }, [navigateTo, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleSurpriseMe = useCallback(async () => {
    const seeds = watchlist.filter((item) => getWatchlistCategory(item.watchlistCategoryId).id === 'highly_recommend');
    setSurpriseLoading(true);
    clearTypeResults();
    Keyboard.dismiss();
    try {
      const pick = await fetchSurpriseRecommendation(seeds);
      const fullResult = await resolveMatch(pick.title, pick);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      navigateTo('detail', { selectedResult: fullResult });
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to find a surprise pick right now.');
    } finally {
      setSurpriseLoading(false);
    }
  }, [watchlist, clearTypeResults, navigateTo, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleSurpriseByGenre = useCallback(async (genreId, mediaType) => {
    setSurprisePickerVisible(false);
    setSurpriseLoading(true);
    clearTypeResults();
    Keyboard.dismiss();
    try {
      const pick = await fetchSurpriseByGenre(genreId, mediaType);
      const fullResult = await resolveMatch(pick.title, pick);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      navigateTo('detail', { selectedResult: fullResult });
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'No surprise picks found for that genre.');
    } finally {
      setSurpriseLoading(false);
    }
  }, [clearTypeResults, navigateTo, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleToggleWatchlist = async (result) => {
    const existingItem = watchlist.find(item => item.tmdbId === result.tmdbId);
    if (existingItem) {
      // Open the modal showing the current category so the user can move or remove
      setPendingWatchlistItem({ ...existingItem, _isReCategorize: true });
      return;
    }

    setPendingWatchlistItem({ ...result, _isReCategorize: false });
  };

  const handleSelectWatchlistCategory = async (categoryId) => {
    if (!pendingWatchlistItem) return;

    const isReCategorize = pendingWatchlistItem._isReCategorize;
    const { _isReCategorize, ...itemData } = pendingWatchlistItem;

    const updatedItem = {
      ...itemData,
      watchlistCategoryId: categoryId,
      watchlistCategoryLabel: getWatchlistCategory(categoryId).label,
    };

    let newWatchlist;
    if (isReCategorize) {
      // Update in-place, preserving original position
      newWatchlist = watchlist.map(item =>
        item.tmdbId === updatedItem.tmdbId ? updatedItem : item
      );
    } else {
      newWatchlist = [
        updatedItem,
        ...watchlist.filter(item => item.tmdbId !== updatedItem.tmdbId),
      ];
    }

    setPendingWatchlistItem(null);
    try {
      await saveWatchlist(newWatchlist);
      toastiva.success(isReCategorize ? 'Watchlist category updated' : '✅ Added to Watchlist');
    } catch (err) {
      setWatchlist(watchlist);
      toastiva.error('Failed to save to Watchlist');
    }
  };

  const handleRemoveFromWatchlist = async () => {
    if (!pendingWatchlistItem) return;
    const newWatchlist = watchlist.filter(item => item.tmdbId !== pendingWatchlistItem.tmdbId);
    setPendingWatchlistItem(null);
    setWatchlist(newWatchlist);
    try {
      await saveWatchlist(newWatchlist);
      toastiva.success('Removed from Watchlist');
    } catch (err) {
      setWatchlist(watchlist);
      toastiva.error('Failed to update Watchlist');
    }
  };

  const persistWatchlistChange = async (nextWatchlist, rollbackWatchlist, successMessage, successIcon) => {
    setWatchlist(nextWatchlist);
    try {
      await saveWatchlist(nextWatchlist);
      showToast(successMessage, {
        title: 'Watchlist',
        icon: successIcon,
      });
    } catch (err) {
      setWatchlist(rollbackWatchlist);
      toastiva.error('Failed to update Watchlist');
    }
  };

  const handleRemoveWatchlistItem = async (tmdbId) => {
    const nextWatchlist = watchlist.filter((item) => item.tmdbId !== tmdbId);
    if (nextWatchlist.length === watchlist.length) return;
    await persistWatchlistChange(nextWatchlist, watchlist, 'Removed from Watchlist.', 'trash-outline');
  };

  const handleMarkWatched = async (tmdbId) => {
    const watchedCategory = getWatchlistCategory('watched');
    const nextWatchlist = watchlist.map((item) =>
      item.tmdbId === tmdbId
        ? {
          ...item,
          watchlistCategoryId: watchedCategory.id,
          watchlistCategoryLabel: watchedCategory.label,
        }
        : item
    );
    const changed = nextWatchlist.some((item, index) =>
      item.tmdbId === tmdbId && item.watchlistCategoryId !== watchlist[index]?.watchlistCategoryId
    );
    if (!changed) return;
    await persistWatchlistChange(nextWatchlist, watchlist, 'Marked as watched.', 'checkmark-circle-outline');
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    setNavigationHistory([]); // Reset stack when switching tabs
    if (tab === 'home') {
      setActiveView('home');
    } else if (tab === 'search') {
      setActiveView('search');
    } else if (tab === 'discover') {
      setActiveView('discover');
    } else if (tab === 'watchlist') {
      setActiveView('watchlist');
    } else if (tab === 'settings') {
      setActiveView('settings');
    }
  };

  const filteredResults = useMemo(() => {
    if (!filter) return results;
    return results.filter(item => item.mediaType === filter);
  }, [results, filter]);

  const hasHighlyRecommendedSeeds = useMemo(
    () => watchlist.some((item) => getWatchlistCategory(item.watchlistCategoryId).id === 'highly_recommend'),
    [watchlist]
  );

  const showBack = activeView === 'detail' || activeView === 'filmography';
  const showLoading = loading && activeView !== 'detail' && activeView !== 'discover' && activeView !== 'home';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} translucent />
      
      {/* Standard safe area header for all other screens */}
      {activeView !== 'detail' && activeView !== 'filmography' && (
        <View style={{ paddingTop: insets.top }}>
          <AppHeader 
            showBack={showBack} 
            onBack={handleBack} 
          />
        </View>
      )}
      
      <View style={styles.mainContent}>
        {showLoading ? (
          <StatePanel type="loading" title="Searching..." description="Please wait while we find your movie." />
        ) : error ? (
          <StatePanel
            type={errorInfo?.severity === 'offline' ? 'offline' : errorInfo?.severity === 'service' ? 'service' : 'error'}
            title={errorInfo?.title || 'Search Error'}
            description={error}
            onRetry={() => handleSearch(query)}
            actionLabel="Refresh"
          />
        ) : (
          <>
            {activeView === 'home' && (
              <HomeScreen
                watchlist={watchlist}
                onSelectItem={handleSelectDiscoverItem}
                onToggleWatchlist={handleToggleWatchlist}
              />
            )}

            {activeView === 'search' && (
              <View style={{ flex: 1 }}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
                  <SearchPanel
                    value={query}
                    onChangeText={handleQueryChange}
                    onSubmit={() => handleSearch()}
                    loading={loading}
                    recentSearches={recentSearches}
                    recentViewed={recentViewed}
                    onPickSuggestion={handleSearch}
                    onPickRecentViewed={handleSelectMatch}
                    filter={filter}
                    onFilterChange={setFilter}
                    hideHistory={results.length > 0}
                    hideHero={results.length > 0}
                    typeResults={typeResults}
                    typeLoading={typeLoading}
                    onTypeSelect={handleTypeSelect}
                    onVoicePress={toggleVoiceSearch}
                    voiceListening={voiceListening}
                  />
                  {results.length > 0 && (
                    <>
                      <MatchResults
                        matches={filteredResults}
                        onSelect={handleSelectMatch}
                        onToggleWatchlist={handleToggleWatchlist}
                        watchlistIds={watchlist.map(item => item.tmdbId)}
                      />
                      {filteredResults.length === 0 && (
                        <EmptyState
                          variant="empty"
                          title="No matches found"
                          description={filter
                            ? `We couldn't find any ${filter === 'movie' ? 'movies' : 'TV shows'} for "${query}".`
                            : `We couldn't find any matches for "${query}".`}
                          primaryAction={filter ? {
                            label: 'Clear Filters',
                            icon: 'close-circle-outline',
                            onPress: () => setFilter(null),
                            accessibilityLabel: 'Clear result filters',
                          } : {
                            label: 'Check Spelling',
                            icon: 'create-outline',
                            onPress: () => { setResults([]); setQuery(''); },
                            accessibilityLabel: 'Edit search text',
                          }}
                          secondaryAction={{
                            label: 'Discover',
                            onPress: () => handleTabPress('discover'),
                            accessibilityLabel: 'Go to Discover',
                          }}
                          compact
                        />
                      )}
                    </>
                  )}
                </ScrollView>

                {/* Surprise Me Floating Action Button */}
                <TouchableOpacity
                  style={[styles.surpriseFab, { bottom: insets.bottom + 88 }]}
                  onPress={() => setSurprisePickerVisible(true)}
                  disabled={surpriseLoading}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Surprise Me – pick a random movie or show"
                  accessibilityState={{ busy: Boolean(surpriseLoading) }}
                >
                  <LinearGradient
                    colors={['#ff7a59', '#ffcf33', '#20d6b5']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.surpriseFabGradient}
                  >
                    {surpriseLoading
                      ? <ActivityIndicator color="#111" size="small" />
                      : <Ionicons name="sparkles" size={22} color="#111" />
                    }
                    <Text style={styles.surpriseFabLabel}>
                      {surpriseLoading ? 'Shuffling…' : 'Surprise'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            
            {activeView === 'detail' && (
              <ResultView 
                result={selectedResult} 
                onBack={handleBack} 
                onToggleWatchlist={handleToggleWatchlist}
                isInWatchlist={watchlist.some(item => item.tmdbId === selectedResult?.tmdbId)}
                onSelectSimilar={handleSelectMatch}
                onPersonPress={handlePersonPress}
                onCompanyPress={handleCompanyPress}
              />
            )}
            
            {activeView === 'watchlist' && (
              <WatchlistView 
                items={watchlist} 
                onRemove={handleRemoveWatchlistItem}
                onMarkWatched={handleMarkWatched}
                onSelect={handleSelectMatch}
                onBrowseMovies={() => handleTabPress('discover')}
                onBrowseTV={() => handleTabPress('discover')}
              />
            )}

            {activeView === 'discover' && (
              <DiscoverScreen
                onSelectItem={handleSelectDiscoverItem}
                vm={discoverVm}
                onToggleWatchlist={handleToggleWatchlist}
                watchlistIds={watchlist.map(item => item.tmdbId)}
              />
            )}

            {activeView === 'filmography' && filmographyPerson && (
              <FilmographyScreen
                personName={filmographyPerson.name}
                role={filmographyPerson.role}
                profileUrl={filmographyPerson.profileUrl}
                results={filmographyResults}
                onSelectItem={handleSelectFilmographyItem}
                loading={filmographyLoading}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView watchlist={watchlist} persistWatchlistChange={persistWatchlistChange} />
            )}
          </>
        )}
      </View>

      {/* Surprise Me Picker Modal */}
      <Modal
        visible={surprisePickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSurprisePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.categorySheet, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '4D', borderRadius: radii.xl }]}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryTitleBlock}>
                <Text style={[styles.categoryEyebrow, { color: colors.primary, ...typography.labelSm }]}>Surprise Roulette</Text>
                <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]}>🎲 Surprise Me</Text>
              </View>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.surfaceContainerHighest }]} onPress={() => setSurprisePickerVisible(false)} accessibilityRole="button" accessibilityLabel="Close surprise picker">
                <Ionicons name="close" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Watchlist-based quick surprise */}
            <TouchableOpacity
              style={[styles.surpriseQuickBtn, { backgroundColor: hasHighlyRecommendedSeeds ? colors.primary + '18' : colors.surfaceContainerHigh, borderColor: hasHighlyRecommendedSeeds ? colors.primary + '55' : colors.outlineVariant + '40', borderRadius: radii.lg }]}
              onPress={() => { setSurprisePickerVisible(false); handleSurpriseMe(); }}
              disabled={!hasHighlyRecommendedSeeds}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Surprise me based on my favorites"
            >
              <Ionicons name="heart-outline" size={20} color={hasHighlyRecommendedSeeds ? colors.primary : colors.onSurfaceVariant} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[{ color: hasHighlyRecommendedSeeds ? colors.primary : colors.onSurface, fontWeight: '800', ...typography.bodyLg }]}>Based on My Favorites</Text>
                <Text style={[{ color: colors.onSurfaceVariant, ...typography.labelSm, marginTop: 2 }]}>{hasHighlyRecommendedSeeds ? 'Picks from your Highly Recommend list' : 'Add to Highly Recommend to unlock'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={hasHighlyRecommendedSeeds ? colors.primary : colors.onSurfaceVariant} />
            </TouchableOpacity>

            <View style={styles.surpriseDivider}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.outlineVariant + '30' }} />
              <Text style={[{ color: colors.onSurfaceVariant, ...typography.labelSm, marginHorizontal: 12 }]}>Or Pick a Genre</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.outlineVariant + '30' }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
              <View style={styles.genreGrid}>
                {QUICK_SURPRISE_GENRES.map((genre) => (
                  <TouchableOpacity
                    key={`${genre.id}-${genre.mediaType}`}
                    style={[styles.genreChip, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant + '40', borderRadius: radii.lg }]}
                    onPress={() => handleSurpriseByGenre(genre.id, genre.mediaType)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Surprise me with ${genre.label}`}
                  >
                    <Text style={[{ color: colors.onSurface, fontWeight: '700', textAlign: 'center', ...typography.bodyMd }]}>{genre.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(pendingWatchlistItem)}
        onRequestClose={() => setPendingWatchlistItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.categorySheet, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '4D', borderRadius: radii.xl }]}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryTitleBlock}>
                <Text style={[styles.categoryEyebrow, { color: colors.primary, ...typography.labelSm }]}>
                  {pendingWatchlistItem?._isReCategorize ? 'Move to Category' : 'Save to Watchlist'}
                </Text>
                <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
                  {pendingWatchlistItem?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.surfaceContainerHighest }]}
                onPress={() => setPendingWatchlistItem(null)}
                accessibilityRole="button"
                accessibilityLabel="Close watchlist category picker"
              >
                <Ionicons name="close" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.categoryList}>
              {WATCHLIST_CATEGORIES.map((category) => {
                const isCurrent = pendingWatchlistItem?._isReCategorize &&
                  pendingWatchlistItem?.watchlistCategoryId === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryOption,
                      {
                        backgroundColor: isCurrent ? colors.primary + '1A' : colors.surfaceContainerHigh,
                        borderColor: isCurrent ? colors.primary + '66' : colors.outlineVariant + '33',
                        borderRadius: radii.lg,
                      },
                    ]}
                    activeOpacity={0.82}
                    onPress={() => handleSelectWatchlistCategory(category.id)}
                    accessibilityRole="button"
                    accessibilityLabel={isCurrent ? `Currently in ${category.label}` : `Move to ${category.label}`}
                    accessibilityState={{ selected: isCurrent }}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: isCurrent ? colors.primary + '33' : colors.primary + '22' }]}>
                      <Ionicons name={category.icon} size={22} color={colors.primary} />
                    </View>
                    <View style={styles.categoryCopy}>
                      <View style={styles.categoryLabelRow}>
                        <Text style={[styles.categoryOptionTitle, { color: isCurrent ? colors.primary : colors.onSurface, ...typography.bodyLg }]}>
                          {category.label}
                        </Text>
                        {isCurrent && (
                          <View style={[styles.currentBadge, { backgroundColor: colors.primary + '22' }]}>
                            <Text style={[styles.currentBadgeText, { color: colors.primary, ...typography.labelSm }]}>Current</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.categoryOptionDescription, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
                        {category.description}
                      </Text>
                    </View>
                    <Ionicons name={isCurrent ? 'checkmark-circle' : 'chevron-forward'} size={18} color={isCurrent ? colors.primary : colors.onSurfaceVariant} />
                  </TouchableOpacity>
                );
              })}

              {pendingWatchlistItem?._isReCategorize && (
                <TouchableOpacity
                  style={[styles.removeOption, { backgroundColor: colors.error + '12', borderColor: colors.error + '33', borderRadius: radii.lg }]}
                  activeOpacity={0.82}
                  onPress={handleRemoveFromWatchlist}
                  accessibilityRole="button"
                  accessibilityLabel="Remove from watchlist"
                >
                  <View style={[styles.categoryIcon, { backgroundColor: colors.error + '22' }]}>
                    <Ionicons name="trash-outline" size={22} color={colors.error} />
                  </View>
                  <View style={styles.categoryCopy}>
                    <Text style={[styles.categoryOptionTitle, { color: colors.error, ...typography.bodyLg }]}>Remove from Watchlist</Text>
                    <Text style={[styles.categoryOptionDescription, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                      Permanently remove this title.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <ErrorBanner
        placement="top"
        title={offlineBanner?.title}
        message={offlineBanner?.message}
        icon="cloud-offline-outline"
        onDismiss={() => setOfflineBanner(null)}
      />

      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />

      {/* BottomSheetPortal — renders stacked sheets above everything */}
      <BottomSheetPortal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 180, // extra room for FAB above BottomNav
  },
  surpriseFab: {
    position: 'absolute',
    right: 20,
    shadowColor: '#ffb23f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 8,
    borderRadius: 28,
  },
  surpriseFabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 7,
  },
  surpriseFabLabel: {
    color: '#111',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  surpriseQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  surpriseDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genreChip: {
    width: '47%',
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  categorySheet: {
    borderWidth: 1,
    margin: 16,
    padding: 20,
  },
  categoryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  categoryTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  categoryEyebrow: {
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  categoryTitle: {
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  categoryList: {
    gap: 10,
  },
  categoryOption: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  categoryOptionTitle: {
    fontWeight: '800',
  },
  categoryOptionDescription: {
    lineHeight: 18,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  currentBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  removeOption: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    padding: 14,
  },
});
