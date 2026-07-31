import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { AppHeader } from '../components/AppHeader';
import { BottomNav } from '../components/BottomNav';
import { StatePanel } from '../components/StatePanel';
import { ErrorBanner } from '../components/ErrorBanner';
import { BottomSheetPortal } from '../components/StackBottomSheet';
import { useStatus, useSearch, useNav } from '../context/domainContexts';
import { RootTabs } from './RootTabs';
import { navigationRef, getFocusedRouteName, getCurrentTabId, canStackPop } from './navigationRef';
import { navigationTheme } from './navigationTheme';

const IMMERSIVE_ROUTES = new Set(['Home', 'Collections', 'Detail', 'FullCast', 'Filmography']);
/** Tool tabs use ProgrammeSectionHeader — no AppHeader wordmark on top. */
const TOOL_TAB_ROUTES = new Set(['Search', 'Discover', 'Settings']);

function AppShellInner({ rootNavState }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const { error, errorInfo, offlineBanner, setOfflineBanner } = useStatus();
  const { handleSearch, query, requestSearchFocus } = useSearch();
  const { goBack, handleTabPress } = useNav();

  const activeTab = getCurrentTabId(rootNavState);
  const focusedRoute = getFocusedRouteName(rootNavState);
  const stackCanPop = canStackPop(rootNavState);

  // Pressing Search while already on the Search root focuses the field instead
  // of re-navigating to a screen the user is already looking at. From anywhere
  // else — another tab, or a Detail inside this stack — it still just navigates.
  const onTabPress = useCallback(
    (tab) => {
      if (tab === 'search' && activeTab === 'search' && focusedRoute === 'Search') {
        requestSearchFocus();
        return;
      }
      handleTabPress(tab);
    },
    [activeTab, focusedRoute, handleTabPress, requestSearchFocus],
  );

  const showAppHeader =
    !IMMERSIVE_ROUTES.has(focusedRoute) && !TOOL_TAB_ROUTES.has(focusedRoute) && stackCanPop;
  const showBack = stackCanPop;
  // No full-screen loading overlay: opening a title pushes the Detail screen on
  // the tap and fills it in there, and a search submit is reported by the search
  // panel's own inline loader. The overlay this replaced was excluded from six of
  // the eight views precisely because it was answering two different questions.

  const bottomNavFixed = activeTab === 'search' && focusedRoute === 'Search';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showAppHeader && (
        <View style={{ paddingTop: insets.top }}>
          <AppHeader showBack={showBack} onBack={goBack} centeredTitleOnly />
        </View>
      )}

      <View style={styles.mainContent}>
        <RootTabs />
        {error && (
          <View style={[styles.mainOverlay, { backgroundColor: colors.background }]}>
            <StatePanel
              type={
                errorInfo?.severity === 'offline'
                  ? 'offline'
                  : errorInfo?.severity === 'service'
                    ? 'service'
                    : 'error'
              }
              title={errorInfo?.title || 'Search Error'}
              description={error}
              onRetry={() => handleSearch(query)}
              actionLabel="Refresh"
            />
          </View>
        )}
      </View>

      <ErrorBanner
        placement="top"
        title={offlineBanner?.title}
        message={offlineBanner?.message}
        icon="cloud-offline-outline"
        onDismiss={() => setOfflineBanner(null)}
      />

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} fixed={bottomNavFixed} />
      <BottomSheetPortal />
    </View>
  );
}

export function AppNavigationRoot() {
  const { onNavigationReady } = useNav();
  const [rootNavState, setRootNavState] = useState(() => {
    return navigationRef.isReady() ? navigationRef.getRootState() : null;
  });

  const syncNavState = useCallback((state) => {
    const newState = state ?? (navigationRef.isReady() ? navigationRef.getRootState() : null);
    setRootNavState(newState);
  }, []);

  const handleReady = useCallback(() => {
    syncNavState();
    onNavigationReady?.();
  }, [onNavigationReady, syncNavState]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={handleReady}
      onStateChange={syncNavState}
    >
      <AppShellInner rootNavState={rootNavState} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  mainOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
