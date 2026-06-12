import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';
import { useBottomNavVisibility } from '../context/BottomNavVisibilityContext';
import { scale } from '../utils/responsive';

const GOLD_ACCENT = '#D4A853';
const GOLD_RULE = 'rgba(212, 168, 83, 0.55)';
const SCREEN_W = Dimensions.get('window').width;

const TABS = [
  { id: 'home',      label: 'Home',      icon: 'home-outline',     iconActive: 'home'     },
  { id: 'search',    label: 'Search',    icon: 'search-outline',   iconActive: 'search'   },
  { id: 'discover',  label: 'Discover',  icon: 'options-outline',  iconActive: 'options'  },
  { id: 'watchlist', label: 'Watchlist', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { id: 'settings',  label: 'Settings',  icon: 'settings-outline', iconActive: 'settings'  },
];

const TAB_COUNT = TABS.length;
const TAB_W = SCREEN_W / TAB_COUNT;
const INDICATOR_W = scale(44);
const MARQUEE_ROW_H = scale(54);

export function BottomNav({ activeTab, onTabPress, fixed = false }) {
  const { theme } = useTheme();
  const { typography } = theme;
  const insets = useSafeAreaInsets();
  const { visible } = useBottomNavVisibility();
  const isDark = theme.mode === 'dark';

  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === activeTab));
  const shellH = MARQUEE_ROW_H + insets.bottom;

  const translateY = useRef(new Animated.Value(0)).current;
  const indicatorX = useRef(new Animated.Value(tabIndicatorX(activeIndex))).current;
  const labelOpacity = useRef(TABS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: fixed || visible ? 0 : shellH + 8,
      useNativeDriver: true,
      damping: 28,
      stiffness: 260,
      mass: 0.9,
    }).start();
  }, [fixed, visible, translateY, shellH]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(indicatorX, {
        toValue: tabIndicatorX(activeIndex),
        duration: 280,
        useNativeDriver: true,
      }),
      ...TABS.map((_, i) =>
        Animated.timing(labelOpacity[i], {
          toValue: i === activeIndex ? 1 : 0,
          duration: i === activeIndex ? 220 : 140,
          useNativeDriver: true,
        })
      ),
    ]).start();
  }, [activeIndex, indicatorX, labelOpacity]);

  const marqueeGlass = isDark ? 'rgba(12, 12, 14, 0.97)' : 'rgba(247, 247, 242, 0.97)';
  const inactiveColor = isDark ? 'rgba(245, 245, 247, 0.42)' : 'rgba(97, 100, 109, 0.72)';

  return (
    <Animated.View
      style={[
        styles.marqueeRoot,
        {
          height: shellH,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.marqueeShell,
          {
            height: shellH,
            backgroundColor: Platform.OS === 'android' ? marqueeGlass : 'transparent',
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 78 : 62}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}

        <View style={styles.goldRule} pointerEvents="none" />

        <View style={[styles.tabRow, { height: MARQUEE_ROW_H }]}>
          {TABS.map((tab, i) => {
            const selected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={styles.tabCell}
                onPress={() => {
                  Haptics.selectionAsync();
                  onTabPress(tab.id);
                }}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
              >
                <View style={[styles.tabCellInner, selected && styles.tabCellInnerActive]}>
                  <Ionicons
                    name={selected ? tab.iconActive : tab.icon}
                    size={selected ? scale(20) : scale(22)}
                    color={selected ? GOLD_ACCENT : inactiveColor}
                  />
                  {selected ? (
                    <Animated.View style={[styles.labelWrap, { opacity: labelOpacity[i] }]}>
                      <Text
                        style={[styles.tabLabel, typography.labelSm, styles.tabLabelActive]}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          <Animated.View
            style={[
              styles.slidingIndicator,
              { width: INDICATOR_W, transform: [{ translateX: indicatorX }] },
            ]}
            pointerEvents="none"
          />
        </View>

        <View style={{ height: insets.bottom }} />
      </View>
    </Animated.View>
  );
}

function tabIndicatorX(index) {
  return index * TAB_W + (TAB_W - INDICATOR_W) / 2;
}

const styles = StyleSheet.create({
  marqueeRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  marqueeShell: {
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  goldRule: {
    position: 'absolute',
    left: scale(22),
    right: scale(22),
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GOLD_RULE,
    zIndex: 2,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  tabCell: {
    width: TAB_W,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCellInner: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  tabCellInnerActive: {
    paddingTop: scale(2),
  },
  labelWrap: {
    marginTop: scale(2),
  },
  tabLabel: {
    fontSize: scale(9),
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: GOLD_ACCENT,
    fontWeight: '800',
  },
  slidingIndicator: {
    position: 'absolute',
    bottom: scale(7),
    left: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD_ACCENT,
  },
});
