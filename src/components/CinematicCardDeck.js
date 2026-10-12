import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { MediaArtwork } from './MediaArtwork';
import { useTheme } from '../theme/ThemeProvider';
import { scale } from '../utils/responsive';
import { tmdbImageAtSize } from '../lib/tmdbImages';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { usePosterTheme } from '../lib/usePosterTheme';
import {
  HOME_HERO_RESUME_DELAY_MS,
  HOME_HERO_ROTATION_MS,
} from '../lib/homeFeed';

const WINDOW_W = Dimensions.get('window').width;

// Geometry: Front card occupies ~61% of screen width, leaving rightward fan space
export const DECK_CARD_W = Math.min(Math.round(WINDOW_W * 0.61), scale(260));
export const DECK_CARD_H = Math.round(DECK_CARD_W * 1.5); // 2:3 portrait aspect ratio

// Offsets for the fanned deck stacked to the right
export const STACK_STEP_X = scale(46);
export const STACK_STEP_SCALE = 0.09;
export const STACK_LEFT = scale(22);

const SWIPE_THRESHOLD = scale(44);
const SWIPE_VELOCITY = 0.32;

// Piecewise interpolation bounds for continuous deck offset
const RANGE_MIN = -15;
const RANGE_MAX = 35;

/**
 * useCardInterpolations
 *
 * Compiles a continuous native driver interpolation node for each specific card.
 * Because each card maintains its own item identity, image URIs never swap,
 * completely eliminating bitmap unloads and render flashes.
 */
function useCardInterpolations(deckOffset, itemIndex, total) {
  return useMemo(() => {
    if (total <= 0) return null;

    const inputRange = [];
    const translateXOutput = [];
    const scaleOutput = [];
    const opacityOutput = [];
    const scrimOutput = [];
    const rotateOutput = [];

    for (let k = RANGE_MIN; k <= RANGE_MAX; k++) {
      inputRange.push(k);

      let rel = (itemIndex - k) % total;
      if (rel < 0) rel += total;
      if (rel > total / 2) rel -= total;

      if (rel === 0) {
        translateXOutput.push(0);
        scaleOutput.push(1.0);
        opacityOutput.push(1.0);
        scrimOutput.push(0);
        rotateOutput.push('0deg');
      } else if (rel === 1) {
        translateXOutput.push(STACK_STEP_X);
        scaleOutput.push(1.0 - STACK_STEP_SCALE);
        opacityOutput.push(1.0);
        scrimOutput.push(0.20);
        rotateOutput.push('0deg');
      } else if (rel === 2) {
        translateXOutput.push(STACK_STEP_X * 2);
        scaleOutput.push(1.0 - STACK_STEP_SCALE * 2);
        opacityOutput.push(1.0);
        scrimOutput.push(0.40);
        rotateOutput.push('0deg');
      } else if (rel === 3) {
        translateXOutput.push(STACK_STEP_X * 3);
        scaleOutput.push(1.0 - STACK_STEP_SCALE * 3);
        opacityOutput.push(1.0);
        scrimOutput.push(0.58);
        rotateOutput.push('0deg');
      } else if (rel === 4) {
        translateXOutput.push(STACK_STEP_X * 3.6);
        scaleOutput.push(1.0 - STACK_STEP_SCALE * 3.5);
        opacityOutput.push(0);
        scrimOutput.push(0.72);
        rotateOutput.push('0deg');
      } else if (rel === -1) {
        translateXOutput.push(-DECK_CARD_W - scale(30));
        scaleOutput.push(1.0);
        opacityOutput.push(0);
        scrimOutput.push(0);
        rotateOutput.push('-5deg');
      } else {
        translateXOutput.push(-DECK_CARD_W - scale(50));
        scaleOutput.push(0.65);
        opacityOutput.push(0);
        scrimOutput.push(0.80);
        rotateOutput.push('0deg');
      }
    }

    return {
      translateX: deckOffset.interpolate({
        inputRange,
        outputRange: translateXOutput,
        extrapolate: 'clamp',
      }),
      scale: deckOffset.interpolate({
        inputRange,
        outputRange: scaleOutput,
        extrapolate: 'clamp',
      }),
      opacity: deckOffset.interpolate({
        inputRange,
        outputRange: opacityOutput,
        extrapolate: 'clamp',
      }),
      scrim: deckOffset.interpolate({
        inputRange,
        outputRange: scrimOutput,
        extrapolate: 'clamp',
      }),
      rotate: deckOffset.interpolate({
        inputRange,
        outputRange: rotateOutput,
        extrapolate: 'clamp',
      }),
    };
  }, [deckOffset, itemIndex, total]);
}

const getCardZIndex = (itemIndex, activeIndex, total) => {
  let rel = (itemIndex - activeIndex) % total;
  if (rel < 0) rel += total;
  if (rel > total / 2) rel -= total;

  if (rel === 0) return { zIndex: 10, elevation: 12 };
  if (rel === 1) return { zIndex: 8, elevation: 8 };
  if (rel === 2) return { zIndex: 6, elevation: 5 };
  if (rel === 3) return { zIndex: 4, elevation: 3 };
  if (rel === 4) return { zIndex: 2, elevation: 2 };
  if (rel === -1) return { zIndex: 12, elevation: 14 };
  return { zIndex: 1, elevation: 1 };
};

/**
 * DeckCard
 *
 * Dedicated persistent card component for each movie in the feed.
 * Never unmounts, never detaches, and never swaps its image URI.
 */
const DeckCard = memo(function DeckCard({
  item,
  index,
  activeIndex,
  total,
  deckOffset,
  onSelectItem,
  onAdvance,
  pauseRotation,
  scheduleResume,
  radii,
}) {
  const interpolations = useCardInterpolations(deckOffset, index, total);
  if (!interpolations) return null;

  const { zIndex, elevation } = getCardZIndex(index, activeIndex, total);

  let rel = (index - activeIndex) % total;
  if (rel < 0) rel += total;
  if (rel > total / 2) rel -= total;

  const isFront = rel === 0;
  const isClickable = rel >= 0 && rel <= 3;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        styles.cardShadow,
        {
          zIndex,
          elevation,
          left: STACK_LEFT,
          opacity: interpolations.opacity,
          transform: [
            { translateX: interpolations.translateX },
            { rotate: interpolations.rotate },
            { scale: interpolations.scale },
          ],
        },
      ]}
      pointerEvents={isClickable ? 'auto' : 'none'}
    >
      <TouchableOpacity
        activeOpacity={isFront ? 0.94 : 0.88}
        onPress={() => {
          if (isFront) {
            onSelectItem?.(item);
          } else if (rel > 0 && rel <= 3) {
            onAdvance?.(rel);
          }
        }}
        onPressIn={isFront ? pauseRotation : undefined}
        onPressOut={isFront ? scheduleResume : undefined}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.title}`}
        style={[
          styles.cardFrame,
          {
            borderRadius: radii.xl,
          },
        ]}
      >
        <MediaArtwork
          uri={tmdbImageAtSize(item.posterUrl || item.backdropUrl, 'w780')}
          style={styles.posterArt}
          resizeMode="cover"
          title={item.title}
          instant={true}
        />
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.depthScrim,
            { opacity: interpolations.scrim },
          ]}
          pointerEvents="none"
        />
      </TouchableOpacity>
    </Animated.View>
  );
});

/**
 * CinematicCardDeck
 *
 * Implements a pure continuous canvas 3D fanned card deck:
 * - Continuous deck offset engine: no pan snapping, no URI swapping, zero flashes
 * - Persistent dedicated card components with permanent GPU-cached textures
 * - Zero haptics on card promotion (clean, silent transitions)
 * - Layered rightward fan with organic drop shadows and progressive depth scrims
 * - Capture-enabled PanResponder for fluid swipe gestures and auto-rotation
 * - Seamless atmospheric color handoff to parent canvas without fallback pops
 */
export const CinematicCardDeck = memo(function CinematicCardDeck({
  items = [],
  onSelectItem,
  onActiveColorChange,
  style,
}) {
  const { theme } = useTheme();
  const { colors, radii } = theme;
  const reduceMotion = useReduceMotion();

  const total = items.length;
  const totalRef = useRef(total);
  totalRef.current = total;

  const [activeIndex, setActiveIndex] = useState(0);

  const activeItem = items[activeIndex] || null;
  const activePoster = activeItem?.posterUrl || activeItem?.backdropUrl || null;
  const activePosterUri = useMemo(
    () => (activePoster ? tmdbImageAtSize(activePoster, 'w780') : null),
    [activePoster],
  );

  // Extract theme colors without causing synchronous flashes
  const posterTheme = usePosterTheme(activePosterUri);

  // Notify parent of the dominant color only when resolved to prevent fallback gold dipping
  useEffect(() => {
    if (!posterTheme) return;
    const accentHex =
      posterTheme._accentHex ||
      posterTheme.primary ||
      colors.primary ||
      '#D4A853';
    onActiveColorChange?.(accentHex);
  }, [posterTheme, colors.primary, onActiveColorChange]);

  // Pre-warm all deck posters in memory/disk cache
  useEffect(() => {
    if (!items || items.length === 0) return;
    items.slice(0, 10).forEach((it) => {
      const p = it?.posterUrl || it?.backdropUrl;
      if (p) {
        try {
          Image.prefetch(tmdbImageAtSize(p, 'w780'));
        } catch (_) {}
      }
    });
  }, [items]);

  // Continuous animation and gesture state
  const deckOffset = useRef(new Animated.Value(0)).current;
  const currentOffsetRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);

  // Reset offset when items pool changes (e.g. filter changes)
  useEffect(() => {
    setActiveIndex(0);
    currentOffsetRef.current = 0;
    deckOffset.setValue(0);
    isAnimatingRef.current = false;
  }, [items, deckOffset]);

  // Pause and resume helpers for auto-rotation
  const pauseRotation = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, HOME_HERO_RESUME_DELAY_MS);
  }, []);

  // Continuous forward/backward transition animation
  const animateToOffset = useCallback(
    (target) => {
      if (totalRef.current <= 1 || isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      Animated.timing(deckOffset, {
        toValue: target,
        duration: 250,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        isAnimatingRef.current = false;
        if (finished) {
          currentOffsetRef.current = target;
          const nextIndex = ((target % totalRef.current) + totalRef.current) % totalRef.current;
          setActiveIndex(nextIndex);

          // Keep offset within safe piecewise interpolation bounds while idle
          if (target >= totalRef.current * 2 || target <= -totalRef.current) {
            const normalized = nextIndex;
            currentOffsetRef.current = normalized;
            deckOffset.setValue(normalized);
          }
        }
      });
    },
    [deckOffset],
  );

  const advanceToOffset = useCallback(
    (steps = 1) => {
      animateToOffset(currentOffsetRef.current + steps);
    },
    [animateToOffset],
  );

  // Idle auto-rotation loop
  useEffect(() => {
    if (total <= 1 || reduceMotion) return undefined;
    const interval = setInterval(() => {
      if (pausedRef.current || isAnimatingRef.current) return;
      advanceToOffset(1);
    }, HOME_HERO_ROTATION_MS);

    return () => clearInterval(interval);
  }, [total, reduceMotion, advanceToOffset]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  // PanResponder for smooth, direct finger tracking of deckOffset
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (totalRef.current <= 1 || isAnimatingRef.current) return false;
        return Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3;
      },
      onMoveShouldSetPanResponder: (_, g) => {
        if (totalRef.current <= 1 || isAnimatingRef.current) return false;
        return Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3;
      },
      onPanResponderGrant: () => {
        pauseRotation();
        dragStartOffsetRef.current = currentOffsetRef.current;
      },
      onPanResponderMove: (_, g) => {
        if (isAnimatingRef.current) return;
        const dragOffset = dragStartOffsetRef.current - g.dx / DECK_CARD_W;
        deckOffset.setValue(dragOffset);
      },
      onPanResponderRelease: (_, g) => {
        scheduleResume();
        if (isAnimatingRef.current) return;

        let target = dragStartOffsetRef.current;
        if (g.dx < -SWIPE_THRESHOLD || g.vx < -SWIPE_VELOCITY) {
          target = dragStartOffsetRef.current + 1;
        } else if (g.dx > SWIPE_THRESHOLD || g.vx > SWIPE_VELOCITY) {
          target = dragStartOffsetRef.current - 1;
        }

        animateToOffset(target);
      },
      onPanResponderTerminate: () => {
        scheduleResume();
        animateToOffset(dragStartOffsetRef.current);
      },
    }),
  ).current;

  if (!items || total === 0) return null;

  return (
    <View style={[styles.deckRoot, style]}>
      {/* 3D Stack Container with PanGesture Responder — sits directly on continuous canvas */}
      <View style={styles.stackStage} {...panResponder.panHandlers}>
        {items.map((item, index) => (
          <DeckCard
            key={item.id || item.imdbId || String(index)}
            item={item}
            index={index}
            activeIndex={activeIndex}
            total={total}
            deckOffset={deckOffset}
            onSelectItem={onSelectItem}
            onAdvance={advanceToOffset}
            pauseRotation={pauseRotation}
            scheduleResume={scheduleResume}
            radii={radii}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  deckRoot: {
    position: 'relative',
    width: '100%',
    paddingVertical: scale(2),
  },
  stackStage: {
    height: DECK_CARD_H + scale(12),
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    top: scale(6),
    width: DECK_CARD_W,
    height: DECK_CARD_H,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.60,
    shadowRadius: 18,
  },
  cardFrame: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    position: 'relative',
    backgroundColor: '#0a0a0a',
  },
  posterArt: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  depthScrim: {
    backgroundColor: '#000',
  },
});
