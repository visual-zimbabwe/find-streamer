import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  RATING_MIN,
  RATING_MAX,
  RATING_CUSTOM_STEP,
  RATING_PRESETS,
  getRatingMode,
  ratingLowFromFilters,
  ratingHighFromFilters,
  ratingFiltersFromRange,
  ratingText,
} from '../lib/discoverRanges';
import { RulerScrubber } from './RulerScrubber';
import { GOLD_ACCENT } from '../theme/programme';
import { scale } from '../utils/responsive';

const CUSTOM_SUB_MODES = [
  { id: 'MIN', label: 'Minimum' },
  { id: 'MAX', label: 'Maximum' },
  { id: 'BETWEEN', label: 'Between' },
  { id: 'EXACT', label: 'Exact' },
];

/**
 * Quick quality preset selector with 0.1-increment custom haptic ruler dial.
 *
 * Provides:
 * - One-tap rating floors (6+, 7+, 8+, Any) with no button backgrounds or borders.
 * - Custom mode supporting 0.1 precision increments (e.g. 7.3+, 8.2+).
 * - Exact and Between rating sub-modes.
 */
export function RatingFilterControl({ minRating, maxRating, onChange, colors, typography }) {
  const detectedMode = useMemo(() => getRatingMode(minRating, maxRating), [minRating, maxRating]);
  const [explicitCustom, setExplicitCustom] = useState(false);
  const [customSubMode, setCustomSubMode] = useState('MIN'); // 'MIN', 'MAX', 'BETWEEN', 'EXACT'
  const [activeBound, setActiveBound] = useState('low'); // 'low' or 'high' for BETWEEN

  const isCustom = explicitCustom || detectedMode === 'CUSTOM';
  const currentMode = isCustom ? 'CUSTOM' : detectedMode;

  const lowNum = useMemo(() => ratingLowFromFilters(minRating), [minRating]);
  const highNum = useMemo(() => ratingHighFromFilters(maxRating), [maxRating]);

  const handleSelectPreset = useCallback(
    (preset) => {
      Haptics.selectionAsync();

      if (preset.id === 'CUSTOM') {
        setExplicitCustom(true);
        const targetLow = lowNum > 0 ? lowNum : 7.0;
        const targetHigh = highNum < 10 ? highNum : 10.0;
        const { minRating: loStr, maxRating: hiStr } = ratingFiltersFromRange(
          targetLow,
          targetHigh,
        );
        onChange(loStr, hiStr);
        return;
      }

      setExplicitCustom(false);
      onChange(preset.min, preset.max);
    },
    [lowNum, highNum, onChange],
  );

  const handleSelectSubMode = useCallback(
    (subModeId) => {
      Haptics.selectionAsync();
      setCustomSubMode(subModeId);

      const curLow = lowNum > 0 ? lowNum : 7.0;
      const curHigh = highNum < 10 ? highNum : 10.0;

      switch (subModeId) {
        case 'MIN':
          onChange(curLow.toFixed(1), '10.0');
          setActiveBound('low');
          break;
        case 'MAX':
          onChange('0', curHigh.toFixed(1));
          setActiveBound('high');
          break;
        case 'EXACT':
          onChange(curLow.toFixed(1), curLow.toFixed(1));
          break;
        case 'BETWEEN':
          onChange(curLow.toFixed(1), curHigh.toFixed(1));
          break;
      }
    },
    [lowNum, highNum, onChange],
  );

  const handleRulerChange = useCallback(
    (val) => {
      const formatted = val.toFixed(1);

      switch (customSubMode) {
        case 'MIN':
          onChange(formatted, '10.0');
          break;
        case 'MAX':
          onChange('0', formatted);
          break;
        case 'EXACT':
          onChange(formatted, formatted);
          break;
        case 'BETWEEN':
          if (activeBound === 'low') {
            const nextLow = Math.min(val, highNum);
            onChange(nextLow.toFixed(1), highNum.toFixed(1));
          } else {
            const nextHigh = Math.max(val, lowNum);
            onChange(lowNum.toFixed(1), nextHigh.toFixed(1));
          }
          break;
      }
    },
    [customSubMode, activeBound, highNum, lowNum, onChange],
  );

  const isBetween = isCustom && customSubMode === 'BETWEEN';

  const rulerValue = useMemo(() => {
    if (customSubMode === 'MAX') return highNum < 10 ? highNum : 8.5;
    if (customSubMode === 'BETWEEN') return activeBound === 'low' ? lowNum : highNum;
    return lowNum > 0 ? lowNum : 7.0;
  }, [customSubMode, activeBound, lowNum, highNum]);

  const onSurfaceVar = colors?.onSurfaceVariant || '#8a8a8e';

  return (
    <View style={styles.root}>
      {/* Preset Row: Pure text buttons, no borders, no backgrounds */}
      <View style={styles.modeRow}>
        {RATING_PRESETS.map((p) => {
          const selected = currentMode === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => handleSelectPreset(p)}
              activeOpacity={0.7}
              style={styles.modeBtn}
              accessibilityRole="button"
              accessibilityLabel={`${p.label} rating preset`}
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
                {p.label}
              </Text>
              {selected && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom Sub-Mode Bar */}
      {isCustom && (
        <View style={styles.subModeRow}>
          {CUSTOM_SUB_MODES.map((sm) => {
            const selected = customSubMode === sm.id;
            return (
              <TouchableOpacity
                key={sm.id}
                onPress={() => handleSelectSubMode(sm.id)}
                activeOpacity={0.7}
                style={styles.subModeBtn}
                accessibilityRole="button"
                accessibilityLabel={`${sm.label} custom rating mode`}
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.subModeText,
                    typography?.labelSm,
                    selected
                      ? [styles.modeBtnTextActive, { color: GOLD_ACCENT }]
                      : [styles.modeBtnTextInactive, { color: onSurfaceVar }],
                  ]}
                >
                  {sm.label}
                </Text>
                {selected && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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
            accessibilityLabel={`Set minimum rating, currently ${ratingText(lowNum)}`}
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
              MIN {ratingText(lowNum)}
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
            accessibilityLabel={`Set maximum rating, currently ${ratingText(highNum)}`}
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
              MAX {ratingText(highNum)}
            </Text>
            {activeBound === 'high' && <View style={styles.activeDot} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Custom 0.1 Ruler Dial */}
      {isCustom && (
        <RulerScrubber
          min={RATING_MIN}
          max={RATING_MAX}
          step={RATING_CUSTOM_STEP}
          value={rulerValue}
          onChange={handleRulerChange}
          tickSpacing={14}
          isMajorTick={(v) => Math.abs(v - Math.round(v)) < 0.01}
          isMediumTick={(v) => {
            const frac = Math.round((v % 1) * 10);
            return frac === 5 || frac === -5;
          }}
          formatTick={(v) => String(Math.round(v))}
          formatValue={(val) => {
            const formatted = val.toFixed(1);
            if (customSubMode === 'MIN') return `${formatted}+`;
            if (customSubMode === 'MAX') return `Up to ${formatted}`;
            if (customSubMode === 'EXACT') return `${formatted}`;
            if (customSubMode === 'BETWEEN') {
              return activeBound === 'low' ? `From ${formatted}` : `To ${formatted}`;
            }
            return formatted;
          }}
          colors={colors}
          typography={typography}
          accessibilityLabel="Custom Rating Score"
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
  subModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginTop: scale(4),
    marginBottom: scale(2),
  },
  subModeBtn: {
    paddingVertical: scale(3),
    paddingHorizontal: scale(2),
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
  },
  subModeText: {
    fontSize: scale(10),
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  subBoundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
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
