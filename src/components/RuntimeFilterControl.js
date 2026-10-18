import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  RUNTIME_MIN,
  RUNTIME_MAX,
  RUNTIME_STEP,
  RUNTIME_MODES,
  getRuntimeMode,
  runtimeLowFromFilters,
  runtimeHighFromFilters,
} from '../lib/discoverRanges';
import { RulerScrubber } from './RulerScrubber';
import { GOLD_ACCENT } from '../theme/programme';
import { scale } from '../utils/responsive';

/**
 * Decoupled operator mode selector & haptic ruler dial for Runtime duration.
 *
 * Provides:
 * - Mode selection: ANY, UNDER, OVER, BETWEEN (no button backgrounds or borders).
 * - Under (max runtime) targeting for practical watch sessions.
 * - Sub-bound selector for BETWEEN duration bands.
 * - 5-minute precision haptic ruler with hour markers.
 */
export function RuntimeFilterControl({ minRuntime, maxRuntime, onChange, colors, typography }) {
  const detectedMode = useMemo(
    () => getRuntimeMode(minRuntime, maxRuntime),
    [minRuntime, maxRuntime],
  );
  const [explicitMode, setExplicitMode] = useState(null);
  const [activeBound, setActiveBound] = useState('high'); // Default 'high' because runtime is most often capped (Under)

  useEffect(() => {
    if (!minRuntime && !maxRuntime) {
      setExplicitMode(null);
    }
  }, [minRuntime, maxRuntime]);

  const currentMode = explicitMode || detectedMode;

  const lowNum = useMemo(() => runtimeLowFromFilters(minRuntime), [minRuntime]);
  const highNum = useMemo(() => runtimeHighFromFilters(maxRuntime), [maxRuntime]);

  const handleSelectMode = useCallback(
    (modeId) => {
      Haptics.selectionAsync();
      setExplicitMode(modeId === 'ANY' ? null : modeId);

      switch (modeId) {
        case 'ANY':
          onChange('', '');
          break;
        case 'UNDER': {
          const target = maxRuntime ? parseInt(maxRuntime, 10) : 105;
          onChange('', String(target));
          setActiveBound('high');
          break;
        }
        case 'OVER': {
          const target = minRuntime ? parseInt(minRuntime, 10) : 90;
          onChange(String(target), '');
          setActiveBound('low');
          break;
        }
        case 'BETWEEN': {
          const start = minRuntime ? parseInt(minRuntime, 10) : 90;
          const end = maxRuntime ? parseInt(maxRuntime, 10) : 120;
          if (start <= end) {
            onChange(String(start), String(end));
          } else {
            onChange(String(end), String(start));
          }
          break;
        }
      }
    },
    [minRuntime, maxRuntime, onChange],
  );

  const handleRulerChange = useCallback(
    (val) => {
      switch (currentMode) {
        case 'UNDER':
          onChange('', String(val));
          break;
        case 'OVER':
          onChange(String(val), '');
          break;
        case 'BETWEEN':
          if (activeBound === 'low') {
            const nextLow = Math.min(val, highNum);
            onChange(String(nextLow), maxRuntime || String(RUNTIME_MAX));
          } else {
            const nextHigh = Math.max(val, lowNum);
            onChange(minRuntime || String(RUNTIME_MIN), String(nextHigh));
          }
          break;
      }
    },
    [currentMode, activeBound, highNum, lowNum, maxRuntime, minRuntime, onChange],
  );

  const rulerValue = useMemo(() => {
    if (currentMode === 'UNDER') return highNum > 0 && highNum < RUNTIME_MAX ? highNum : 105;
    if (currentMode === 'OVER') return lowNum > 0 ? lowNum : 90;
    if (currentMode === 'BETWEEN') return activeBound === 'low' ? lowNum : highNum;
    return 90;
  }, [currentMode, activeBound, lowNum, highNum]);

  const isBetween = currentMode === 'BETWEEN';
  const showRuler = currentMode !== 'ANY';

  const onSurfaceVar = colors?.onSurfaceVariant || '#8a8a8e';

  return (
    <View style={styles.root}>
      {/* Operator Mode Bar: Pure text buttons, no borders, no backgrounds */}
      <View style={styles.modeRow}>
        {RUNTIME_MODES.map((m) => {
          const selected = currentMode === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => handleSelectMode(m.id)}
              activeOpacity={0.7}
              style={styles.modeBtn}
              accessibilityRole="button"
              accessibilityLabel={`${m.label} runtime mode`}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  typography?.labelSm,
                  selected
                    ? [styles.modeBtnTextActive, { color: GOLD_ACCENT }]
                    : [styles.modeBtnTextInactive, { color: onSurfaceVar }],
                ]}
              >
                {m.label}
              </Text>
              {selected && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sub-selector when Between is active */}
      {isBetween && (
        <View style={styles.subBoundRow}>
          <TouchableOpacity
            style={styles.boundBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveBound('low');
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Set minimum runtime, currently ${lowNum} minutes`}
          >
            <Text
              style={[
                styles.boundLabel,
                typography?.labelSm,
                activeBound === 'low'
                  ? [styles.boundActive, { color: GOLD_ACCENT }]
                  : [styles.boundInactive, { color: onSurfaceVar }],
              ]}
            >
              MIN {lowNum} min
            </Text>
            {activeBound === 'low' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          <Text style={[styles.boundSeparator, { color: onSurfaceVar }]}>—</Text>

          <TouchableOpacity
            style={styles.boundBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveBound('high');
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Set maximum runtime, currently ${highNum} minutes`}
          >
            <Text
              style={[
                styles.boundLabel,
                typography?.labelSm,
                activeBound === 'high'
                  ? [styles.boundActive, { color: GOLD_ACCENT }]
                  : [styles.boundInactive, { color: onSurfaceVar }],
              ]}
            >
              MAX {highNum} min
            </Text>
            {activeBound === 'high' && <View style={styles.activeDot} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Ruler Dial */}
      {showRuler && (
        <RulerScrubber
          min={15}
          max={RUNTIME_MAX}
          step={RUNTIME_STEP}
          value={rulerValue}
          onChange={handleRulerChange}
          tickSpacing={20}
          isMajorTick={(v) => v % 30 === 0}
          isMediumTick={(v) => v % 15 === 0}
          formatTick={(v) => `${v} min`}
          formatValue={(val) => {
            if (currentMode === 'UNDER') return `Up to ${val} min`;
            if (currentMode === 'OVER') return `Over ${val} min`;
            if (currentMode === 'BETWEEN') {
              return activeBound === 'low' ? `From ${val} min` : `Up to ${val} min`;
            }
            return `${val} min`;
          }}
          colors={colors}
          typography={typography}
          accessibilityLabel="Runtime Duration"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginTop: scale(2),
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: scale(14),
    paddingVertical: scale(4),
  },
  modeBtn: {
    paddingVertical: scale(4),
    paddingHorizontal: scale(2),
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnText: {
    fontSize: scale(11),
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  modeBtnTextInactive: {
    fontWeight: '600',
  },
  modeBtnTextActive: {
    fontWeight: '800',
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: GOLD_ACCENT,
    marginTop: scale(3),
  },
  subBoundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginVertical: scale(4),
  },
  boundBtn: {
    paddingVertical: scale(3),
    paddingHorizontal: scale(2),
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
  },
  boundLabel: {
    fontSize: scale(10),
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  boundInactive: {
    fontWeight: '600',
  },
  boundActive: {
    fontWeight: '800',
  },
  boundSeparator: {
    fontSize: scale(12),
  },
});
