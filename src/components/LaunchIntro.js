import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scale } from '../utils/responsive';
import { TROVA_WORDMARK_URI, TROVA_WORDMARK_ASPECT } from '../assets/trovaWordmark';

const GOLD = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.42)';

// Ambient choreography (mist / sweep / arc / icon) — plays immediately on mount
// and overlaps the shell load, so nothing is serialized behind it.
const BUILD_MS = 900;
// The "Trova" wordmark reveal. Fires `onSequenceComplete` on finish, which is
// the dismissal floor.
const REVEAL_MS = 480;
// The wordmark follows the icon rather than racing it.
const REVEAL_LEAD_MS = 340;
const EXIT_MS = 420;
// A tap dismisses early, but only after this grace window so an accidental
// double-tap on launch can't cut the brand moment to a single flashed frame.
const SKIP_GRACE_MS = 450;
// One breathe cycle of the underline glow. Loops for the whole hold, so a slow
// (> floor) launch keeps a visible "still working" pulse instead of freezing on
// a dead final frame.
const BREATHE_MS = 1600;

const SWEEP_OFFSET = scale(120);
const WORDMARK_RISE = scale(18);
const EXIT_LIFT = scale(6);

const EASE_CINEMATIC = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_BREATHE = Easing.inOut(Easing.sin);

// Pre-rendered from the Playfair Display Bold-Italic face (the same TTF that
// backs `fonts.wordmark`). Baked to an image on purpose: the intro is too
// short-lived for a runtime custom-font <Text> to reliably pick up the freshly
// registered typeface — it paints in the system fallback and is gone before a
// relayout applies the real face (the transient case of the shell's
// font-metrics trap). Delivered as a base64 data URI (see the module) so the
// release aapt2 optimizer can't strip its alpha. Pixel-identical to the in-app
// wordmark and immune to font-load timing.
const WORDMARK_SOURCE = { uri: TROVA_WORDMARK_URI };
const WORDMARK_ASPECT = TROVA_WORDMARK_ASPECT;

export function LaunchIntro({ canDismiss, onLayout, onSequenceComplete, onDismiss, onSkip }) {
  const palette = useMemo(
    () => ({
      background: '#000000',
      mist: ['rgba(212, 168, 83, 0)', 'rgba(212, 168, 83, 0.14)', 'rgba(212, 168, 83, 0)'],
      vignette: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)'],
    }),
    [],
  );

  // `build` drives the ambient reveal; `reveal` drives the wordmark; `breathe`
  // loops for liveness; `exit` cross-fades the whole overlay out and can
  // interrupt an unfinished sequence (e.g. a skip tap while the shell is ready).
  const build = useSharedValue(0);
  const reveal = useSharedValue(0);
  const breathe = useSharedValue(0);
  const exit = useSharedValue(0);

  const [skipArmed, setSkipArmed] = useState(false);

  useEffect(() => {
    build.value = withTiming(1, { duration: BUILD_MS, easing: EASE_CINEMATIC });
    breathe.value = withRepeat(
      withTiming(1, { duration: BREATHE_MS, easing: EASE_BREATHE }),
      -1,
      true,
    );
  }, [build, breathe]);

  useEffect(() => {
    const timer = setTimeout(() => {
      reveal.value = withTiming(1, { duration: REVEAL_MS, easing: EASE_CINEMATIC }, (finished) => {
        if (finished && onSequenceComplete) {
          runOnJS(onSequenceComplete)();
        }
      });
    }, REVEAL_LEAD_MS);

    return () => clearTimeout(timer);
  }, [reveal, onSequenceComplete]);

  useEffect(() => {
    const timer = setTimeout(() => setSkipArmed(true), SKIP_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!canDismiss) return undefined;

    exit.value = withTiming(1, { duration: EXIT_MS, easing: EASE_OUT }, (finished) => {
      if (finished && onDismiss) {
        runOnJS(onDismiss)();
      }
    });

    return undefined;
  }, [canDismiss, exit, onDismiss]);

  const handleSkip = () => {
    if (skipArmed && onSkip) onSkip();
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
  }));

  const mistStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(build.value, [0, 0.22], [0, 1], Extrapolation.CLAMP) * (1 - exit.value * 0.35),
    transform: [{ scale: interpolate(build.value, [0, 0.38], [0.88, 1.08], Extrapolation.CLAMP) }],
  }));

  const sweepLineStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(build.value, [0.08, 0.28], [0, 0.85], Extrapolation.CLAMP) * (1 - exit.value),
    transform: [
      {
        translateX: interpolate(
          build.value,
          [0.08, 0.5],
          [-SWEEP_OFFSET, SWEEP_OFFSET],
          Extrapolation.CLAMP,
        ),
      },
      { scaleX: interpolate(build.value, [0.08, 0.34], [0.15, 1], Extrapolation.CLAMP) },
    ],
  }));

  const arcLineStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(build.value, [0.15, 0.36], [0, 0.55], Extrapolation.CLAMP) * (1 - exit.value),
    transform: [
      { rotate: '-8deg' },
      { scaleX: interpolate(build.value, [0.15, 0.46], [0, 1], Extrapolation.CLAMP) },
    ],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.7], [0, 1], Extrapolation.CLAMP) * (1 - exit.value * 0.2),
    transform: [
      {
        translateY: interpolate(reveal.value, [0, 0.85], [WORDMARK_RISE, 0], Extrapolation.CLAMP),
      },
      { scale: interpolate(reveal.value, [0, 1], [0.96, 1], Extrapolation.CLAMP) },
    ],
  }));

  const underlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0.4, 0.9], [0, 1], Extrapolation.CLAMP) * (1 - exit.value),
    transform: [{ scaleX: interpolate(reveal.value, [0.4, 1], [0, 1], Extrapolation.CLAMP) }],
  }));

  // Appears once the lockup lands, then pulses on the looping `breathe` value —
  // this is the liveness cue for launches that outlast the reveal.
  const breatheStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(reveal.value, [0.6, 1], [0, 1], Extrapolation.CLAMP) *
      interpolate(breathe.value, [0, 1], [0.32, 0.8], Extrapolation.CLAMP) *
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
      <Animated.View style={[StyleSheet.absoluteFillObject, mistStyle]} pointerEvents="none">
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

      <Animated.View style={[styles.stage, contentLiftStyle]} pointerEvents="none">
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

        <Animated.View style={[styles.wordmarkWrap, wordmarkStyle]}>
          <Image
            source={WORDMARK_SOURCE}
            style={styles.wordmark}
            resizeMode="contain"
            accessibilityRole="header"
            accessibilityLabel="Trova"
          />
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

      {/* Full-screen tap target: skips the remaining hold once armed and the
          shell is ready. Sits above the decorative layers (which are all
          pointerEvents="none") so it reliably receives the tap. */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={handleSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      />
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
  wordmarkWrap: {
    alignItems: 'center',
  },
  wordmark: {
    width: scale(170),
    height: scale(170) / WORDMARK_ASPECT,
  },
  underline: {
    alignSelf: 'center',
    width: scale(112),
    height: 2,
    marginTop: scale(8),
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
