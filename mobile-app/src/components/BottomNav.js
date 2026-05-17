import React, { useRef, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';
import { useBottomNavVisibility } from '../context/BottomNavVisibilityContext';

const TABS = [
  { id: 'home',      label: 'Home',      icon: 'home-outline',     iconActive: 'home'     },
  { id: 'search',    label: 'Search',    icon: 'search-outline',   iconActive: 'search'   },
  { id: 'discover',  label: 'Discover',  icon: 'options-outline',  iconActive: 'options'  },
  { id: 'watchlist', label: 'Watchlist', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { id: 'settings',  label: 'Settings',  icon: 'settings-outline', iconActive: 'settings'  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_HORIZONTAL_MARGIN = 20;
const CONTAINER_WIDTH = SCREEN_WIDTH - CONTAINER_HORIZONTAL_MARGIN * 2;
const TAB_COUNT = TABS.length;
const TAB_WIDTH = CONTAINER_WIDTH / TAB_COUNT;

// Pill spans each tab column with a small inset on each side
const PILL_H_INSET = 6;
const PILL_WIDTH = TAB_WIDTH - PILL_H_INSET * 2;
const PILL_HEIGHT = 44;
const PILL_TOP_OFFSET = 12; // Centered vertically in 68px container

function getPillX(index) {
  return index * TAB_WIDTH + PILL_H_INSET;
}

export function BottomNav({ activeTab, onTabPress }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const { visible } = useBottomNavVisibility();

  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  // Animated value for the pill's horizontal position
  const pillX = useRef(new Animated.Value(getPillX(Math.max(activeIndex, 0)))).current;

  // Animated value for entire bottom nav translation (hide/show on scroll)
  const translateY = useRef(new Animated.Value(0)).current;

  // Per-tab animated values: scale + vertical float
  const tabAnims = useRef(
    TABS.map(() => ({
      scale: new Animated.Value(1),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0.55),
    }))
  ).current;

  // Track scroll-triggered show/hide animation
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 150, // Translate completely off-screen (150px)
      useNativeDriver: true,
      damping: 24,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (activeIndex === -1) return;

    // 1. Slide pill to active tab
    Animated.spring(pillX, {
      toValue: getPillX(activeIndex),
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
    }).start();

    // 2. Animate each tab icon
    TABS.forEach((_, i) => {
      const isActive = i === activeIndex;
      Animated.parallel([
        // Scale bounce
        Animated.spring(tabAnims[i].scale, {
          toValue: isActive ? 1.18 : 1,
          useNativeDriver: true,
          damping: 10,
          stiffness: 200,
          mass: 0.7,
        }),
        // Float up
        Animated.spring(tabAnims[i].translateY, {
          toValue: isActive ? -2 : 0,
          useNativeDriver: true,
          damping: 12,
          stiffness: 180,
        }),
        // Fade inactive tabs down
        Animated.timing(tabAnims[i].opacity, {
          toValue: isActive ? 1 : 0.45,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [activeIndex]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.background + 'cc',
          borderColor: colors.outlineVariant + '2A',
          bottom: insets.bottom > 0 ? insets.bottom + 8 : 16,
          borderRadius: radii.xl + 6,
          transform: [{ translateY }],
        },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 85}
        tint={colors.background === '#121212' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Sliding pill ─────────────────────────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          {
            backgroundColor: colors.primaryContainer,
            borderRadius: radii.lg + 4,
            top: PILL_TOP_OFFSET,
            width: PILL_WIDTH,
            height: PILL_HEIGHT,
            transform: [{ translateX: pillX }],
          },
        ]}
      />

      {/* ── Tab items ─────────────────────────────────────────── */}
      {TABS.map((tab, i) => {
        const selected = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={styles.navItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTabPress(tab.id);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
          >
            <Animated.View
              style={{
                alignItems: 'center',
                opacity: tabAnims[i].opacity,
                transform: [
                  { scale: tabAnims[i].scale },
                  { translateY: tabAnims[i].translateY },
                ],
              }}
            >
              <Ionicons
                name={selected ? tab.iconActive : tab.icon}
                size={22}
                color={selected ? colors.primary : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.navLabel,
                  typography.labelSm,
                  { color: selected ? colors.primary : colors.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: CONTAINER_HORIZONTAL_MARGIN,
    right: CONTAINER_HORIZONTAL_MARGIN,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 1000,
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    left: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 68,
  },
  navLabel: {
    marginTop: 4,
    fontWeight: '600',
  },
});

