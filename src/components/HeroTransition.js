import React, { createContext, useCallback, useContext, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Reanimated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { screenWidth } from '../utils/responsive';
import { HERO_HEIGHT } from '../theme/programme';

/**
 * Shared-element "hero" transition between a tapped poster and the Detail hero.
 *
 * The Detail stack uses `animation: 'none'`, so the destination screen appears
 * in place with no competing slide. That lets us do a clean overlay handoff: on
 * a poster tap we measure the tile, mount a floating copy of that exact poster
 * over everything, and fly it from the tile's rect up into the hero's rect
 * (0,0 → full-width × HERO_HEIGHT), cross-fading out at the end to reveal the
 * real hero underneath. The poster the grid already displayed is memory-cached
 * by expo-image, so the copy paints instantly with no flticker.
 *
 * It animates **transform + opacity only** — the one Reanimated path that is
 * reliable on this Fabric build (animating layout props like width/height left
 * the clone sizeless and invisible). The view is laid out at the target hero
 * rect and a uniform scale+translate shrinks it onto the tapped tile at the
 * start; a uniform scale keeps the poster from distorting as it grows.
 */

const HeroTransitionContext = createContext({ beginHero: () => {} });

export function useHeroTransition() {
  return useContext(HeroTransitionContext);
}

const DURATION_MS = 380;
const EASING = Easing.out(Easing.cubic);

export function HeroTransitionProvider({ children }) {
  /** `{ uri, src: {x,y,w,h}, radius }` while a flight is on screen, else null. */
  const [flight, setFlight] = useState(null);
  const progress = useSharedValue(0);

  const clear = useCallback(() => setFlight(null), []);

  const beginHero = useCallback(
    ({ uri, sourceRect, radius = 0 }) => {
      if (!uri || !sourceRect || !sourceRect.w || !sourceRect.h) return;
      progress.value = 0;
      setFlight({ uri, src: sourceRect, radius });
      progress.value = withTiming(1, { duration: DURATION_MS, easing: EASING }, (finished) => {
        'worklet';
        if (finished) runOnJS(clear)();
      });
    },
    [progress, clear],
  );

  return (
    <HeroTransitionContext.Provider value={{ beginHero }}>
      {children}
      {flight ? <HeroClone flight={flight} progress={progress} /> : null}
    </HeroTransitionContext.Provider>
  );
}

function HeroClone({ flight, progress }) {
  const { uri, src } = flight;

  // Base layout is the destination hero rect; a uniform scale (matched to the
  // tile's width) plus a translate places it exactly over the tapped poster at
  // the start of the flight. Uniform scale → no stretch as the poster grows.
  const startScale = src.w / screenWidth;
  const startTranslateX = src.x + src.w / 2 - screenWidth / 2;
  const startTranslateY = src.y + src.h / 2 - HERO_HEIGHT / 2;

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      // Hold opaque through the flight, then dissolve into the real hero.
      opacity: interpolate(p, [0, 0.82, 1], [1, 1, 0]),
      transform: [
        { translateX: interpolate(p, [0, 1], [startTranslateX, 0]) },
        { translateY: interpolate(p, [0, 1], [startTranslateY, 0]) },
        { scale: interpolate(p, [0, 1], [startScale, 1]) },
      ],
    };
  });

  return (
    <Reanimated.View pointerEvents="none" style={[styles.clone, animatedStyle]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  clone: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: screenWidth,
    height: HERO_HEIGHT,
    overflow: 'hidden',
    // Above the bottom nav (zIndex 1000) and every sheet; elevation covers
    // Android's paint order, zIndex covers iOS.
    zIndex: 100000,
    elevation: 100000,
  },
});
