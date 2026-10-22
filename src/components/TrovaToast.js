import React, { useEffect, useMemo, useState } from 'react';
import {
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { useToastContext } from '../context/ToastContext';
import { scale, scaleFont } from '../utils/responsive';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';

const TYPE_CONFIG = {
  success: {
    defaultIcon: 'checkmark-circle',
    iconColor: GOLD_ACCENT,
    accentBg: 'rgba(212, 168, 83, 0.15)',
  },
  error: {
    defaultIcon: 'alert-circle',
    iconColor: '#ff453a',
    accentBg: 'rgba(255, 69, 58, 0.15)',
  },
  warning: {
    defaultIcon: 'warning',
    iconColor: '#E5A93C',
    accentBg: 'rgba(229, 169, 60, 0.15)',
  },
  info: {
    defaultIcon: 'information-circle',
    iconColor: GOLD_ACCENT,
    accentBg: 'rgba(212, 168, 83, 0.15)',
  },
};

export function TrovaToastPortal() {
  const { currentToast, dismissToast } = useToastContext();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors } = theme;

  const [displayedToast, setDisplayedToast] = useState(currentToast);

  useEffect(() => {
    if (currentToast) {
      setDisplayedToast(currentToast);
    }
  }, [currentToast]);

  const activeToast = currentToast || displayedToast;
  const toastVisible = Boolean(currentToast?.visible);
  const config = TYPE_CONFIG[activeToast?.type] || TYPE_CONFIG.info;
  const iconName = activeToast?.icon || config.defaultIcon;

  // Animation values
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const scaleAnim = useSharedValue(0.92);

  useEffect(() => {
    if (toastVisible && activeToast?.haptic !== false && activeToast?.haptic !== 'none') {
      try {
        const type = activeToast?.type;
        if (type === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } else if (type === 'error') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        } else if (type === 'warning') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      } catch {
        // graceful ignore
      }

      translateY.value = withSpring(0, {
        damping: 18,
        stiffness: 240,
        mass: 0.8,
      });
      opacity.value = withTiming(1, { duration: 200 });
      scaleAnim.value = withSpring(1, { damping: 16, stiffness: 220 });
    } else {
      translateY.value = withTiming(-120, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      });
      opacity.value = withTiming(0, { duration: 180 });
      scaleAnim.value = withTiming(0.92, { duration: 180 });
    }
  }, [toastVisible, translateY, opacity, scaleAnim, displayedToast?.type]);

  // Swipe up to dismiss gesture
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy < 0) {
            translateY.value = gestureState.dy;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -20 || gestureState.vy < -0.5) {
            dismissToast();
          } else {
            translateY.value = withSpring(0, { damping: 16, stiffness: 220 });
          }
        },
      }),
    [dismissToast, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scaleAnim.value }],
    opacity: opacity.value,
  }));

  if (!activeToast) return null;

  return (
    <View
      style={[
        styles.portalContainer,
        { top: insets.top + scale(8) },
      ]}
      pointerEvents={toastVisible ? 'box-none' : 'none'}
    >
      <Reanimated.View
        style={[styles.capsuleWrap, animatedStyle]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={dismissToast}
          style={[
            styles.capsule,
            {
              backgroundColor: 'rgba(21, 18, 13, 0.96)',
              borderColor: GOLD_DIM,
            },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.iconWrap, { backgroundColor: config.accentBg }]}>
            <Ionicons name={iconName} size={18} color={config.iconColor} />
          </View>

          <View style={styles.textWrap}>
            {activeToast.title ? (
              <Text
                style={[
                  styles.titleText,
                  { color: colors.onSurfaceVariant, fontFamily: fonts.label },
                ]}
                numberOfLines={1}
              >
                {activeToast.title}
              </Text>
            ) : null}
            <Text
              style={[
                styles.messageText,
                { color: colors.onSurface, fontFamily: fonts.body },
              ]}
              numberOfLines={2}
            >
              {activeToast.message}
            </Text>
          </View>
        </TouchableOpacity>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  portalContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  capsuleWrap: {
    maxWidth: scale(380),
    minWidth: scale(220),
    paddingHorizontal: scale(16),
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: 9999,
    borderWidth: 1,
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
    }),
  },
  iconWrap: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: scale(2),
  },
  messageText: {
    fontSize: scaleFont(13.5),
    fontWeight: '600',
    lineHeight: scaleFont(18),
  },
});
