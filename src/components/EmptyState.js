import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

const VARIANTS = {
  empty: {
    icon: 'search-outline',
    accent: 'primary',
  },
  offline: {
    icon: 'cloud-offline-outline',
    accent: 'error',
  },
  service: {
    icon: 'cafe-outline',
    accent: 'primary',
  },
  error: {
    icon: 'alert-circle-outline',
    accent: 'error',
  },
  welcome: {
    icon: 'sparkles-outline',
    accent: 'primary',
  },
  loading: {
    icon: 'sync-outline',
    accent: 'primary',
  },
};

export function EmptyState({
  variant = 'empty',
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const config = VARIANTS[variant] || VARIANTS.empty;
  const accent = colors[config.accent] || colors.primary;
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    floatAnimation.start();
    pulseAnimation.start();
    return () => {
      floatAnimation.stop();
      pulseAnimation.stop();
    };
  }, [float, pulse]);

  const floatStyle = {
    transform: [
      {
        translateY: float.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -8],
        }),
      },
    ],
  };
  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.55, 1],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.08],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <Animated.View
        style={[
          styles.illustration,
          { backgroundColor: accent + '14', borderColor: accent + '33' },
          floatStyle,
        ]}
      >
        <View style={[styles.orbit, { borderColor: accent + '22' }]} />
        <View
          style={[
            styles.screen,
            { borderColor: accent + '66', backgroundColor: colors.surfaceContainerHigh },
          ]}
        >
          <View style={styles.sparkRow}>
            <Animated.View style={[styles.spark, { backgroundColor: accent }, pulseStyle]} />
            <View style={[styles.sparkSmall, { backgroundColor: colors.onSurfaceVariant }]} />
          </View>
          <Ionicons name={config.icon} size={38} color={accent} />
          <View style={[styles.screenStand, { backgroundColor: accent + '66' }]} />
        </View>
        <View
          style={[
            styles.ticket,
            { backgroundColor: colors.surfaceContainerHighest, borderColor: accent + '44' },
          ]}
        >
          <View style={[styles.ticketDot, { backgroundColor: accent }]} />
          <View style={[styles.ticketLine, { backgroundColor: colors.onSurfaceVariant + '55' }]} />
        </View>
      </Animated.View>

      <Text style={[styles.title, { color: colors.onSurface, ...typography.titleLg }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[styles.description, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
        >
          {description}
        </Text>
      ) : null}

      {(primaryAction || secondaryAction) && (
        <View style={styles.actionRow}>
          {secondaryAction && (
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { borderColor: colors.outlineVariant + '66', borderRadius: radii.full },
              ]}
              onPress={secondaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.accessibilityLabel || secondaryAction.label}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: colors.onSurface, ...typography.labelSm },
                ]}
              >
                {secondaryAction.label}
              </Text>
            </TouchableOpacity>
          )}
          {primaryAction && (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary, borderRadius: radii.full },
              ]}
              onPress={primaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={primaryAction.accessibilityLabel || primaryAction.label}
            >
              {primaryAction.icon && (
                <Ionicons name={primaryAction.icon} size={16} color={colors.onPrimary} />
              )}
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: colors.onPrimary, ...typography.labelSm },
                ]}
              >
                {primaryAction.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 56,
  },
  compact: {
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  illustration: {
    alignItems: 'center',
    borderRadius: 72,
    borderWidth: 1,
    height: 128,
    justifyContent: 'center',
    marginBottom: 24,
    width: 128,
  },
  orbit: {
    borderRadius: 54,
    borderWidth: 1,
    height: 108,
    position: 'absolute',
    transform: [{ rotate: '-18deg' }],
    width: 108,
  },
  screen: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    height: 78,
    justifyContent: 'center',
    width: 96,
  },
  sparkRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    right: 14,
    top: 12,
  },
  spark: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  sparkSmall: {
    borderRadius: 3,
    height: 6,
    opacity: 0.65,
    width: 6,
  },
  screenStand: {
    bottom: -13,
    height: 3,
    position: 'absolute',
    width: 38,
  },
  ticket: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 18,
    flexDirection: 'row',
    gap: 6,
    height: 24,
    paddingHorizontal: 8,
    position: 'absolute',
    right: 9,
    transform: [{ rotate: '9deg' }],
    width: 58,
  },
  ticketDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  ticketLine: {
    borderRadius: 2,
    flex: 1,
    height: 4,
  },
  title: {
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    lineHeight: 21,
    maxWidth: 300,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  secondaryButton: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontWeight: '900',
    letterSpacing: 0.7,
  },
});
