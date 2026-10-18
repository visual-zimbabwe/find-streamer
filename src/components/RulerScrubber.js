import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { scale } from '../utils/responsive';

/**
 * High-precision tactile horizontal ruler dial.
 *
 * Replaces dual-thumb sliders with a physical, inertial tape scrubber.
 * Each unit gets ample horizontal travel (14–22 dp per tick) instead of
 * compressing 120+ units into a ~300 dp screen.
 *
 * Compliant with user design specifications:
 * - Avoids button backgrounds and borders (pure text / typography).
 * - Avoids emojis and redundant icons.
 * - Supports arbitrary step resolutions, including 0.1 for custom ratings.
 * - Emits tactile haptic ticks as values cross the gold reticle.
 */
export function RulerScrubber({
  min,
  max,
  step = 1,
  value,
  onChange,
  tickSpacing = 20,
  formatTick = null,
  formatValue = null,
  isMajorTick = null,
  isMediumTick = null,
  colors,
  typography,
  accessibilityLabel = 'Ruler Scrubber',
}) {
  const [wrapWidth, setWrapWidth] = useState(0);
  const [liveVal, setLiveVal] = useState(value);
  const widthSV = useSharedValue(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const draggingRef = useRef(false);
  const lastEmittedRef = useRef(value);
  const lastHapticTimeRef = useRef(0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Resolution factor for rounding floating point steps cleanly (e.g. 0.1 -> 10, 1 -> 1)
  const precision = useMemo(() => {
    if (step <= 0.01) return 100;
    if (step <= 0.1) return 10;
    return 1;
  }, [step]);

  const totalTicks = useMemo(() => {
    return Math.max(1, Math.round((max - min) / step) + 1);
  }, [min, max, step]);

  const trackWidth = useMemo(() => {
    return (totalTicks - 1) * tickSpacing;
  }, [totalTicks, tickSpacing]);

  // Compute offset for a given value
  const getOffsetForValue = useCallback(
    (val, width) => {
      if (width <= 0) return 0;
      const index = Math.max(0, Math.min(totalTicks - 1, Math.round((val - min) / step)));
      return width / 2 - index * tickSpacing;
    },
    [min, step, totalTicks, tickSpacing],
  );

  // Sync prop changes into shared value position ONLY when originating externally
  useEffect(() => {
    if (value === lastEmittedRef.current) {
      // Echo of our own emit — we are already at or animating to this value.
      return;
    }
    lastEmittedRef.current = value;
    setLiveVal(value);
    if (!draggingRef.current && wrapWidth > 0) {
      cancelAnimation(translateX);
      const target = getOffsetForValue(value, wrapWidth);
      translateX.value = withTiming(target, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [value, wrapWidth, getOffsetForValue, translateX]);

  const emitValue = useCallback((newVal) => {
    if (newVal !== lastEmittedRef.current) {
      lastEmittedRef.current = newVal;
      setLiveVal(newVal);
      const now = Date.now();
      if (now - lastHapticTimeRef.current >= 35) {
        lastHapticTimeRef.current = now;
        Haptics.selectionAsync().catch(() => {});
      }
      onChangeRef.current?.(newVal);
    }
  }, []);

  const setDraggingState = useCallback((active) => {
    draggingRef.current = active;
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        // Horizontal travel activates scrubber; vertical travel yields to parent FlatList
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          cancelAnimation(translateX);
          startX.value = translateX.value;
          isDragging.value = true;
          runOnJS(setDraggingState)(true);
        })
        .onUpdate((e) => {
          const w = widthSV.value;
          if (w <= 0) return;
          const minX = w / 2 - trackWidth;
          const maxX = w / 2;
          const nextX = Math.max(minX, Math.min(maxX, startX.value + e.translationX));
          translateX.value = nextX;

          // Compute closest stepped value under reticle directly from track offset
          const rawIdx = (w / 2 - nextX) / tickSpacing;
          const snappedIdx = Math.max(0, Math.min(totalTicks - 1, Math.round(rawIdx)));
          const rawValue = min + snappedIdx * step;
          const snappedValue = Math.round(rawValue * precision) / precision;

          runOnJS(emitValue)(snappedValue);
        })
        .onFinalize((e) => {
          const w = widthSV.value;
          if (w <= 0) {
            isDragging.value = false;
            runOnJS(setDraggingState)(false);
            return;
          }

          const minX = w / 2 - trackWidth;
          const maxX = w / 2;
          const v = e.velocityX || 0;
          let targetX;

          if (Math.abs(v) > 220) {
            // Natural momentum flick: project landing with smooth deceleration
            const throwDistance = v * 0.12;
            const projectedX = Math.max(minX, Math.min(maxX, translateX.value + throwDistance));
            const landingIdx = Math.max(0, Math.min(totalTicks - 1, Math.round((w / 2 - projectedX) / tickSpacing)));
            targetX = w / 2 - landingIdx * tickSpacing;

            const finalRaw = min + landingIdx * step;
            const finalVal = Math.round(finalRaw * precision) / precision;
            runOnJS(emitValue)(finalVal);

            translateX.value = withTiming(
              targetX,
              {
                duration: Math.min(320, Math.max(140, Math.abs(v) * 0.12)),
                easing: Easing.out(Easing.cubic),
              },
              (finished) => {
                if (finished) {
                  isDragging.value = false;
                  runOnJS(setDraggingState)(false);
                }
              },
            );
          } else {
            // Direct release: gentle settle to the nearest tick right under the needle
            const rawIdx = (w / 2 - translateX.value) / tickSpacing;
            const snappedIdx = Math.max(0, Math.min(totalTicks - 1, Math.round(rawIdx)));
            targetX = w / 2 - snappedIdx * tickSpacing;

            const finalRaw = min + snappedIdx * step;
            const finalVal = Math.round(finalRaw * precision) / precision;
            runOnJS(emitValue)(finalVal);

            translateX.value = withTiming(
              targetX,
              {
                duration: 90,
                easing: Easing.out(Easing.quad),
              },
              (finished) => {
                if (finished) {
                  isDragging.value = false;
                  runOnJS(setDraggingState)(false);
                }
              },
            );
          }
        }),
    [
      min,
      step,
      precision,
      totalTicks,
      trackWidth,
      tickSpacing,
      emitValue,
      setDraggingState,
      startX,
      translateX,
      isDragging,
      widthSV,
    ],
  );

  const animatedTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const onLayout = useCallback(
    (e) => {
      const w = e.nativeEvent.layout.width;
      setWrapWidth(w);
      widthSV.value = w;
      translateX.value = getOffsetForValue(value, w);
    },
    [getOffsetForValue, value, widthSV, translateX],
  );

  // Micro-step nudge handlers: button-background-free and border-free
  const handleNudge = useCallback(
    (direction) => {
      const current = lastEmittedRef.current ?? value;
      const raw = current + direction * step;
      const rounded = Math.round(raw * precision) / precision;
      const next = Math.max(min, Math.min(max, rounded));
      if (next !== current) {
        lastEmittedRef.current = next;
        setLiveVal(next);
        emitValue(next);
        if (wrapWidth > 0) {
          cancelAnimation(translateX);
          const target = getOffsetForValue(next, wrapWidth);
          translateX.value = withTiming(target, {
            duration: 120,
            easing: Easing.out(Easing.quad),
          });
        }
      }
    },
    [value, step, precision, min, max, emitValue, wrapWidth, getOffsetForValue, translateX],
  );

  // Pre-generate tick markers
  const ticks = useMemo(() => {
    const list = [];
    for (let i = 0; i < totalTicks; i++) {
      const val = Math.round((min + i * step) * precision) / precision;
      const major = isMajorTick ? isMajorTick(val) : i % 10 === 0;
      const medium = isMediumTick ? isMediumTick(val) : !major && i % 5 === 0;
      const label = major && formatTick ? formatTick(val) : null;
      list.push({ val, major, medium, label, index: i });
    }
    return list;
  }, [min, step, totalTicks, precision, isMajorTick, isMediumTick, formatTick]);

  const bg = colors?.background || '#0e0e0e';
  const onSurfaceVar = colors?.onSurfaceVariant || '#8a8a8e';

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
    >
      {/* Prominent Center Value Readout */}
      <View style={styles.reticleBadge} pointerEvents="none">
        <Text
          style={[styles.reticleValueText, { color: GOLD_ACCENT }]}
          numberOfLines={1}
        >
          {formatValue ? formatValue(liveVal) : liveVal}
        </Text>
      </View>

      {/* Reticle: Fixed Gold Needle Indicator */}
      <View style={styles.reticleWrap} pointerEvents="none">
        <View style={styles.reticlePoint} />
        <View style={styles.reticleLine} />
      </View>

      {/* Interactive Horizontally Scrollable Tick Track */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.gestureSurface}>
          {wrapWidth > 0 && (
            <Reanimated.View style={[styles.track, { width: trackWidth }, animatedTrackStyle]}>
              {ticks.map((t) => (
                <View
                  key={t.index}
                  style={[
                    styles.tickCell,
                    {
                      left: t.index * tickSpacing,
                      width: tickSpacing,
                    },
                  ]}
                >
                  {/* Tick Mark Line */}
                  <View
                    style={[
                      styles.tickMark,
                      t.major
                        ? [styles.tickMajor, { backgroundColor: GOLD_ACCENT }]
                        : t.medium
                          ? [styles.tickMedium, { backgroundColor: GOLD_ACCENT + '80' }]
                          : [styles.tickMinor, { backgroundColor: GOLD_DIM }],
                    ]}
                  />

                  {/* Tick Label (for major intervals, rendered below ticks with full width) */}
                  {t.label != null && (
                    <Text
                      style={[
                        styles.tickLabel,
                        {
                          left: (tickSpacing - scale(72)) / 2,
                          color: onSurfaceVar,
                          ...typography?.labelSm,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t.label}
                    </Text>
                  )}
                </View>
              ))}
            </Reanimated.View>
          )}
        </View>
      </GestureDetector>

      {/* Vignette Edge Gradients */}
      <LinearGradient
        colors={[bg, 'rgba(0,0,0,0)']}
        start={[0, 0]}
        end={[1, 0]}
        style={styles.vignetteLeft}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', bg]}
        start={[0, 0]}
        end={[1, 0]}
        style={styles.vignetteRight}
        pointerEvents="none"
      />

      {/* Micro-Steppers (No borders, No background colors) */}
      <TouchableOpacity
        style={styles.nudgeBtnLeft}
        onPress={() => handleNudge(-1)}
        activeOpacity={0.6}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${accessibilityLabel}`}
      >
        <Text style={[styles.nudgeText, { color: onSurfaceVar }]}>–</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.nudgeBtnRight}
        onPress={() => handleNudge(1)}
        activeOpacity={0.6}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${accessibilityLabel}`}
      >
        <Text style={[styles.nudgeText, { color: onSurfaceVar }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: scale(78),
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: scale(4),
  },
  gestureSurface: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  track: {
    height: '100%',
    position: 'relative',
  },
  reticleBadge: {
    position: 'absolute',
    top: scale(2),
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  reticleValueText: {
    fontSize: scale(14),
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  reticleWrap: {
    position: 'absolute',
    left: '50%',
    top: scale(24),
    width: 10,
    marginLeft: -5,
    alignItems: 'center',
    zIndex: 10,
  },
  reticlePoint: {
    width: 5,
    height: 5,
    backgroundColor: GOLD_ACCENT,
    transform: [{ rotate: '45deg' }],
    marginBottom: scale(1),
  },
  reticleLine: {
    width: 2,
    height: scale(24),
    backgroundColor: GOLD_ACCENT,
    borderRadius: 1,
  },
  tickCell: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: scale(27),
    overflow: 'visible',
  },
  tickMark: {
    width: 1,
    borderRadius: 0.5,
  },
  tickMajor: {
    height: scale(22),
    width: 1.5,
  },
  tickMedium: {
    height: scale(14),
    width: 1,
  },
  tickMinor: {
    height: scale(8),
    width: 1,
  },
  tickLabel: {
    position: 'absolute',
    top: scale(54),
    width: scale(72),
    fontSize: scale(9.5),
    letterSpacing: 0.5,
    textAlign: 'center',
    fontWeight: '600',
  },
  vignetteLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: scale(48),
    zIndex: 5,
  },
  vignetteRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: scale(48),
    zIndex: 5,
  },
  nudgeBtnLeft: {
    position: 'absolute',
    left: scale(2),
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    backgroundColor: 'transparent',
    borderWidth: 0,
    zIndex: 20,
  },
  nudgeBtnRight: {
    position: 'absolute',
    right: scale(2),
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    backgroundColor: 'transparent',
    borderWidth: 0,
    zIndex: 20,
  },
  nudgeText: {
    fontSize: scale(18),
    fontWeight: '700',
  },
});
