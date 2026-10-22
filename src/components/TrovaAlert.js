import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
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
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { scale, scaleFont } from '../utils/responsive';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';

const SCREEN_W = Dimensions.get('window').width;

export function TrovaAlertPortal() {
  const { currentAlert, dismissAlert } = useAlert();
  const { theme } = useTheme();
  const { colors, radii } = theme;

  const [displayedAlert, setDisplayedAlert] = useState(currentAlert);

  useEffect(() => {
    if (currentAlert) {
      setDisplayedAlert(currentAlert);
    }
  }, [currentAlert]);

  const alertVisible = Boolean(currentAlert?.visible);

  // Animations
  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (alertVisible) {
      try {
        const hasDestructive = displayedAlert?.buttons?.some((b) => b.style === 'destructive');
        if (hasDestructive) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
      } catch {
        // graceful ignore
      }

      backdropOpacity.value = withTiming(1, { duration: 220 });
      cardOpacity.value = withTiming(1, { duration: 200 });
      cardScale.value = withSpring(1, {
        damping: 18,
        stiffness: 260,
        mass: 0.8,
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180 });
      cardOpacity.value = withTiming(0, { duration: 160 });
      cardScale.value = withTiming(0.92, {
        duration: 180,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [alertVisible, backdropOpacity, cardOpacity, cardScale]);

  // Android back button handling
  useEffect(() => {
    if (!alertVisible) return;

    const onBackPress = () => {
      const cancelButton = displayedAlert?.buttons?.find((b) => b.style === 'cancel');
      if (cancelButton) {
        cancelButton.onPress?.();
        dismissAlert();
        return true;
      }
      if (displayedAlert?.options?.cancelable !== false) {
        dismissAlert();
        return true;
      }
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [alertVisible, displayedAlert, dismissAlert]);

  const handleButtonPress = (btn) => {
    Haptics.selectionAsync().catch(() => {});
    dismissAlert();
    btn.onPress?.();
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  if (!displayedAlert) return null;

  const buttons = displayedAlert.buttons || [{ text: 'OK', style: 'default' }];
  const isStacked = buttons.length > 2;
  const hasDestructive = buttons.some((b) => b.style === 'destructive');

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={alertVisible ? 'auto' : 'none'}
      zIndex={9998}
    >
      <Reanimated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => {
            if (displayedAlert.options?.cancelable) dismissAlert();
          }}
        />
      </Reanimated.View>

      <View style={styles.centerContainer} pointerEvents="box-none">
        <Reanimated.View
          style={[
            styles.card,
            {
              backgroundColor: 'rgba(21, 18, 13, 0.98)',
              borderColor: hasDestructive ? 'rgba(255, 69, 58, 0.35)' : GOLD_DIM,
              borderRadius: radii.xl,
            },
            cardStyle,
          ]}
          accessibilityRole="alert"
        >
          {/* Eyebrow indicator */}
          <View style={styles.headerBar}>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: hasDestructive
                    ? 'rgba(255, 69, 58, 0.14)'
                    : 'rgba(212, 168, 83, 0.14)',
                },
              ]}
            >
              <Ionicons
                name={hasDestructive ? 'warning-outline' : 'sparkles-outline'}
                size={16}
                color={hasDestructive ? '#ff453a' : GOLD_ACCENT}
              />
            </View>
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              { color: colors.onSurface, fontFamily: fonts.heading },
            ]}
          >
            {displayedAlert.title}
          </Text>

          {/* Message */}
          {displayedAlert.message ? (
            <Text
              style={[
                styles.message,
                { color: colors.onSurfaceVariant, fontFamily: fonts.body },
              ]}
            >
              {displayedAlert.message}
            </Text>
          ) : null}

          {/* Action buttons */}
          <View
            style={[
              styles.buttonContainer,
              isStacked ? styles.buttonContainerStacked : styles.buttonContainerRow,
            ]}
          >
            {buttons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isDefault = !isDestructive && !isCancel;

              return (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.82}
                  onPress={() => handleButtonPress(btn)}
                  style={[
                    styles.button,
                    isStacked ? styles.buttonStacked : styles.buttonRow,
                    isDestructive && styles.buttonDestructive,
                    isCancel && styles.buttonCancel,
                    isDefault && [styles.buttonDefault, { backgroundColor: GOLD_ACCENT }],
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={btn.text}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { fontFamily: fonts.label },
                      isDestructive && styles.buttonTextDestructive,
                      isCancel && [styles.buttonTextCancel, { color: colors.onSurfaceVariant }],
                      isDefault && styles.buttonTextDefault,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Reanimated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 3, 1, 0.78)',
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(20),
  },
  card: {
    width: Math.min(SCREEN_W - scale(40), scale(360)),
    padding: scale(22),
    borderWidth: 1,
    ...Platform.select({
      android: { elevation: 16 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
    }),
  },
  headerBar: {
    marginBottom: scale(14),
  },
  iconBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: scaleFont(19),
    fontWeight: '700',
    lineHeight: scaleFont(24),
    marginBottom: scale(8),
  },
  message: {
    fontSize: scaleFont(14),
    lineHeight: scaleFont(21),
    marginBottom: scale(22),
  },
  buttonContainer: {
    marginTop: scale(4),
  },
  buttonContainerRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  buttonContainerStacked: {
    flexDirection: 'column',
    gap: scale(10),
  },
  button: {
    minHeight: scale(46),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(14),
  },
  buttonRow: {
    flex: 1,
  },
  buttonStacked: {
    width: '100%',
  },
  buttonDefault: {
    shadowColor: GOLD_ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonTextDefault: {
    color: '#1a1204',
    fontSize: scaleFont(14),
    fontWeight: '700',
  },
  buttonCancel: {
    backgroundColor: 'rgba(37, 33, 27, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(49, 45, 39, 0.9)',
  },
  buttonTextCancel: {
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  buttonDestructive: {
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.45)',
  },
  buttonTextDestructive: {
    color: '#ff453a',
    fontSize: scaleFont(14),
    fontWeight: '700',
  },
});
