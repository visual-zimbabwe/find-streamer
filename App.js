import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, Keyboard, BackHandler, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeProvider } from './src/theme/ThemeProvider';
import { BottomSheetProvider, useBottomSheet } from './src/components/StackBottomSheet';
import { AppStateProvider } from './src/context/AppStateContext';
import { AppNavigationRoot } from './src/navigation/AppShell';
import {
  navigationRef,
  getFocusedRouteName,
  getCurrentTabId,
  navigateToTabRoot,
  pushOnCurrentTab,
} from './src/navigation/navigationRef';
import { searchTitleCandidates, searchLiveCandidates, resolveMatch, fetchPersonFilmography, fetchProductionCompanyCatalog, fetchSurpriseRecommendation, fetchSurpriseByGenre } from './src/lib/tmdb';
import { useDiscoverViewModel } from './src/lib/discoverViewModel';
import { useVoiceSearch } from './src/lib/useVoiceSearch';
import { loadRecentSearches, saveRecentSearches, loadRecentViewed, saveRecentViewed, loadWatchlist, saveWatchlist, loadWatchlistCollections, saveWatchlistCollections } from './src/lib/storage';
import { ToastivaProvider, toastiva } from 'toastiva';
import {
  WATCHLIST_STATUSES,
  getUserWatchlistCollections,
  getStatusLabel,
  isInUserLibrary,
  normalizeWatchlistCollections,
  normalizeWatchlistItem,
  watchlistEntryKey,
} from './src/lib/watchlistModel';
import { classifyAppError } from './src/lib/errors';
import { BottomNavVisibilityProvider } from './src/context/BottomNavVisibilityContext';

enableScreens(true);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <ToastivaProvider position="top-center">
            <BottomSheetProvider>
              <BottomNavVisibilityProvider>
                <MobileApp />
              </BottomNavVisibilityProvider>
            </BottomSheetProvider>
          </ToastivaProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
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

function WatchlistCollectionsSheet({
  item,
  collections,
  onCreateCollection,
  onToggleCollection,
  onSetStatus,
  onRemove,
  onClose,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii, spacing } = theme;
  const [name, setName] = useState('');
  const selectedCollectionIds = new Set(item?.collectionIds || []);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateCollection(trimmed);
    setName('');
  };

  return (
    <View style={styles.collectionSheetContent}>
      <View style={styles.collectionSheetHeader}>
        <Text style={[styles.categoryEyebrow, { color: colors.primary, ...typography.labelSm }]}>Library</Text>
        <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
          {item?.title}
        </Text>
        <Text style={[styles.collectionSheetHint, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          Bookmark saves this title to your library. Collections can overlap.
        </Text>
      </View>

      <View style={styles.statusRow}>
        {WATCHLIST_STATUSES.filter((status) => status.id !== 'dropped').map((status) => {
          const selected = item?.status === status.id;
          return (
            <TouchableOpacity
              key={status.id}
              style={[
                styles.statusChip,
                {
                  backgroundColor: selected ? colors.primary + '22' : colors.surfaceContainerHigh,
                  borderColor: selected ? colors.primary + '66' : colors.outlineVariant + '33',
                  borderRadius: radii.full,
                },
              ]}
              onPress={() => onSetStatus(status.id)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`Set status to ${status.label}`}
              accessibilityState={{ selected }}
            >
              <Ionicons name={status.icon} size={15} color={selected ? colors.primary : colors.onSurfaceVariant} />
              <Text style={[styles.statusChipText, { color: selected ? colors.primary : colors.onSurface, ...typography.labelSm }]}>
                {status.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.createCollectionBox, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant + '35', borderRadius: radii.lg }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New collection name"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[styles.collectionInput, { color: colors.onSurface, ...typography.bodyLg }]}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <TouchableOpacity
          style={[styles.createCollectionButton, { backgroundColor: colors.primary, borderRadius: radii.full, opacity: name.trim() ? 1 : 0.5 }]}
          onPress={handleCreate}
          disabled={!name.trim()}
          accessibilityRole="button"
          accessibilityLabel="Create collection"
          accessibilityState={{ disabled: !name.trim() }}
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.categoryList}>
        {collections.map((collection) => {
          const isSelected = selectedCollectionIds.has(collection.id);
          const locked = collection.immutable && isSelected;
          return (
            <TouchableOpacity
              key={collection.id}
              style={[
                styles.categoryOption,
                {
                  backgroundColor: isSelected ? colors.primary + '18' : colors.surfaceContainerHigh,
                  borderColor: isSelected ? colors.primary + '66' : colors.outlineVariant + '33',
                  borderRadius: radii.lg,
                },
              ]}
              activeOpacity={locked ? 1 : 0.82}
              onPress={() => {
                if (!locked) onToggleCollection(collection.id);
              }}
              accessibilityRole="checkbox"
              accessibilityLabel={`${isSelected ? 'Remove from' : 'Add to'} ${collection.name}`}
              accessibilityState={{ checked: isSelected, disabled: locked }}
            >
              <View style={[styles.categoryIcon, { backgroundColor: isSelected ? colors.primary + '33' : colors.primary + '22' }]}>
                <Ionicons name={collection.icon || 'albums-outline'} size={22} color={colors.primary} />
              </View>
              <View style={styles.categoryCopy}>
                <View style={styles.categoryLabelRow}>
                  <Text style={[styles.categoryOptionTitle, { color: isSelected ? colors.primary : colors.onSurface, ...typography.bodyLg }]}>
                    {collection.name}
                  </Text>
                  {locked && (
                    <View style={[styles.currentBadge, { backgroundColor: colors.primary + '22' }]}>
                      <Text style={[styles.currentBadgeText, { color: colors.primary, ...typography.labelSm }]}>Default</Text>
                    </View>
                  )}
                </View>
                {!!collection.description && (
                  <Text style={[styles.categoryOptionDescription, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
                    {collection.description}
                  </Text>
                )}
              </View>
              <Ionicons name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isSelected ? colors.primary : colors.onSurfaceVariant} />
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.removeOption, { backgroundColor: colors.error + '12', borderColor: colors.error + '33', borderRadius: radii.lg, marginTop: spacing[2] }]}
          activeOpacity={0.82}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove from library"
        >
          <View style={[styles.categoryIcon, { backgroundColor: colors.error + '22' }]}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </View>
          <View style={styles.categoryCopy}>
            <Text style={[styles.categoryOptionTitle, { color: colors.error, ...typography.bodyLg }]}>Remove from Library</Text>
            <Text style={[styles.categoryOptionDescription, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
              Removes this title from your saved library.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.error} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.doneCollectionButton, { backgroundColor: colors.primary, borderRadius: radii.full }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Done managing collections"
        >
          <Text style={[styles.doneCollectionButtonText, { color: colors.onPrimary, ...typography.labelSm }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MobileApp() {
  const { resolvedMode } = useTheme();
  const { show: showSheet, update: updateSheet, dismiss: dismissSheet } = useBottomSheet();

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
  const [watchlistCollections, setWatchlistCollections] = useState([]);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [surprisePickerVisible, setSurprisePickerVisible] = useState(false);
  const watchlistSheetIdRef = useRef(null);
  const watchlistRef = useRef([]);
  const watchlistCollectionsRef = useRef([]);
  const [filter, setFilter] = useState(null); // 'movie' | 'tv' | null
  const [homeMediaFilter, setHomeMediaFilter] = useState(null); // 'movie' | 'tv' | null
  const [collectionsSubView, setCollectionsSubView] = useState('franchises');
  const [collectionsImdbTab, setCollectionsImdbTab] = useState('movie');
  const [typeResults, setTypeResults] = useState([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const typeDebounceRef = useRef(null);
  const typeRequestRef = useRef(0);
  const [filmographyPerson, setFilmographyPerson] = useState(null); // { id, name, role }
  const [filmographyResults, setFilmographyResults] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const discoverVm = useDiscoverViewModel();

  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  useEffect(() => {
    watchlistCollectionsRef.current = watchlistCollections;
  }, [watchlistCollections]);

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

  const openDetail = useCallback((fullResult, navigation) => {
    setSelectedResult(fullResult);
    if (navigation) {
      navigation.push('Detail');
    } else {
      pushOnCurrentTab('Detail');
    }
  }, []);

  const openFilmography = useCallback((navigation) => {
    if (navigation) {
      navigation.push('Filmography');
    } else {
      pushOnCurrentTab('Filmography');
    }
  }, []);

  const openCollections = useCallback(() => {
    setCollectionsSubView('franchises');
    setCollectionsImdbTab('movie');
    if (navigationRef.isReady()) {
      navigationRef.navigate('home', { screen: 'Collections' });
    }
  }, []);

  const openHomeFromCollections = useCallback((nextFilter) => {
    setHomeMediaFilter(nextFilter === 'movie' || nextFilter === 'tv' ? nextFilter : null);
    navigateToTabRoot('home');
  }, []);

  const clearSearchResults = useCallback(() => {
    setResults([]);
    setQuery('');
  }, []);

  const goBack = useCallback(() => {
    if (!navigationRef.isReady()) return;

    const rootState = navigationRef.getRootState();
    const focusedRoute = getFocusedRouteName(rootState);
    const tabId = getCurrentTabId(rootState);
    const tabRoute = rootState.routes.find((r) => r.name === tabId);
    const stackCanPop = Boolean(tabRoute?.state && tabRoute.state.index > 0);

    if (focusedRoute === 'Collections' && collectionsSubView === 'imdb') {
      setCollectionsSubView('franchises');
      return;
    }

    if (error) {
      setError(null);
      setErrorInfo(null);
      return;
    }

    if (!stackCanPop) {
      if (tabId === 'search' && focusedRoute === 'Search' && results.length > 0) {
        clearSearchResults();
        return;
      }
      if (!(tabId === 'home' && focusedRoute === 'Home')) {
        navigateToTabRoot('home');
        setQuery('');
      }
      return;
    }

    navigationRef.goBack();
  }, [error, results.length, collectionsSubView, clearSearchResults]);

  useEffect(() => {
    const onBackPress = () => {
      if (!navigationRef.isReady()) return false;

      const rootState = navigationRef.getRootState();
      const focusedRoute = getFocusedRouteName(rootState);
      const tabId = getCurrentTabId(rootState);
      const tabRoute = rootState.routes.find((r) => r.name === tabId);
      const stackCanPop = Boolean(tabRoute?.state && tabRoute.state.index > 0);

      const atHomeRoot = tabId === 'home' && focusedRoute === 'Home' && !error && !stackCanPop;
      const atSearchRoot =
        tabId === 'search' && focusedRoute === 'Search' && !error && !stackCanPop && results.length === 0;
      if (atHomeRoot || atSearchRoot) {
        return false;
      }

      goBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [error, goBack, results.length]);

  // Initialization
  useEffect(() => {
    async function init() {
      const [history, viewed, saved, collections] = await Promise.all([
        loadRecentSearches(),
        loadRecentViewed(),
        loadWatchlist(),
        loadWatchlistCollections()
      ]);
      setRecentSearches(history);
      setRecentViewed(viewed);
      setWatchlist(saved);
      setWatchlistCollections(collections);
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

  const handlePersonPress = useCallback(async (personId, personName, role, navigation) => {
    setFilmographyLoading(true);
    setFilmographyPerson({ id: personId, name: personName, role, profileUrl: null });
    setFilmographyResults([]);
    openFilmography(navigation);
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
  }, [openFilmography, handleRequestError]);

  const handleCompanyPress = useCallback(async (companyId, companyName, logoUrl, navigation) => {
    setFilmographyLoading(true);
    setFilmographyPerson({ id: companyId, name: companyName, role: 'company', profileUrl: logoUrl || null });
    setFilmographyResults([]);
    openFilmography(navigation);
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
  }, [openFilmography, handleRequestError]);

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

  const userWatchlistCollections = useMemo(
    () => getUserWatchlistCollections(watchlistCollections),
    [watchlistCollections]
  );

  const savedWatchlistKeys = useMemo(
    () => watchlist.filter(isInUserLibrary).map(watchlistEntryKey).filter(Boolean),
    [watchlist]
  );

  const findWatchlistItem = useCallback((result) => {
    const key = watchlistEntryKey(result);
    if (!key) return null;
    return watchlist.find((item) => watchlistEntryKey(item) === key) || null;
  }, [watchlist]);

  // Selecting a live suggestion goes straight to the detail view
  const handleTypeSelect = useCallback(async (match, navigation) => {
    clearTypeResults();
    Keyboard.dismiss();

    if (match.resultType === 'person') {
      const personName = match.personName || match.title;
      setQuery(personName);
      await rememberSearch(personName);
      handlePersonPress(match.personId, personName, match.role, navigation);
      return;
    }

    setLoading(true);
    try {
      const fullResult = await resolveMatch(match.title, match);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      openDetail(fullResult, navigation);
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch movie details.');
    } finally {
      setLoading(false);
    }
  }, [clearTypeResults, handlePersonPress, openDetail, rememberSearch, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleSearch = useCallback(async (searchQuery = query, navigation) => {
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
        handlePersonPress(candidates.personId, candidates.personName, candidates.role, navigation);
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
        toastiva.info("No matches found", { description: "Try another search term" });
      } else {
        handleRequestError(err, 'Unable to search right now.', { fullScreen: true });
        navigateToTabRoot('search');
      }
    } finally {
      setLoading(false);
    }
  }, [query, clearTypeResults, handlePersonPress, openDetail, rememberSearch, handleRequestError]);

  const handleSelectMatch = useCallback(async (match, navigation) => {
    setLoading(true);
    try {
      const fullResult = await resolveMatch(query, match);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      openDetail(fullResult, navigation);
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch movie details.');
    } finally {
      setLoading(false);
    }
  }, [query, openDetail, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  // Called when a card in DiscoverScreen is tapped
  const handleSelectDiscoverItem = useCallback(async (item, navigation) => {
    setLoading(true);
    try {
      // Pass empty string as query — detail screen uses item.title as fallback
      const fullResult = await resolveMatch(item.title, item);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      openDetail(fullResult, navigation);
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch details.');
    } finally {
      setLoading(false);
    }
  }, [openDetail, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleSelectFilmographyItem = useCallback(async (item, navigation) => {
    setLoading(true);
    try {
      const fullResult = await resolveMatch(item.title, item);
      await rememberViewed(fullResult);
      await syncWatchlistFromResolvedDetail(fullResult);
      openDetail(fullResult, navigation);
      setOfflineBanner(null);
    } catch (err) {
      handleRequestError(err, 'Unable to fetch details.');
    } finally {
      setLoading(false);
    }
  }, [openDetail, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleSurpriseMe = useCallback(async (navigation) => {
    const seeds = watchlist.filter((item) => item.collectionIds?.includes('highly_recommend') && isInUserLibrary(item));
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
  }, [watchlist, clearTypeResults, openDetail, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const handleSurpriseByGenre = useCallback(async (genreId, mediaType, navigation) => {
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
  }, [clearTypeResults, openDetail, rememberViewed, syncWatchlistFromResolvedDetail, handleRequestError]);

  const openWatchlistSheet = useCallback((sheetItem) => {
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
      const next = previous.map((item) => (
        watchlistEntryKey(item) === itemKey ? normalizeWatchlistItem(updater(item)) : item
      ));
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
          const nextCollections = normalizeWatchlistCollections([...previousCollections, collection]);
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
          await updateOne((item) => ({
            ...item,
            status: item.status === 'dropped' ? 'saved' : item.status,
            collectionIds: [...(item.collectionIds || []), collection.id],
          }), 'Collection created');
          updateSheet(watchlistSheetIdRef.current, renderContent(
            normalizeWatchlistItem({
              ...currentItem,
              status: currentItem.status === 'dropped' ? 'saved' : currentItem.status,
              collectionIds: [...(currentItem.collectionIds || []), collection.id],
            }),
            getUserWatchlistCollections(nextCollections)
          ));
        }}
        onToggleCollection={async (collectionId) => {
          const selected = currentItem.collectionIds?.includes(collectionId);
          let newStatus = currentItem.status === 'dropped' ? 'saved' : currentItem.status;
          if (collectionId === 'watched') {
            newStatus = selected ? 'saved' : 'watched';
          }
          const nextItem = normalizeWatchlistItem({
            ...currentItem,
            status: newStatus,
            collectionIds: selected
              ? (currentItem.collectionIds || []).filter((id) => id !== collectionId)
              : [...(currentItem.collectionIds || []), collectionId],
          });
          await updateOne(() => nextItem, selected ? 'Removed from collection' : 'Added to collection');
          updateSheet(watchlistSheetIdRef.current, renderContent(nextItem));
        }}
        onSetStatus={async (status) => {
          let collectionIds = currentItem.collectionIds || [];
          if (status === 'watched') {
            if (!collectionIds.includes('watched')) {
              collectionIds = [...collectionIds, 'watched'];
            }
          } else {
            collectionIds = collectionIds.filter((id) => id !== 'watched');
          }
          const nextItem = normalizeWatchlistItem({ ...currentItem, status, collectionIds });
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
  }, [userWatchlistCollections, dismissSheet, showSheet, updateSheet, watchlist, watchlistCollections]);

  const handleToggleWatchlist = async (result) => {
    const existingItem = findWatchlistItem(result);
    if (existingItem) {
      if (!isInUserLibrary(existingItem)) {
        const restoredItem = normalizeWatchlistItem({ ...existingItem, status: 'saved' });
        const nextWatchlist = watchlist.map((item) => (
          watchlistEntryKey(item) === watchlistEntryKey(restoredItem) ? restoredItem : item
        ));
        setWatchlist(nextWatchlist);
        watchlistRef.current = nextWatchlist;
        try {
          await saveWatchlist(nextWatchlist);
          toastiva.success('Added to Library');
          openWatchlistSheet(restoredItem);
        } catch {
          setWatchlist(watchlist);
          watchlistRef.current = watchlist;
          toastiva.error('Failed to save to Watchlist');
        }
        return;
      }
      openWatchlistSheet(existingItem);
      return;
    }

    const newItem = normalizeWatchlistItem({
      ...result,
      status: 'saved',
      collectionIds: [],
    });
    const nextWatchlist = [newItem, ...watchlist.filter((item) => watchlistEntryKey(item) !== watchlistEntryKey(newItem))];
    setWatchlist(nextWatchlist);
    watchlistRef.current = nextWatchlist;
    try {
      await saveWatchlist(nextWatchlist);
      toastiva.success('Added to Library');
      openWatchlistSheet(newItem);
    } catch {
      setWatchlist(watchlist);
      watchlistRef.current = watchlist;
      toastiva.error('Failed to save to Watchlist');
    }
  };

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
      const wikidataEnriched = fields.wikidataEnriched === true;

      const languagesSame = JSON.stringify(prevRow.originalLanguage || []) === JSON.stringify(originalLanguage);
      const countriesSame = JSON.stringify(prevRow.countryOfOrigin || []) === JSON.stringify(countryOfOrigin);
      const basedOnSame = JSON.stringify(prevRow.basedOn || []) === JSON.stringify(basedOn);
      const soundtracksSame = JSON.stringify(prevRow.soundtracks || []) === JSON.stringify(soundtracks);
      const enrichedSame = prevRow.wikidataEnriched === wikidataEnriched;

      if (languagesSame && countriesSame && basedOnSame && soundtracksSame && enrichedSame) return prev;

      const merged = normalizeWatchlistItem({
        ...prevRow,
        originalLanguage,
        countryOfOrigin,
        basedOn,
        soundtracks,
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

  const persistWatchlistChange = async (nextWatchlist, rollbackWatchlist, successMessage, successIcon) => {
    setWatchlist(nextWatchlist);
    watchlistRef.current = nextWatchlist;
    try {
      await saveWatchlist(nextWatchlist);
      showToast(successMessage, {
        title: 'Watchlist',
        icon: successIcon,
      });
    } catch (err) {
      setWatchlist(rollbackWatchlist);
      watchlistRef.current = rollbackWatchlist;
      toastiva.error('Failed to update Watchlist');
    }
  };

  const handleRemoveWatchlistItem = async (target) => {
    const targetKey = watchlistEntryKey(target);
    if (!targetKey) return;
    const nextWatchlist = watchlist.filter((item) => watchlistEntryKey(item) !== targetKey);
    if (nextWatchlist.length === watchlist.length) return;
    await persistWatchlistChange(nextWatchlist, watchlist, 'Removed from Watchlist.', 'trash-outline');
  };

  const handleMarkWatched = async (target) => {
    const targetKey = watchlistEntryKey(target);
    if (!targetKey) return;
    const nextWatchlist = watchlist.map((item) =>
      watchlistEntryKey(item) === targetKey
        ? {
          ...item,
          status: 'watched',
        }
        : item
    );
    const changed = nextWatchlist.some((item, index) =>
      watchlistEntryKey(item) === targetKey && item.status !== watchlist[index]?.status
    );
    if (!changed) return;
    await persistWatchlistChange(nextWatchlist, watchlist, 'Marked as watched.', 'checkmark-circle-outline');
  };

  const handleTabPress = useCallback((tab) => {
    if (tab === 'home') {
      setHomeMediaFilter(null);
    }
    navigateToTabRoot(tab);
  }, []);

  const filteredResults = useMemo(() => {
    if (!filter) return results;
    return results.filter(item => item.mediaType === filter);
  }, [results, filter]);

  const hasHighlyRecommendedSeeds = useMemo(
    () => watchlist.some((item) => item.collectionIds?.includes('highly_recommend') && isInUserLibrary(item)),
    [watchlist]
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

  const onNavigationReady = useCallback(() => {}, []);

  const appState = {
    watchlist,
    query,
    results,
    filteredResults,
    filter,
    setFilter,
    loading,
    error,
    errorInfo,
    selectedResult,
    recentSearches,
    recentViewed,
    homeMediaFilter,
    setHomeMediaFilter,
    collectionsSubView,
    setCollectionsSubView,
    collectionsImdbTab,
    setCollectionsImdbTab,
    typeResults,
    typeLoading,
    filmographyPerson,
    filmographyResults,
    filmographyLoading,
    discoverVm,
    surpriseLoading,
    surprisePickerVisible,
    setSurprisePickerVisible,
    offlineBanner,
    setOfflineBanner,
    savedWatchlistKeys,
    userWatchlistCollections,
    watchlistCollections,
    voiceListening,
    hasHighlyRecommendedSeeds,
    QUICK_SURPRISE_GENRES,
    handleQueryChange,
    handleSearch,
    handleTypeSelect,
    handleSelectMatch,
    handleSelectDiscoverItem,
    handleSelectFilmographyItem,
    handleToggleWatchlist,
    handleEnrichWatchlistItem,
    handlePersonPress,
    handleCompanyPress,
    handleRemoveWatchlistItem,
    handleMarkWatched,
    handleTabPress,
    handleSurpriseMe,
    handleSurpriseByGenre,
    toggleVoiceSearch,
    openCollections,
    openHomeFromCollections,
    clearSearchResults,
    goBack,
    persistWatchlistChange,
    persistCollectionsChange,
    onNavigationReady,
  };

  return (
    <>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} translucent />
      <AppStateProvider value={appState}>
        <AppNavigationRoot />
      </AppStateProvider>
    </>
  );
}

const styles = StyleSheet.create({
  collectionSheetContent: {
    gap: 14,
  },
  collectionSheetHeader: {
    gap: 4,
    marginBottom: 2,
  },
  collectionSheetHint: {
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusChipText: {
    fontWeight: '900',
  },
  createCollectionBox: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collectionInput: {
    flex: 1,
    minHeight: 42,
    padding: 0,
  },
  createCollectionButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
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
  doneCollectionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 14,
  },
  doneCollectionButtonText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
