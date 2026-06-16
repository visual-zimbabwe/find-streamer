import React, { useEffect, useMemo } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { scale } from '../utils/responsive';

const GOLD = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.42)';
const SEQUENCE_MS = 3000;
const EXIT_MS = 450;

const SWEEP_OFFSET = scale(120);
const ICON_RISE = scale(8);
const WORDMARK_RISE = scale(18);
const EXIT_LIFT = scale(6);

const EASE_CINEMATIC = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_OUT = Easing.out(Easing.cubic);

export function LaunchIntro({ canDismiss, onLayout, onSequenceComplete, onDismiss }) {
  const { resolvedMode, theme } = useTheme();
  const isDark = resolvedMode === 'dark';
  const palette = useMemo(
    () =>
      isDark
        ? {
            background: '#000000',
            wordmark: theme.colors.onSurface,
            icon: require('../../icon.png'),
            mist: ['rgba(212, 168, 83, 0)', 'rgba(212, 168, 83, 0.14)', 'rgba(212, 168, 83, 0)'],
            vignette: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)'],
          }
        : {
            background: '#F7F7F2',
            wordmark: theme.colors.onSurface,
            icon: require('../../icon-light.png'),
            mist: ['rgba(212, 168, 83, 0)', 'rgba(212, 168, 83, 0.2)', 'rgba(212, 168, 83, 0)'],
            vignette: ['rgba(247,247,242,0)', 'rgba(24,27,33,0.08)'],
          },
    [isDark, theme.colors.onSurface],
  );

  const progress = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: SEQUENCE_MS, easing: EASE_CINEMATIC },
      (finished) => {
        if (finished && onSequenceComplete) {
          runOnJS(onSequenceComplete)();
        }
      },
    );
  }, [onSequenceComplete, progress]);

  useEffect(() => {
    if (!canDismiss) return undefined;

    exit.value = withTiming(1, { duration: EXIT_MS, easing: EASE_OUT }, (finished) => {
      if (finished && onDismiss) {
        runOnJS(onDismiss)();
      }
    });

    return undefined;
  }, [canDismiss, exit, onDismiss]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
  }));

  const mistStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.value, [0, 0.22], [0, 1], Extrapolation.CLAMP) * (1 - exit.value * 0.35),
    transform: [
      { scale: interpolate(progress.value, [0, 0.35], [0.88, 1.08], Extrapolation.CLAMP) },
    ],
  }));

  const sweepLineStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.value, [0.12, 0.32], [0, 0.85], Extrapolation.CLAMP) * (1 - exit.value),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0.12, 0.55],
          [-SWEEP_OFFSET, SWEEP_OFFSET],
          Extrapolation.CLAMP,
        ),
      },
      { scaleX: interpolate(progress.value, [0.12, 0.38], [0.15, 1], Extrapolation.CLAMP) },
    ],
  }));

  const arcLineStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.value, [0.2, 0.42], [0, 0.55], Extrapolation.CLAMP) * (1 - exit.value),
    transform: [
      { rotate: '-8deg' },
      { scaleX: interpolate(progress.value, [0.2, 0.5], [0, 1], Extrapolation.CLAMP) },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const inOpacity = interpolate(progress.value, [0.24, 0.38], [0, 0.72], Extrapolation.CLAMP);
    const outOpacity = 1 - interpolate(progress.value, [0.42, 0.58], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: inOpacity * outOpacity * (1 - exit.value),
      transform: [
        {
          translateY: interpolate(
            progress.value,
            [0.24, 0.42],
            [ICON_RISE, 0],
            Extrapolation.CLAMP,
          ),
        },
        { scale: interpolate(progress.value, [0.24, 0.42], [0.86, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.value, [0.34, 0.58], [0, 1], Extrapolation.CLAMP) *
      (1 - exit.value * 0.2),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0.34, 0.62],
          [WORDMARK_RISE, 0],
          Extrapolation.CLAMP,
        ),
      },
      { scale: interpolate(progress.value, [0.34, 0.68], [0.96, 1], Extrapolation.CLAMP) },
    ],
  }));

  const underlineStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.value, [0.48, 0.66], [0, 1], Extrapolation.CLAMP) * (1 - exit.value),
    transform: [{ scaleX: interpolate(progress.value, [0.48, 0.72], [0, 1], Extrapolation.CLAMP) }],
  }));

  const breatheStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.value, [0.68, 0.92], [0.35, 0.75], Extrapolation.CLAMP) *
      (0.82 + interpolate(progress.value, [0.72, 1], [0, 0.18], Extrapolation.CLAMP)) *
      (1 - exit.value),
  }));

  const contentLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -exit.value * EXIT_LIFT }],
  }));

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents={canDismiss ? 'none' : 'auto'}
      style={[
        StyleSheet.absoluteFillObject,
        styles.root,
        { backgroundColor: palette.background },
        overlayStyle,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, mistStyle]}>
        <LinearGradient
          colors={palette.mist}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <LinearGradient
        colors={palette.vignette}
        start={{ x: 0.5, y: 0.65 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <Animated.View style={[styles.stage, contentLiftStyle]}>
        <Animated.View style={[styles.sweepLine, sweepLineStyle]}>
          <LinearGradient
            colors={['rgba(212,168,83,0)', GOLD, 'rgba(212,168,83,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <Animated.View style={[styles.arcLine, arcLineStyle]}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: GOLD_DIM }]} />
        </Animated.View>

        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Image
            source={palette.icon}
            style={styles.icon}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>

        <Animated.View style={wordmarkStyle}>
          <Text
            style={[
              styles.wordmark,
              isDark ? styles.wordmarkDark : styles.wordmarkLight,
              { color: palette.wordmark },
            ]}
            accessibilityRole="header"
          >
            Trova
          </Text>
          <Animated.View style={[styles.underline, underlineStyle]}>
            <LinearGradient
              colors={['rgba(212,168,83,0)', GOLD, 'rgba(212,168,83,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          <Animated.View style={[styles.underlineGlow, breatheStyle]}>
            <LinearGradient
              colors={['rgba(212,168,83,0)', 'rgba(212,168,83,0.35)', 'rgba(212, 168, 83, 0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 9999,
    elevation: 9999,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(28),
  },
  sweepLine: {
    position: 'absolute',
    top: '43%',
    width: scale(220),
    height: 1,
    borderRadius: 1,
    overflow: 'hidden',
  },
  arcLine: {
    position: 'absolute',
    top: '47%',
    width: scale(160),
    height: 1,
    borderRadius: 1,
    overflow: 'hidden',
  },
  iconWrap: {
    marginBottom: scale(14),
    width: scale(44),
    height: scale(44),
    borderRadius: scale(12),
    overflow: 'hidden',
    opacity: 0.92,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    fontFamily: Platform.select({ android: 'serif', ios: 'Georgia', default: 'serif' }),
    fontSize: scale(42),
    lineHeight: scale(50),
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  wordmarkDark: {
    textShadowColor: 'rgba(212, 168, 83, 0.22)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  wordmarkLight: {
    textShadowColor: 'rgba(24, 27, 33, 0.08)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  underline: {
    alignSelf: 'center',
    width: scale(112),
    height: 2,
    marginTop: scale(10),
    borderRadius: 1,
    overflow: 'hidden',
  },
  underlineGlow: {
    alignSelf: 'center',
    width: scale(140),
    height: scale(18),
    marginTop: scale(4),
    borderRadius: scale(9),
    overflow: 'hidden',
  },
});
