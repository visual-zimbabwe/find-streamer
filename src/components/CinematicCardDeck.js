import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
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
import * as Haptics from 'expo-haptics';
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

const SWIPE_THRESHOLD = scale(48);
const SWIPE_VELOCITY = 0.35;

/**
 * CinematicCardDeck
 *
 * Implements a pure 3D fanned card stack with continuous canvas integration:
 * - Fixed native view slots that never detach from window
 * - Continuous tail buffer (Card 4) that pre-fades into position 3 during swiping,
 *   completely eliminating the flash/pop when new images slot into the back of the line
 * - instant={true} on MediaArtwork eliminates expo-image's default 250ms fade-in flash
 * - Deep cinematic dark (#0a0a0a) frame background avoids light gray surfaceContainerHighest pops
 * - Stable, pre-warmed image textures for instantaneous zero-latency paints
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

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  const total = items.length;
  const totalRef = useRef(total);
  totalRef.current = total;

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

  // Pre-warm the next several posters in memory/disk cache to prevent decode latency
  useEffect(() => {
    if (!items || items.length === 0) return;
    const windowSlice = items.slice(0, 10);
    windowSlice.forEach((it) => {
      const p = it?.posterUrl || it?.backdropUrl;
      if (p) {
        try {
          Image.prefetch(tmdbImageAtSize(p, 'w780'));
        } catch (_) {}
      }
    });
  }, [items]);

  // Gesture and animation tracking
  const panX = useRef(new Animated.Value(0)).current;
  const isAnimatingRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);

  // Reset index when items pool changes (e.g. filter changes)
  useEffect(() => {
    setActiveIndex(0);
    panX.setValue(0);
    isAnimatingRef.current = false;
  }, [items, panX]);

  // Synchronously reset panX on index change before paint — eliminates snap-back twitch
  useLayoutEffect(() => {
    panX.setValue(0);
    isAnimatingRef.current = false;
  }, [activeIndex, panX]);

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

  // Forward transition animation
  const advanceToNext = useCallback(
    (steps = 1) => {
      if (totalRef.current <= 1 || isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      Animated.timing(panX, {
        toValue: -DECK_CARD_W - scale(30),
        duration: 260,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (_) {}
          setActiveIndex((prev) => (prev + steps) % totalRef.current);
        } else {
          isAnimatingRef.current = false;
        }
      });
    },
    [panX],
  );

  // Backward transition animation
  const advanceToPrev = useCallback(() => {
    if (totalRef.current <= 1 || isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    Animated.timing(panX, {
      toValue: DECK_CARD_W + scale(30),
      duration: 260,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (_) {}
        setActiveIndex((prev) => (prev - 1 + totalRef.current) % totalRef.current);
      } else {
        isAnimatingRef.current = false;
      }
    });
  }, [panX]);

  // Snap back when gesture is cancelled or under threshold
  const snapBack = useCallback(() => {
    isAnimatingRef.current = true;
    Animated.spring(panX, {
      toValue: 0,
      tension: 75,
      friction: 9,
      useNativeDriver: true,
    }).start(() => {
      isAnimatingRef.current = false;
    });
  }, [panX]);

  // Idle auto-rotation loop
  useEffect(() => {
    if (total <= 1 || reduceMotion) return undefined;
    const interval = setInterval(() => {
      if (pausedRef.current || isAnimatingRef.current) return;
      advanceToNext(1);
    }, HOME_HERO_ROTATION_MS);

    return () => clearInterval(interval);
  }, [total, reduceMotion, advanceToNext]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  // PanResponder to handle horizontal card swipe gestures seamlessly within vertical scroll
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
      },
      onPanResponderMove: (_, g) => {
        if (isAnimatingRef.current) return;
        panX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        scheduleResume();
        if (isAnimatingRef.current) return;

        if (g.dx < -SWIPE_THRESHOLD || g.vx < -SWIPE_VELOCITY) {
          advanceToNext(1);
        } else if (g.dx > SWIPE_THRESHOLD || g.vx > SWIPE_VELOCITY) {
          advanceToPrev();
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: () => {
        scheduleResume();
        snapBack();
      },
    }),
  ).current;

  if (!items || total === 0) return null;

  // Items currently positioned in the deck
  const item0 = items[activeIndex];
  const item1 = total > 1 ? items[(activeIndex + 1) % total] : null;
  const item2 = total > 2 ? items[(activeIndex + 2) % total] : null;
  const item3 = total > 3 ? items[(activeIndex + 3) % total] : null;
  const item4 = total > 4 ? items[(activeIndex + 4) % total] : null;
  const prevItem = total > 1 ? items[(activeIndex - 1 + total) % total] : null;

  // Interpolations for active card (Index 0)
  const card0TranslateX = panX;
  const card0Rotate = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: ['-5deg', '0deg', '4deg'],
    extrapolate: 'clamp',
  });
  const card0Opacity = panX.interpolate({
    inputRange: [-DECK_CARD_W * 1.15, -DECK_CARD_W * 0.7, 0, DECK_CARD_W],
    outputRange: [0, 0.5, 1, 0.85],
    extrapolate: 'clamp',
  });

  // Interpolations for Card 1 behind (steps into Card 0 position on left-swipe)
  const card1TranslateX = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [0, STACK_STEP_X, STACK_STEP_X * 2],
    extrapolate: 'clamp',
  });
  const card1Scale = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [1.0, 1.0 - STACK_STEP_SCALE, 1.0 - STACK_STEP_SCALE * 2],
    extrapolate: 'clamp',
  });
  const card1Scrim = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [0, 0.20, 0.40],
    extrapolate: 'clamp',
  });

  // Interpolations for Card 2 behind (steps into Card 1 position on left-swipe)
  const card2TranslateX = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [STACK_STEP_X, STACK_STEP_X * 2, STACK_STEP_X * 3],
    extrapolate: 'clamp',
  });
  const card2Scale = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [
      1.0 - STACK_STEP_SCALE,
      1.0 - STACK_STEP_SCALE * 2,
      1.0 - STACK_STEP_SCALE * 3,
    ],
    extrapolate: 'clamp',
  });
  const card2Scrim = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [0.20, 0.40, 0.58],
    extrapolate: 'clamp',
  });

  // Interpolations for Card 3 behind (steps into Card 2 position on left-swipe)
  const card3TranslateX = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [STACK_STEP_X * 2, STACK_STEP_X * 3, STACK_STEP_X * 3.6],
    extrapolate: 'clamp',
  });
  const card3Scale = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [
      1.0 - STACK_STEP_SCALE * 2,
      1.0 - STACK_STEP_SCALE * 3,
      1.0 - STACK_STEP_SCALE * 3.5,
    ],
    extrapolate: 'clamp',
  });
  const card3Scrim = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W],
    outputRange: [0.40, 0.58, 0.72],
    extrapolate: 'clamp',
  });
  const card3Opacity = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0, DECK_CARD_W * 0.6, DECK_CARD_W],
    outputRange: [1, 1, 0.4, 0],
    extrapolate: 'clamp',
  });

  // Card 4: Continuous tail buffer — smoothly slides and fades into Card 3's position during left-swipe
  const card4TranslateX = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0],
    outputRange: [STACK_STEP_X * 3, STACK_STEP_X * 3.6],
    extrapolate: 'clamp',
  });
  const card4Scale = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0],
    outputRange: [1.0 - STACK_STEP_SCALE * 3, 1.0 - STACK_STEP_SCALE * 3.5],
    extrapolate: 'clamp',
  });
  const card4Scrim = panX.interpolate({
    inputRange: [-DECK_CARD_W, 0],
    outputRange: [0.58, 0.72],
    extrapolate: 'clamp',
  });
  const card4Opacity = panX.interpolate({
    inputRange: [-DECK_CARD_W, -DECK_CARD_W * 0.35, 0],
    outputRange: [1, 0.45, 0],
    extrapolate: 'clamp',
  });

  // Previous card entering from the left on right-swipe
  const prevCardTranslateX = panX.interpolate({
    inputRange: [0, DECK_CARD_W],
    outputRange: [-DECK_CARD_W - scale(20), 0],
    extrapolate: 'clamp',
  });
  const prevCardOpacity = panX.interpolate({
    inputRange: [0, scale(20), DECK_CARD_W],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.deckRoot, style]}>
      {/* 3D Stack Container with PanGesture Responder — sits directly on continuous canvas */}
      <View style={styles.stackStage} {...panResponder.panHandlers}>
        {/* Card 4 (Incoming tail layer: pre-fades in at the back of the line so no new image pops in after swipe) */}
        {item4 ? (
          <Animated.View
            key="deck-card-layer-4"
            style={[
              styles.cardWrapper,
              styles.backCardShadow,
              {
                zIndex: 2,
                elevation: 2,
                left: STACK_LEFT,
                opacity: card4Opacity,
                transform: [
                  { translateX: card4TranslateX },
                  { scale: card4Scale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.cardFrame,
                {
                  borderRadius: radii.xl,
                },
              ]}
            >
              <MediaArtwork
                uri={tmdbImageAtSize(item4.posterUrl || item4.backdropUrl, 'w780')}
                style={styles.posterArt}
                resizeMode="cover"
                title={item4.title}
                instant={true}
              />
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.depthScrim,
                  { opacity: card4Scrim },
                ]}
                pointerEvents="none"
              />
            </View>
          </Animated.View>
        ) : null}

        {/* Card 3 (Deeper stack layer) */}
        {item3 ? (
          <Animated.View
            key="deck-card-layer-3"
            style={[
              styles.cardWrapper,
              styles.backCardShadow,
              {
                zIndex: 4,
                elevation: 3,
                left: STACK_LEFT,
                opacity: card3Opacity,
                transform: [
                  { translateX: card3TranslateX },
                  { scale: card3Scale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => advanceToNext(3)}
              style={[
                styles.cardFrame,
                {
                  borderRadius: radii.xl,
                },
              ]}
            >
              <MediaArtwork
                uri={tmdbImageAtSize(item3.posterUrl || item3.backdropUrl, 'w780')}
                style={styles.posterArt}
                resizeMode="cover"
                title={item3.title}
                instant={true}
              />
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.depthScrim,
                  { opacity: card3Scrim },
                ]}
                pointerEvents="none"
              />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Card 2 (Second stack layer) */}
        {item2 ? (
          <Animated.View
            key="deck-card-layer-2"
            style={[
              styles.cardWrapper,
              styles.backCardShadow,
              {
                zIndex: 6,
                elevation: 5,
                left: STACK_LEFT,
                transform: [
                  { translateX: card2TranslateX },
                  { scale: card2Scale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => advanceToNext(2)}
              style={[
                styles.cardFrame,
                {
                  borderRadius: radii.xl,
                },
              ]}
            >
              <MediaArtwork
                uri={tmdbImageAtSize(item2.posterUrl || item2.backdropUrl, 'w780')}
                style={styles.posterArt}
                resizeMode="cover"
                title={item2.title}
                instant={true}
              />
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.depthScrim,
                  { opacity: card2Scrim },
                ]}
                pointerEvents="none"
              />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Card 1 (First stack layer directly behind front card) */}
        {item1 ? (
          <Animated.View
            key="deck-card-layer-1"
            style={[
              styles.cardWrapper,
              styles.midCardShadow,
              {
                zIndex: 8,
                elevation: 8,
                left: STACK_LEFT,
                transform: [
                  { translateX: card1TranslateX },
                  { scale: card1Scale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => advanceToNext(1)}
              style={[
                styles.cardFrame,
                {
                  borderRadius: radii.xl,
                },
              ]}
            >
              <MediaArtwork
                uri={tmdbImageAtSize(item1.posterUrl || item1.backdropUrl, 'w780')}
                style={styles.posterArt}
                resizeMode="cover"
                title={item1.title}
                instant={true}
              />
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.depthScrim,
                  { opacity: card1Scrim },
                ]}
                pointerEvents="none"
              />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Card 0 (Active Front Card) */}
        {item0 ? (
          <Animated.View
            key="deck-card-layer-0"
            style={[
              styles.cardWrapper,
              styles.frontCardShadow,
              {
                zIndex: 10,
                elevation: 12,
                left: STACK_LEFT,
                opacity: card0Opacity,
                transform: [
                  { translateX: card0TranslateX },
                  { rotate: card0Rotate },
                ],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.94}
              onPress={() => onSelectItem?.(item0)}
              onPressIn={pauseRotation}
              onPressOut={scheduleResume}
              accessibilityRole="button"
              accessibilityLabel={`View ${item0.title}`}
              style={[
                styles.cardFrame,
                {
                  borderRadius: radii.xl,
                },
              ]}
            >
              <MediaArtwork
                uri={tmdbImageAtSize(item0.posterUrl || item0.backdropUrl, 'w780')}
                style={styles.posterArt}
                resizeMode="cover"
                title={item0.title}
                instant={true}
              />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Previous Card (Slides in from left when swiping right) */}
        {prevItem && total > 1 ? (
          <Animated.View
            key="deck-card-layer-prev"
            style={[
              styles.cardWrapper,
              styles.frontCardShadow,
              {
                zIndex: 12,
                elevation: 14,
                left: STACK_LEFT,
                opacity: prevCardOpacity,
                transform: [{ translateX: prevCardTranslateX }],
              },
            ]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.cardFrame,
                {
                  borderRadius: radii.xl,
                },
              ]}
            >
              <MediaArtwork
                uri={tmdbImageAtSize(prevItem.posterUrl || prevItem.backdropUrl, 'w780')}
                style={styles.posterArt}
                resizeMode="cover"
                title={prevItem.title}
                instant={true}
              />
            </View>
          </Animated.View>
        ) : null}
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
  frontCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.70,
    shadowRadius: 22,
  },
  midCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.50,
    shadowRadius: 14,
  },
  backCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
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
