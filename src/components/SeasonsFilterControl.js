import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  SEASONS_MIN,
  SEASONS_MAX,
  SEASONS_STEP,
  SEASONS_PRESETS,
  SEASONS_SUB_MODES,
  getSeasonsMode,
  getSeasonsSubMode,
  seasonsLowFromFilters,
  seasonsHighFromFilters,
  formatSeasonsCountLabel,
} from '../lib/discoverRanges';
import { RulerScrubber } from './RulerScrubber';
import { GOLD_ACCENT } from '../theme/programme';
import { scale } from '../utils/responsive';

/**
 * TV Show Number of Seasons filter control.
 *
 * Provides:
 * - Instant one-tap presets: Any, 1, 2, 3, 5+ (Long), Custom (pure text buttons,
 *   no button backgrounds or borders, no decorative icons).
 * - Custom mode with sub-modes: Exact, At least (Over), Up to (Under), Between,
 *   backed by a 1-season-step tactile RulerScrubber (1 to 25 seasons).
 */
export function SeasonsFilterControl({ minSeasons, maxSeasons, onChange, colors, typography }) {
  const detectedMode = useMemo(
    () => getSeasonsMode(minSeasons, maxSeasons),
    [minSeasons, maxSeasons],
  );
  const [explicitCustom, setExplicitCustom] = useState(false);
  const [customSubMode, setCustomSubMode] = useState(() =>
    getSeasonsSubMode(minSeasons, maxSeasons),
  );
  const [activeBound, setActiveBound] = useState('low');

  useEffect(() => {
    if (!minSeasons && !maxSeasons) {
      setExplicitCustom(false);
    } else if (detectedMode === 'CUSTOM') {
      setCustomSubMode(getSeasonsSubMode(minSeasons, maxSeasons));
    }
  }, [minSeasons, maxSeasons, detectedMode]);

  const isCustom = explicitCustom || detectedMode === 'CUSTOM';
  const currentMode = isCustom ? 'CUSTOM' : detectedMode;

  const lowNum = useMemo(() => seasonsLowFromFilters(minSeasons), [minSeasons]);
  const highNum = useMemo(() => seasonsHighFromFilters(maxSeasons), [maxSeasons]);

  const handleSelectPreset = useCallback(
    (preset) => {
      Haptics.selectionAsync();

      if (preset.id === 'CUSTOM') {
        setExplicitCustom(true);
        const startVal = minSeasons ? lowNum : 4;
        setCustomSubMode('EXACT');
        onChange(String(startVal), String(startVal));
        return;
      }

      setExplicitCustom(false);
      onChange(preset.min, preset.max);
    },
    [minSeasons, lowNum, onChange],
  );

  const handleSelectSubMode = useCallback(
    (subModeId) => {
      Haptics.selectionAsync();
      setCustomSubMode(subModeId);

      const curLow = minSeasons ? lowNum : 3;
      const curHigh = maxSeasons ? highNum : Math.min(SEASONS_MAX, Math.max(curLow + 2, 6));

      switch (subModeId) {
        case 'EXACT':
          onChange(String(curLow), String(curLow));
          break;
        case 'OVER':
          onChange(String(curLow), '');
          setActiveBound('low');
          break;
        case 'UNDER':
          onChange('', String(maxSeasons ? highNum : curLow));
          setActiveBound('high');
          break;
        case 'BETWEEN': {
          const lo = Math.min(curLow, curHigh);
          const hi = Math.max(curLow, curHigh);
          onChange(String(lo), String(hi));
          setActiveBound('low');
          break;
        }
      }
    },
    [minSeasons, maxSeasons, lowNum, highNum, onChange],
  );

  const handleRulerChange = useCallback(
    (val) => {
      const rounded = Math.max(SEASONS_MIN, Math.min(SEASONS_MAX, Math.round(val)));
      switch (customSubMode) {
        case 'EXACT':
          onChange(String(rounded), String(rounded));
          break;
        case 'OVER':
          onChange(String(rounded), '');
          break;
        case 'UNDER':
          onChange('', String(rounded));
          break;
        case 'BETWEEN':
          if (activeBound === 'low') {
            const nextLow = Math.min(rounded, highNum);
            onChange(String(nextLow), String(highNum));
          } else {
            const nextHigh = Math.max(rounded, lowNum);
            onChange(String(lowNum), String(nextHigh));
          }
          break;
      }
    },
    [customSubMode, activeBound, highNum, lowNum, onChange],
  );

  const isBetween = isCustom && customSubMode === 'BETWEEN';

  const rulerValue = useMemo(() => {
    if (customSubMode === 'UNDER') return maxSeasons ? highNum : 3;
    if (customSubMode === 'BETWEEN') return activeBound === 'low' ? lowNum : highNum;
    return minSeasons ? lowNum : 4;
  }, [customSubMode, activeBound, minSeasons, maxSeasons, lowNum, highNum]);

  const onSurfaceVar = colors?.onSurfaceVariant || '#8a8a8e';

  return (
    <View style={styles.root}>
      {/* Preset Row: Pure text buttons, no borders, no backgrounds */}
      <View style={styles.modeRow}>
        {SEASONS_PRESETS.map((p) => {
          const selected = currentMode === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => handleSelectPreset(p)}
              activeOpacity={0.7}
              style={styles.modeBtn}
              accessibilityRole="button"
              accessibilityLabel={`${p.label} seasons preset`}
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
          {SEASONS_SUB_MODES.map((sm) => {
            const selected = customSubMode === sm.id;
            return (
              <TouchableOpacity
                key={sm.id}
                onPress={() => handleSelectSubMode(sm.id)}
                activeOpacity={0.7}
                style={styles.subModeBtn}
                accessibilityRole="button"
                accessibilityLabel={`${sm.label} custom seasons mode`}
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
            accessibilityLabel={`Set minimum seasons, currently ${lowNum}`}
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
              MIN {formatSeasonsCountLabel(lowNum) || `${lowNum} seasons`}
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
            accessibilityLabel={`Set maximum seasons, currently ${highNum}`}
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
              MAX {formatSeasonsCountLabel(highNum) || `${highNum} seasons`}
            </Text>
            {activeBound === 'high' && <View style={styles.activeDot} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Custom 1-season Ruler Dial */}
      {isCustom && (
        <RulerScrubber
          min={SEASONS_MIN}
          max={SEASONS_MAX}
          step={SEASONS_STEP}
          value={rulerValue}
          onChange={handleRulerChange}
          tickSpacing={22}
          isMajorTick={(v) => v === 1 || v % 5 === 0}
          isMediumTick={(v) => v % 2 === 0}
          formatTick={(v) => `${v}`}
          formatValue={(val) => {
            const count = Math.round(val);
            const noun = count === 1 ? 'season' : 'seasons';
            if (customSubMode === 'OVER') return `${count}+ seasons`;
            if (customSubMode === 'UNDER') return count === 1 ? '1 season' : `Up to ${count} seasons`;
            if (customSubMode === 'EXACT') return `${count} ${noun}`;
            if (customSubMode === 'BETWEEN') {
              return activeBound === 'low' ? `From ${count} ${noun}` : `Up to ${count} ${noun}`;
            }
            return `${count} ${noun}`;
          }}
          colors={colors}
          typography={typography}
          accessibilityLabel="Number of Seasons"
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
    flexWrap: 'wrap',
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
    justifyContent: 'flex-start',
    gap: scale(14),
    marginTop: scale(4),
    paddingVertical: scale(2),
  },
  subModeBtn: {
    paddingVertical: scale(3),
    paddingHorizontal: scale(2),
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subModeText: {
    fontSize: scale(10),
    letterSpacing: 0.95,
    textTransform: 'uppercase',
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
