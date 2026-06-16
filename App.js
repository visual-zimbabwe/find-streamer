import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme, ThemeProvider } from './src/theme/ThemeProvider';
import { BottomSheetProvider } from './src/components/StackBottomSheet';
import { AppStateProvider } from './src/context/AppStateContext';
import { AppNavigationRoot } from './src/navigation/AppShell';
import { useDiscoverViewModel } from './src/lib/discoverViewModel';
import { useVoiceSearch } from './src/lib/useVoiceSearch';
import { ToastivaProvider } from 'toastiva';
import { BottomNavVisibilityProvider } from './src/context/BottomNavVisibilityContext';
import { LaunchGate } from './src/components/LaunchGate';
import { useToast } from './src/hooks/useToast';
import { useRequestError } from './src/hooks/useRequestError';
import { useWatchlistController } from './src/hooks/useWatchlistController';
import { useDetailController } from './src/hooks/useDetailController';
import { usePeopleController } from './src/hooks/usePeopleController';
import { useSearchController } from './src/hooks/useSearchController';
import { useSurpriseController } from './src/hooks/useSurpriseController';
import { useAppNavigation } from './src/hooks/useAppNavigation';

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
  { id: 28, mediaType: 'movie', label: '⚡ Action' },
  { id: 35, mediaType: 'movie', label: '😂 Comedy' },
  { id: 18, mediaType: 'movie', label: '🎭 Drama' },
  { id: 27, mediaType: 'movie', label: '😱 Horror' },
  { id: 878, mediaType: 'movie', label: '🚀 Sci-Fi' },
  { id: 53, mediaType: 'movie', label: '🔪 Thriller' },
  { id: 16, mediaType: 'movie', label: '✨ Animation' },
  { id: 10749, mediaType: 'movie', label: '💕 Romance' },
  { id: 99, mediaType: 'movie', label: '📽 Documentary' },
  { id: 80, mediaType: 'movie', label: '🔫 Crime' },
  { id: 14, mediaType: 'movie', label: '🧙 Fantasy' },
  { id: 10759, mediaType: 'tv', label: '⚔️ Action & Adventure (TV)' },
  { id: 10765, mediaType: 'tv', label: '🧬 Sci-Fi & Fantasy (TV)' },
  { id: 9648, mediaType: 'tv', label: '🔍 Mystery (TV)' },
];

function MobileApp() {
  const { resolvedMode, ready: themeReady } = useTheme();

  const { showToast } = useToast();
  const requestError = useRequestError({ showToast });
  const {
    error,
    errorInfo,
    setError,
    setErrorInfo,
    offlineBanner,
    setOfflineBanner,
    handleRequestError,
  } = requestError;

  const watchlistCtl = useWatchlistController({ showToast });
  const { syncWatchlistFromResolvedDetail } = watchlistCtl;

  const detail = useDetailController({
    syncWatchlistFromResolvedDetail,
    handleRequestError,
    setOfflineBanner,
  });
  const { openDetail, openResolvedDetail, rememberViewed, setLoading } = detail;

  const people = usePeopleController({
    openResolvedDetail,
    handleRequestError,
    setOfflineBanner,
  });
  const { handlePersonPress } = people;

  const search = useSearchController({
    setLoading,
    openResolvedDetail,
    handlePersonPress,
    handleRequestError,
    setError,
    setErrorInfo,
    setOfflineBanner,
  });

  const surprise = useSurpriseController({
    watchlist: watchlistCtl.watchlist,
    clearTypeResults: search.clearTypeResults,
    rememberViewed,
    syncWatchlistFromResolvedDetail,
    openDetail,
    handleRequestError,
    setOfflineBanner,
  });

  const nav = useAppNavigation({
    error,
    setError,
    setErrorInfo,
    results: search.results,
    clearSearchResults: search.clearSearchResults,
    setQuery: search.setQuery,
  });

  const discoverVm = useDiscoverViewModel();

  const handleVoiceSearchError = useCallback(
    (message) => {
      showToast(message, {
        title: 'Voice Search',
        icon: 'mic-off-outline',
      });
    },
    [showToast],
  );

  const { listening: voiceListening, toggleVoiceSearch } = useVoiceSearch({
    onTranscript: search.handleQueryChange,
    onError: handleVoiceSearchError,
  });

  const appState = {
    watchlist: watchlistCtl.watchlist,
    query: search.query,
    results: search.results,
    filteredResults: search.filteredResults,
    filter: search.filter,
    setFilter: search.setFilter,
    loading: detail.loading,
    error,
    errorInfo,
    selectedResult: detail.selectedResult,
    recentSearches: search.recentSearches,
    recentViewed: detail.recentViewed,
    homeMediaFilter: nav.homeMediaFilter,
    setHomeMediaFilter: nav.setHomeMediaFilter,
    collectionsSubView: nav.collectionsSubView,
    setCollectionsSubView: nav.setCollectionsSubView,
    collectionsImdbTab: nav.collectionsImdbTab,
    setCollectionsImdbTab: nav.setCollectionsImdbTab,
    typeResults: search.typeResults,
    typeLoading: search.typeLoading,
    filmographyPerson: people.filmographyPerson,
    filmographyResults: people.filmographyResults,
    filmographyLoading: people.filmographyLoading,
    discoverVm,
    surpriseLoading: surprise.surpriseLoading,
    surprisePickerVisible: surprise.surprisePickerVisible,
    setSurprisePickerVisible: surprise.setSurprisePickerVisible,
    offlineBanner,
    setOfflineBanner,
    savedWatchlistKeys: watchlistCtl.savedWatchlistKeys,
    userWatchlistCollections: watchlistCtl.userWatchlistCollections,
    watchlistCollections: watchlistCtl.watchlistCollections,
    voiceListening,
    hasHighlyRecommendedSeeds: watchlistCtl.hasHighlyRecommendedSeeds,
    QUICK_SURPRISE_GENRES,
    handleQueryChange: search.handleQueryChange,
    handleSearch: search.handleSearch,
    handleTypeSelect: search.handleTypeSelect,
    handleSelectMatch: search.handleSelectMatch,
    handleSelectDiscoverItem: search.handleSelectDiscoverItem,
    handleSelectFilmographyItem: people.handleSelectFilmographyItem,
    handleToggleWatchlist: watchlistCtl.handleToggleWatchlist,
    handleEnrichWatchlistItem: watchlistCtl.handleEnrichWatchlistItem,
    handlePersonPress: people.handlePersonPress,
    handleCompanyPress: people.handleCompanyPress,
    handleRemoveWatchlistItem: watchlistCtl.handleRemoveWatchlistItem,
    handleMarkWatched: watchlistCtl.handleMarkWatched,
    handleTabPress: nav.handleTabPress,
    handleSurpriseMe: surprise.handleSurpriseMe,
    handleSurpriseByGenre: surprise.handleSurpriseByGenre,
    toggleVoiceSearch,
    openCollections: nav.openCollections,
    openHomeFromCollections: nav.openHomeFromCollections,
    clearSearchResults: search.clearSearchResults,
    goBack: nav.goBack,
    persistWatchlistChange: watchlistCtl.persistWatchlistChange,
    persistCollectionsChange: watchlistCtl.persistCollectionsChange,
    onNavigationReady: nav.onNavigationReady,
  };

  const shellReady = themeReady && nav.navigationReady;

  return (
    <LaunchGate shellReady={shellReady} themeReady={themeReady}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} translucent />
      <AppStateProvider value={appState}>
        <AppNavigationRoot />
      </AppStateProvider>
    </LaunchGate>
  );
}
