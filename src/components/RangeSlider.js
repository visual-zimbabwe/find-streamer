import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';

// A controlled dual-thumb range slider. Built on Reanimated + gesture-handler,
// deliberately NOT RN Animated: under Fabric the native driver commits stale JS
// values and self-cancels on re-render (see [[rn-animated-native-driver-unreliable]]),
// which is exactly what a drag-tracking thumb cannot tolerate.
//
// Values are numeric [min, max]; the parent maps to/from the filter model. When a
// `distribution` (normalized weights) is supplied, an ambient histogram is drawn
// behind the track with the in-range bars highlighted live as the thumbs move —
// the Zillow/Airbnb "see what you're cutting into" affordance.

const THUMB = 26;
const TRACK_H = 5;
const HIST_H = 34;

export function RangeSlider({
  min,
  max,
  step,
  low,
  high,
  onChange,
  distribution = null,
  colors,
  labelLow = 'Minimum',
  labelHigh = 'Maximum',
  formatValue = (n) => String(n),
}) {
  const [wrapW, setWrapW] = useState(0);
  const widthSV = useSharedValue(0);
  const lowSV = useSharedValue(low);
  const highSV = useSharedValue(high);
  const lowStart = useSharedValue(low);
  const highStart = useSharedValue(high);

  const draggingRef = useRef(false);
  const lowRef = useRef(low);
  const highRef = useRef(high);
  // The parent passes an inline onChange, so hold it in a ref and keep the emit
  // callbacks stable — otherwise the gesture useMemo below would rebuild on every
  // keystroke of state it triggers and gesture-handler could drop the live touch.
  const onChangeRef = useRef(onChange);

  const range = max - min;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    lowRef.current = low;
    highRef.current = high;
    // Sync the shared values from props unless a drag is in flight — this lets an
    // external Reset move the thumbs without fighting a live gesture.
    if (!draggingRef.current) {
      lowSV.value = low;
      highSV.value = high;
    }
  }, [low, high, lowSV, highSV]);

  const emitLow = useCallback((v) => onChangeRef.current(v, highRef.current), []);
  const emitHigh = useCallback((v) => onChangeRef.current(lowRef.current, v), []);
  const setDragging = useCallback((v) => {
    draggingRef.current = v;
  }, []);

  const panLow = useMemo(
    () =>
      Gesture.Pan()
        // Activate on horizontal movement and yield to the parent ScrollView on a
        // vertical drag, so a scroll that lands on a thumb still scrolls.
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          lowStart.value = lowSV.value;
          runOnJS(setDragging)(true);
        })
        .onUpdate((e) => {
          const usable = widthSV.value - THUMB;
          if (usable <= 0) return;
          let v = lowStart.value + (e.translationX / usable) * range;
          v = Math.round(v / step) * step;
          v = Math.max(min, Math.min(v, highSV.value - step));
          if (v !== lowSV.value) {
            lowSV.value = v;
            runOnJS(emitLow)(v);
          }
        })
        .onFinalize(() => {
          runOnJS(setDragging)(false);
        }),
    [min, range, step, emitLow, setDragging, lowSV, highSV, lowStart, widthSV],
  );

  const panHigh = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          highStart.value = highSV.value;
          runOnJS(setDragging)(true);
        })
        .onUpdate((e) => {
          const usable = widthSV.value - THUMB;
          if (usable <= 0) return;
          let v = highStart.value + (e.translationX / usable) * range;
          v = Math.round(v / step) * step;
          v = Math.min(max, Math.max(v, lowSV.value + step));
          if (v !== highSV.value) {
            highSV.value = v;
            runOnJS(emitHigh)(v);
          }
        })
        .onFinalize(() => {
          runOnJS(setDragging)(false);
        }),
    [max, range, step, emitHigh, setDragging, lowSV, highSV, highStart, widthSV],
  );

  const lowThumbStyle = useAnimatedStyle(() => {
    const usable = widthSV.value - THUMB;
    const pct = range === 0 ? 0 : (lowSV.value - min) / range;
    return { transform: [{ translateX: pct * usable }] };
  });

  const highThumbStyle = useAnimatedStyle(() => {
    const usable = widthSV.value - THUMB;
    const pct = range === 0 ? 0 : (highSV.value - min) / range;
    return { transform: [{ translateX: pct * usable }] };
  });

  const activeTrackStyle = useAnimatedStyle(() => {
    const usable = widthSV.value - THUMB;
    const lp = range === 0 ? 0 : (lowSV.value - min) / range;
    const hp = range === 0 ? 0 : (highSV.value - min) / range;
    return { left: lp * usable, width: Math.max(0, (hp - lp) * usable) };
  });

  const topPad = distribution ? HIST_H : 12;
  const trackTop = topPad;
  const thumbTop = topPad + TRACK_H / 2 - THUMB / 2;

  const onWrapLayout = useCallback(
    (e) => {
      const w = e.nativeEvent.layout.width;
      setWrapW(w);
      widthSV.value = w;
    },
    [widthSV],
  );

  const stepBy = useCallback(
    (which, dir) => {
      if (which === 'low') {
        const next = Math.max(min, Math.min(lowRef.current + dir * step, highRef.current - step));
        emitLow(next);
      } else {
        const next = Math.min(max, Math.max(highRef.current + dir * step, lowRef.current + step));
        emitHigh(next);
      }
    },
    [min, max, step, emitLow, emitHigh],
  );

  return (
    <View style={[styles.wrap, { height: topPad + THUMB }]} onLayout={onWrapLayout}>
      {/* Ambient distribution histogram (rec 5). The curve is static/approximate;
          the highlight tracks the live selection. */}
      {distribution && wrapW > 0 && (
        <View style={[styles.histRow, { height: HIST_H }]} pointerEvents="none">
          {distribution.map((weight, i) => {
            const center = min + ((i + 0.5) / distribution.length) * range;
            const inRange = center >= low && center <= high;
            return (
              <View
                key={i}
                style={[
                  styles.histBar,
                  {
                    height: Math.max(2, weight * HIST_H),
                    backgroundColor: inRange ? GOLD_ACCENT + '4D' : (colors?.onSurfaceVariant || '#888') + '1F',
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Track */}
      <View
        style={[
          styles.track,
          { top: trackTop, height: TRACK_H, backgroundColor: GOLD_DIM },
        ]}
        pointerEvents="none"
      >
        <Reanimated.View style={[styles.activeTrack, activeTrackStyle, { backgroundColor: GOLD_ACCENT }]} />
      </View>

      {/* Low thumb */}
      <GestureDetector gesture={panLow}>
        <Reanimated.View
          style={[styles.thumb, { top: thumbTop }, lowThumbStyle]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={labelLow}
          accessibilityValue={{ min, max, now: low, text: formatValue(low) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(ev) => stepBy('low', ev.nativeEvent.actionName === 'increment' ? 1 : -1)}
        >
          <View style={[styles.thumbDot, { backgroundColor: GOLD_ACCENT, borderColor: colors?.background || '#141414' }]} />
        </Reanimated.View>
      </GestureDetector>

      {/* High thumb */}
      <GestureDetector gesture={panHigh}>
        <Reanimated.View
          style={[styles.thumb, { top: thumbTop }, highThumbStyle]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={labelHigh}
          accessibilityValue={{ min, max, now: high, text: formatValue(high) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(ev) => stepBy('high', ev.nativeEvent.actionName === 'increment' ? 1 : -1)}
        >
          <View style={[styles.thumbDot, { backgroundColor: GOLD_ACCENT, borderColor: colors?.background || '#141414' }]} />
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    justifyContent: 'center',
  },
  histRow: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  histBar: {
    flex: 1,
    marginHorizontal: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  track: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  activeTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbDot: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    // A soft lift so the thumb reads above the histogram bars.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
});
