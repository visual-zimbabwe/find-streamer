import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { BottomSheetProvider } from './src/components/StackBottomSheet';
import {
  SearchProvider,
  DiscoverProvider,
  DetailProvider,
  WatchlistProvider,
  PeopleProvider,
  NavProvider,
  StatusProvider,
} from './src/context/domainContexts';
import { AppNavigationRoot } from './src/navigation/AppShell';
import { useFonts } from 'expo-font';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display';
import { useDiscoverViewModel } from './src/lib/discoverViewModel';
import { ToastivaProvider } from 'toastiva';
import { BottomNavVisibilityProvider } from './src/context/BottomNavVisibilityContext';
import { LaunchGate } from './src/components/LaunchGate';
import { useToast } from './src/hooks/useToast';
import { useRequestError } from './src/hooks/useRequestError';
import { useWatchlistController } from './src/hooks/useWatchlistController';
import { useDetailController } from './src/hooks/useDetailController';
import { usePeopleController } from './src/hooks/usePeopleController';
import { useSearchController } from './src/hooks/useSearchController';
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

// The keys here become the registered font-family names and MUST match the
// `fonts` map in src/theme/tokens.js. Only the weights imported above are
// bundled by Metro, keeping the asset footprint minimal.
const FONT_MAP = {
  Manrope_700Bold,
  Manrope_800ExtraBold,
  Inter_400Regular,
  Inter_600SemiBold,
  // The "Trova" logotype face (theme `fonts.wordmark`). Bundled so the launch
  // intro and in-app wordmarks stop rendering the device system serif. Included
  // in the gate's `fontsReady` so the shell's wordmarks measure with real
  // metrics on first layout.
  PlayfairDisplay_700Bold_Italic,
};

function MobileApp() {
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
  const { openResolvedDetail } = detail;

  const people = usePeopleController({
    openResolvedDetail,
    handleRequestError,
    setOfflineBanner,
  });
  const { handlePersonPress } = people;

  const search = useSearchController({
    openResolvedDetail,
    handlePersonPress,
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

  // Each domain value is memoized independently so a state change in one domain
  // (e.g. a watchlist edit) keeps the others' value references stable, letting
  // React skip re-rendering consumers of the unchanged domains.
  const searchValue = useMemo(
    () => ({
      loading: search.loading,
      query: search.query,
      results: search.results,
      searchPhase: search.searchPhase,
      searchError: search.searchError,
      submittedQuery: search.submittedQuery,
      typeResults: search.typeResults,
      typeLoading: search.typeLoading,
      searchFocusSignal: search.searchFocusSignal,
      requestSearchFocus: search.requestSearchFocus,
      handleQueryChange: search.handleQueryChange,
      handleSearch: search.handleSearch,
      handleTypeSelect: search.handleTypeSelect,
      handleSelectMatch: search.handleSelectMatch,
      handleSelectDiscoverItem: search.handleSelectDiscoverItem,
      clearSearchResults: search.clearSearchResults,
      clearSearch: search.clearSearch,
    }),
    [
      search.loading,
      search.query,
      search.results,
      search.searchPhase,
      search.searchError,
      search.submittedQuery,
      search.typeResults,
      search.typeLoading,
      search.searchFocusSignal,
      search.requestSearchFocus,
      search.handleQueryChange,
      search.handleSearch,
      search.handleTypeSelect,
      search.handleSelectMatch,
      search.handleSelectDiscoverItem,
      search.clearSearchResults,
      search.clearSearch,
    ],
  );

  const discoverValue = useMemo(() => ({ discoverVm }), [discoverVm]);

  const detailValue = useMemo(
    () => ({
      // One entry per pushed screen, keyed by push id — never a single shared
      // `selectedResult`, which used to make every Detail below the top of the
      // stack render the topmost one's title.
      details: detail.details,
      recentViewed: detail.recentViewed,
      removeRecentViewed: detail.removeRecentViewed,
      clearRecentViewed: detail.clearRecentViewed,
      releaseDetail: detail.releaseDetail,
      retryDetail: detail.retryDetail,
    }),
    [
      detail.details,
      detail.recentViewed,
      detail.removeRecentViewed,
      detail.clearRecentViewed,
      detail.releaseDetail,
      detail.retryDetail,
    ],
  );

  const watchlistValue = useMemo(
    () => ({
      watchlist: watchlistCtl.watchlist,
      watchlistCollections: watchlistCtl.watchlistCollections,
      userWatchlistCollections: watchlistCtl.userWatchlistCollections,
      savedWatchlistKeys: watchlistCtl.savedWatchlistKeys,
      handleToggleWatchlist: watchlistCtl.handleToggleWatchlist,
      handleEnrichWatchlistItem: watchlistCtl.handleEnrichWatchlistItem,
      handleRemoveWatchlistItem: watchlistCtl.handleRemoveWatchlistItem,
      handleMarkWatched: watchlistCtl.handleMarkWatched,
      handleRenameCollection: watchlistCtl.handleRenameCollection,
      handleDeleteCollection: watchlistCtl.handleDeleteCollection,
      persistWatchlistChange: watchlistCtl.persistWatchlistChange,
      persistCollectionsChange: watchlistCtl.persistCollectionsChange,
    }),
    [
      watchlistCtl.watchlist,
      watchlistCtl.watchlistCollections,
      watchlistCtl.userWatchlistCollections,
      watchlistCtl.savedWatchlistKeys,
      watchlistCtl.handleToggleWatchlist,
      watchlistCtl.handleEnrichWatchlistItem,
      watchlistCtl.handleRemoveWatchlistItem,
      watchlistCtl.handleMarkWatched,
      watchlistCtl.handleRenameCollection,
      watchlistCtl.handleDeleteCollection,
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

  const shellReady = nav.navigationReady && fontsReady;
  // Mount the shell only once the fonts resolve, so its first layout measures
  // text with the real font metrics (T1). navigationReady is excluded on
  // purpose — see LaunchGate. The theme no longer participates: it is a
  // constant now, so there is nothing to wait for.
  const contentReady = fontsReady;

  return (
    <LaunchGate shellReady={shellReady} contentReady={contentReady}>
      <StatusBar style="light" translucent />
      <StatusProvider value={statusValue}>
        <NavProvider value={navValue}>
          <SearchProvider value={searchValue}>
            <DiscoverProvider value={discoverValue}>
              <DetailProvider value={detailValue}>
                <WatchlistProvider value={watchlistValue}>
                  <PeopleProvider value={peopleValue}>
                    <AppNavigationRoot />
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
