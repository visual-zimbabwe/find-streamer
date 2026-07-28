import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';
import { useBottomNavVisibility } from '../context/BottomNavVisibilityContext';
import { scale } from '../utils/responsive';
import { GOLD_ACCENT, GOLD_RULE, FADE_MS } from '../theme/programme';
const SCREEN_W = Dimensions.get('window').width;

const TABS = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { id: 'search', label: 'Search', icon: 'search-outline', iconActive: 'search' },
  { id: 'discover', label: 'Discover', icon: 'options-outline', iconActive: 'options' },
  { id: 'watchlist', label: 'Watchlist', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

const TAB_COUNT = TABS.length;
const TAB_W = SCREEN_W / TAB_COUNT;
const INDICATOR_W = scale(44);
const MARQUEE_ROW_H = scale(54);
const INDICATOR_MS = 280;
const LABEL_MS = 220;
const EASE_INDICATOR = Easing.out(Easing.cubic);

export function BottomNav({ activeTab, onTabPress, fixed = false }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const insets = useSafeAreaInsets();
  const { visible } = useBottomNavVisibility();

  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.id === activeTab),
  );
  const shellH = MARQUEE_ROW_H + insets.bottom;

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: fixed || visible ? 0 : shellH + 8,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [fixed, visible, translateY, shellH]);

  // The indicator rides a shared value rather than an RN `Animated.Value`. Under
  // Fabric the native driver never writes back to the JS value, so every commit
  // re-applied the stale start offset — and an `Animated.parallel` over all five
  // label values self-cancelled on restart, because `stopTogether` makes the old
  // group stop whichever animation currently owns each value, i.e. the new one.
  const indicatorIndex = useSharedValue(activeIndex);

  useEffect(() => {
    indicatorIndex.value = withTiming(activeIndex, {
      duration: INDICATOR_MS,
      easing: EASE_INDICATOR,
    });
  }, [activeIndex, indicatorIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorIndex.value * TAB_W + (TAB_W - INDICATOR_W) / 2 }],
  }));

  const marqueeGlass = colors.glass;
  const inactiveColor = 'rgba(245, 245, 247, 0.42)';

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
            borderTopColor: 'rgba(255,255,255,0.06)',
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={78}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}

        <View style={styles.goldRule} pointerEvents="none" />

        <View style={[styles.tabRow, { height: MARQUEE_ROW_H }]}>
          {TABS.map((tab) => {
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
                    <TabLabel
                      label={tab.label}
                      textStyle={[styles.tabLabel, typography.labelSm, styles.tabLabelActive]}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          <Reanimated.View
            style={[styles.slidingIndicator, { width: INDICATOR_W }, indicatorStyle]}
            pointerEvents="none"
          />
        </View>

        <View style={{ height: insets.bottom }} />
      </View>
    </Animated.View>
  );
}

/**
 * Only the active tab renders a label, so each one mounts fresh and can own its
 * fade-in outright — no array of opacity values shared across tabs, and nothing
 * to animate on behalf of a view that isn't on screen.
 */
function TabLabel({ label, textStyle }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: LABEL_MS });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Reanimated.View style={[styles.labelWrap, animatedStyle]}>
      <Text style={textStyle} numberOfLines={1}>
        {label}
      </Text>
    </Reanimated.View>
  );
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
    paddingEnd: 2,
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
