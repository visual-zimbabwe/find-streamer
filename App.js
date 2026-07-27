import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme, ThemeProvider } from './src/theme/ThemeProvider';
import { BottomSheetProvider } from './src/components/StackBottomSheet';
import {
  SearchProvider,
  DiscoverProvider,
  DetailProvider,
  WatchlistProvider,
  PeopleProvider,
  SurpriseProvider,
  NavProvider,
  StatusProvider,
} from './src/context/domainContexts';
import { AppNavigationRoot } from './src/navigation/AppShell';
import { useFonts } from 'expo-font';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
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
import { useHomeSpotlight } from './src/hooks/useHomeSpotlight';
import { useDeepLink } from './src/hooks/useDeepLink';

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

// The keys here become the registered font-family names and MUST match the
// `fonts` map in src/theme/tokens.js. Only the weights imported above are
// bundled by Metro, keeping the asset footprint minimal.
const FONT_MAP = {
  Manrope_700Bold,
  Manrope_800ExtraBold,
  Inter_400Regular,
  Inter_600SemiBold,
};

function MobileApp() {
  const { resolvedMode, ready: themeReady } = useTheme();
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);
  // Don't wedge first paint if a face fails to load — fall back to System.
  const fontsReady = fontsLoaded || Boolean(fontError);

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

  useDeepLink({ openResolvedDetail, navigationReady: nav.navigationReady });

  const homeSpotlight = useHomeSpotlight(watchlistCtl.watchlist, nav.homeMediaFilter);

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

  // Each domain value is memoized independently so a state change in one domain
  // (e.g. a watchlist edit) keeps the others' value references stable, letting
  // React skip re-rendering consumers of the unchanged domains.
  const searchValue = useMemo(
    () => ({
      query: search.query,
      results: search.results,
      filteredResults: search.filteredResults,
      filter: search.filter,
      setFilter: search.setFilter,
      recentSearches: search.recentSearches,
      typeResults: search.typeResults,
      typeLoading: search.typeLoading,
      handleQueryChange: search.handleQueryChange,
      handleSearch: search.handleSearch,
      handleTypeSelect: search.handleTypeSelect,
      handleSelectMatch: search.handleSelectMatch,
      handleSelectDiscoverItem: search.handleSelectDiscoverItem,
      clearSearchResults: search.clearSearchResults,
      voiceListening,
      toggleVoiceSearch,
    }),
    [
      search.query,
      search.results,
      search.filteredResults,
      search.filter,
      search.setFilter,
      search.recentSearches,
      search.typeResults,
      search.typeLoading,
      search.handleQueryChange,
      search.handleSearch,
      search.handleTypeSelect,
      search.handleSelectMatch,
      search.handleSelectDiscoverItem,
      search.clearSearchResults,
      voiceListening,
      toggleVoiceSearch,
    ],
  );

  const discoverValue = useMemo(() => ({ discoverVm }), [discoverVm]);

  const detailValue = useMemo(
    () => ({
      loading: detail.loading,
      selectedResult: detail.selectedResult,
      recentViewed: detail.recentViewed,
    }),
    [detail.loading, detail.selectedResult, detail.recentViewed],
  );

  const watchlistValue = useMemo(
    () => ({
      watchlist: watchlistCtl.watchlist,
      watchlistCollections: watchlistCtl.watchlistCollections,
      userWatchlistCollections: watchlistCtl.userWatchlistCollections,
      savedWatchlistKeys: watchlistCtl.savedWatchlistKeys,
      hasHighlyRecommendedSeeds: watchlistCtl.hasHighlyRecommendedSeeds,
      handleToggleWatchlist: watchlistCtl.handleToggleWatchlist,
      handleEnrichWatchlistItem: watchlistCtl.handleEnrichWatchlistItem,
      handleRemoveWatchlistItem: watchlistCtl.handleRemoveWatchlistItem,
      handleMarkWatched: watchlistCtl.handleMarkWatched,
      persistWatchlistChange: watchlistCtl.persistWatchlistChange,
      persistCollectionsChange: watchlistCtl.persistCollectionsChange,
    }),
    [
      watchlistCtl.watchlist,
      watchlistCtl.watchlistCollections,
      watchlistCtl.userWatchlistCollections,
      watchlistCtl.savedWatchlistKeys,
      watchlistCtl.hasHighlyRecommendedSeeds,
      watchlistCtl.handleToggleWatchlist,
      watchlistCtl.handleEnrichWatchlistItem,
      watchlistCtl.handleRemoveWatchlistItem,
      watchlistCtl.handleMarkWatched,
      watchlistCtl.persistWatchlistChange,
      watchlistCtl.persistCollectionsChange,
    ],
  );

  const peopleValue = useMemo(
    () => ({
      filmographyPerson: people.filmographyPerson,
      filmographyResults: people.filmographyResults,
      filmographyLoading: people.filmographyLoading,
      handleSelectFilmographyItem: people.handleSelectFilmographyItem,
      handlePersonPress: people.handlePersonPress,
      handleCompanyPress: people.handleCompanyPress,
      handleCollectionPress: people.handleCollectionPress,
    }),
    [
      people.filmographyPerson,
      people.filmographyResults,
      people.filmographyLoading,
      people.handleSelectFilmographyItem,
      people.handlePersonPress,
      people.handleCompanyPress,
      people.handleCollectionPress,
    ],
  );

  const surpriseValue = useMemo(
    () => ({
      surpriseLoading: surprise.surpriseLoading,
      surprisePickerVisible: surprise.surprisePickerVisible,
      setSurprisePickerVisible: surprise.setSurprisePickerVisible,
      handleSurpriseMe: surprise.handleSurpriseMe,
      handleSurpriseByGenre: surprise.handleSurpriseByGenre,
      QUICK_SURPRISE_GENRES,
    }),
    [
      surprise.surpriseLoading,
      surprise.surprisePickerVisible,
      surprise.setSurprisePickerVisible,
      surprise.handleSurpriseMe,
      surprise.handleSurpriseByGenre,
    ],
  );

  const navValue = useMemo(
    () => ({
      homeMediaFilter: nav.homeMediaFilter,
      setHomeMediaFilter: nav.setHomeMediaFilter,
      collectionsSubView: nav.collectionsSubView,
      setCollectionsSubView: nav.setCollectionsSubView,
      collectionsImdbTab: nav.collectionsImdbTab,
      setCollectionsImdbTab: nav.setCollectionsImdbTab,
      goBack: nav.goBack,
      handleTabPress: nav.handleTabPress,
      openCollections: nav.openCollections,
      openHomeFromCollections: nav.openHomeFromCollections,
      onNavigationReady: nav.onNavigationReady,
      homeSpotlightItems: homeSpotlight.homeSpotlightItems,
      homeSpotlightCache: homeSpotlight.homeSpotlightCache,
    }),
    [
      nav.homeMediaFilter,
      nav.setHomeMediaFilter,
      nav.collectionsSubView,
      nav.setCollectionsSubView,
      nav.collectionsImdbTab,
      nav.setCollectionsImdbTab,
      nav.goBack,
      nav.handleTabPress,
      nav.openCollections,
      nav.openHomeFromCollections,
      nav.onNavigationReady,
      homeSpotlight.homeSpotlightItems,
      homeSpotlight.homeSpotlightCache,
    ],
  );

  const statusValue = useMemo(
    () => ({ error, errorInfo, offlineBanner, setOfflineBanner }),
    [error, errorInfo, offlineBanner, setOfflineBanner],
  );

  const shellReady = themeReady && nav.navigationReady && fontsReady;
  // Mount the shell only once fonts+theme resolve, so its first layout measures
  // text with the real font metrics (T1). navigationReady is excluded on
  // purpose — see LaunchGate.
  const contentReady = themeReady && fontsReady;

  return (
    <LaunchGate shellReady={shellReady} contentReady={contentReady} themeReady={themeReady}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} translucent />
      <StatusProvider value={statusValue}>
        <NavProvider value={navValue}>
          <SearchProvider value={searchValue}>
            <DiscoverProvider value={discoverValue}>
              <DetailProvider value={detailValue}>
                <WatchlistProvider value={watchlistValue}>
                  <PeopleProvider value={peopleValue}>
                    <SurpriseProvider value={surpriseValue}>
                      <AppNavigationRoot />
                    </SurpriseProvider>
                  </PeopleProvider>
                </WatchlistProvider>
              </DetailProvider>
            </DiscoverProvider>
          </SearchProvider>
        </NavProvider>
      </StatusProvider>
    </LaunchGate>
  );
}
