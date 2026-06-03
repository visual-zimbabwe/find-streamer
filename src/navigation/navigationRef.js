import { createNavigationContainerRef, StackActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const TAB_ROOT_SCREEN = {
  home: 'Home',
  search: 'Search',
  discover: 'Discover',
  watchlist: 'Watchlist',
  settings: 'Settings',
};

/** Deepest focused route name in the navigation tree. */
export function getFocusedRouteName(state) {
  const currentState = state || (navigationRef.isReady() ? navigationRef.getRootState() : null);
  if (!currentState) return 'Home';
  const route = currentState.routes[currentState.index];
  if (route.state) {
    return getFocusedRouteName(route.state);
  }
  return route.name;
}

export function getCurrentTabId(state) {
  const currentState = state || (navigationRef.isReady() ? navigationRef.getRootState() : null);
  if (!currentState?.routes?.length) return 'home';
  return currentState.routes[currentState.index].name;
}

export function canStackPop(state) {
  const currentState = state || (navigationRef.isReady() ? navigationRef.getRootState() : null);
  const tabRoute = currentState?.routes?.[currentState.index];
  const stack = tabRoute?.state;
  return Boolean(stack && stack.index > 0);
}

export function navigateToTabRoot(tabId) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(tabId, { screen: TAB_ROOT_SCREEN[tabId] });
}

/** Push onto the active tab's native stack (preserves deep chains: Detail → Filmography → Detail). */
export function pushOnCurrentTab(screenName, params) {
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState();
  const tabId = getCurrentTabId(state);
  pushOnTab(tabId, screenName, params);
}

/** Push onto a specific tab's native stack by explicit tabId (avoids timing issues with getCurrentTabId). */
export function pushOnTab(tabId, screenName, params) {
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState();
  const tabRoute = state.routes.find((r) => r.name === tabId);
  const stackKey = tabRoute?.state?.key;

  if (stackKey) {
    navigationRef.dispatch({
      ...StackActions.push(screenName, params),
      target: stackKey,
    });
    return;
  }

  navigationRef.navigate(tabId, { screen: screenName, params });
}
