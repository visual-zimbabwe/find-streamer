import { useState, useEffect, useCallback } from 'react';
import { BackHandler } from 'react-native';
import {
  navigationRef,
  getFocusedRouteName,
  getCurrentTabId,
  navigateToTabRoot,
} from '../navigation/navigationRef';

/**
 * Owns navigation-adjacent UI state (home media filter, collections sub-view +
 * IMDb tab, navigation-ready flag) and the back-navigation logic, including the
 * Android hardware back handler.
 *
 * @param {{
 *   error: string | null,
 *   setError: (value: string | null) => void,
 *   setErrorInfo: (value: object | null) => void,
 *   results: object[],
 *   clearSearchResults: () => void,
 *   setQuery: (value: string) => void,
 * }} deps
 */
export function useAppNavigation({
  error,
  setError,
  setErrorInfo,
  results,
  clearSearchResults,
  setQuery,
}) {
  const [navigationReady, setNavigationReady] = useState(false);
  const [homeMediaFilter, setHomeMediaFilter] = useState(null); // 'movie' | 'tv' | null
  const [collectionsSubView, setCollectionsSubView] = useState('franchises');
  const [collectionsImdbTab, setCollectionsImdbTab] = useState('movie');

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
  }, [
    error,
    results.length,
    collectionsSubView,
    clearSearchResults,
    setError,
    setErrorInfo,
    setQuery,
  ]);

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
        tabId === 'search' &&
        focusedRoute === 'Search' &&
        !error &&
        !stackCanPop &&
        results.length === 0;
      if (atHomeRoot || atSearchRoot) {
        return false;
      }

      goBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [error, goBack, results.length]);

  const handleTabPress = useCallback((tab) => {
    if (tab === 'home') {
      setHomeMediaFilter(null);
    }
    navigateToTabRoot(tab);
  }, []);

  const onNavigationReady = useCallback(() => {
    setNavigationReady(true);
  }, []);

  return {
    navigationReady,
    homeMediaFilter,
    setHomeMediaFilter,
    collectionsSubView,
    setCollectionsSubView,
    collectionsImdbTab,
    setCollectionsImdbTab,
    goBack,
    handleTabPress,
    openCollections,
    openHomeFromCollections,
    onNavigationReady,
  };
}
