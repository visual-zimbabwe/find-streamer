import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Modal, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { AppHeader } from '../components/AppHeader';
import { BottomNav } from '../components/BottomNav';
import { StatePanel } from '../components/StatePanel';
import { ErrorBanner } from '../components/ErrorBanner';
import { BottomSheetPortal } from '../components/StackBottomSheet';
import {
  useDetail,
  useStatus,
  useSearch,
  useNav,
  useSurprise,
  useWatchlist,
} from '../context/domainContexts';
import { RootTabs } from './RootTabs';
import { navigationRef, getFocusedRouteName, getCurrentTabId, canStackPop } from './navigationRef';
import { buildNavigationTheme } from './navigationTheme';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';

const ROUTE_TO_VIEW = {
  Home: 'home',
  Collections: 'collections',
  Detail: 'detail',
  Filmography: 'filmography',
  Search: 'search',
  Discover: 'discover',
  Watchlist: 'watchlist',
  Settings: 'settings',
};

const IMMERSIVE_ROUTES = new Set(['Home', 'Collections', 'Detail', 'Filmography']);
/** Tool tabs use ProgrammeSectionHeader — no AppHeader wordmark on top. */
const TOOL_TAB_ROUTES = new Set(['Search', 'Discover', 'Watchlist', 'Settings']);

function AppShellInner({ rootNavState }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const { loading } = useDetail();
  const { error, errorInfo, offlineBanner, setOfflineBanner } = useStatus();
  const { handleSearch, query } = useSearch();
  const { goBack, handleTabPress } = useNav();
  const {
    surprisePickerVisible,
    setSurprisePickerVisible,
    surpriseLoading,
    handleSurpriseMe,
    handleSurpriseByGenre,
    QUICK_SURPRISE_GENRES,
  } = useSurprise();
  const { hasHighlyRecommendedSeeds } = useWatchlist();

  const activeTab = getCurrentTabId(rootNavState);
  const focusedRoute = getFocusedRouteName(rootNavState);
  const stackCanPop = canStackPop(rootNavState);

  const activeView = ROUTE_TO_VIEW[focusedRoute] || 'home';
  const showAppHeader =
    !IMMERSIVE_ROUTES.has(focusedRoute) &&
    !TOOL_TAB_ROUTES.has(focusedRoute) &&
    stackCanPop;
  const showBack = stackCanPop;
  // In-tab flows (search submit, filmography → title) use local loaders; never unmount tabs.
  const showLoading =
    loading &&
    activeView !== 'detail' &&
    activeView !== 'discover' &&
    activeView !== 'home' &&
    activeView !== 'collections' &&
    activeView !== 'search' &&
    activeView !== 'filmography';

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
        {showLoading && (
          <View style={[styles.mainOverlay, { backgroundColor: colors.background }]}>
            <StatePanel
              type="loading"
              title="Searching..."
              description="Please wait while we find your movie."
            />
          </View>
        )}
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

      <Modal
        visible={surprisePickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSurprisePickerVisible(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.categorySheet,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant + '4D',
                  borderRadius: radii.xl,
                },
              ]}
            >
              <View style={styles.categoryHeader}>
                <View style={styles.categoryTitleBlock}>
                  <Text
                    style={[styles.categoryEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}
                  >
                    Surprise Roulette
                  </Text>
                  <Text
                    style={[
                      styles.categoryTitle,
                      { color: colors.onSurface, ...typography.titleLg },
                    ]}
                  >
                    Surprise Me
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: colors.surfaceContainerHighest }]}
                  onPress={() => setSurprisePickerVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close surprise picker"
                >
                  <Ionicons name="close" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.surpriseQuickBtn,
                  {
                    backgroundColor: hasHighlyRecommendedSeeds
                      ? GOLD_ACCENT + '18'
                      : colors.surfaceContainerHigh,
                    borderColor: hasHighlyRecommendedSeeds ? GOLD_ACCENT + '55' : GOLD_DIM,
                    borderRadius: radii.lg,
                  },
                ]}
                onPress={() => {
                  setSurprisePickerVisible(false);
                  handleSurpriseMe();
                }}
                disabled={!hasHighlyRecommendedSeeds}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Surprise me based on my favorites"
              >
                <Ionicons
                  name="heart-outline"
                  size={20}
                  color={hasHighlyRecommendedSeeds ? GOLD_ACCENT : colors.onSurfaceVariant}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[
                      {
                        color: hasHighlyRecommendedSeeds ? GOLD_ACCENT : colors.onSurface,
                        fontWeight: '800',
                        ...typography.bodyLg,
                      },
                    ]}
                  >
                    Based on My Favorites
                  </Text>
                  <Text
                    style={[
                      { color: colors.onSurfaceVariant, ...typography.labelSm, marginTop: 2 },
                    ]}
                  >
                    {hasHighlyRecommendedSeeds
                      ? 'Picks from your Highly Recommend list'
                      : 'Add to Highly Recommend to unlock'}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={hasHighlyRecommendedSeeds ? GOLD_ACCENT : colors.onSurfaceVariant}
                />
              </TouchableOpacity>

              <View style={styles.surpriseDivider}>
                <View
                  style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: GOLD_DIM }}
                />
                <Text
                  style={[
                    {
                      color: colors.onSurfaceVariant,
                      ...typography.labelSm,
                      marginHorizontal: 12,
                      fontWeight: '700',
                      letterSpacing: 1.1,
                      paddingEnd: 2,
                      textTransform: 'uppercase',
                    },
                  ]}
                >
                  Or Pick a Genre
                </Text>
                <View
                  style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: GOLD_DIM }}
                />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
                <View style={styles.genreGrid}>
                  {QUICK_SURPRISE_GENRES.map((genre) => (
                    <TouchableOpacity
                      key={`${genre.id}-${genre.mediaType}`}
                      style={[
                        styles.genreChip,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: GOLD_DIM,
                          borderRadius: radii.lg,
                        },
                      ]}
                      onPress={() => handleSurpriseByGenre(genre.id, genre.mediaType)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Surprise me with ${genre.label}`}
                    >
                      <Text
                        style={[
                          {
                            color: colors.onSurface,
                            fontWeight: '800',
                            textAlign: 'center',
                            letterSpacing: 0.6,
                            paddingEnd: 2,
                            textTransform: 'uppercase',
                            fontSize: 12,
                            ...typography.bodyMd,
                          },
                        ]}
                      >
                        {genre.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      <ErrorBanner
        placement="top"
        title={offlineBanner?.title}
        message={offlineBanner?.message}
        icon="cloud-offline-outline"
        onDismiss={() => setOfflineBanner(null)}
      />

      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} fixed={bottomNavFixed} />
      <BottomSheetPortal />
    </View>
  );
}

export function AppNavigationRoot() {
  const { onNavigationReady } = useNav();
  const { resolvedMode } = useTheme();
  const [rootNavState, setRootNavState] = useState(() => {
    return navigationRef.isReady() ? navigationRef.getRootState() : null;
  });

  const navigationTheme = useMemo(() => buildNavigationTheme(resolvedMode), [resolvedMode]);

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
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
    paddingEnd: 2,
    textTransform: 'uppercase',
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
});
