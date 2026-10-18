import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  YEAR_MIN,
  yearMax,
  YEAR_MODES,
  getYearMode,
  yearLowFromFilters,
  yearHighFromFilters,
} from '../lib/discoverRanges';
import { RulerScrubber } from './RulerScrubber';
import { GOLD_ACCENT } from '../theme/programme';
import { scale } from '../utils/responsive';

/**
 * Decoupled operator mode selector & haptic ruler dial for Release Year.
 *
 * Provides:
 * - Mode selection: ANY, AFTER, BEFORE, BETWEEN, EXACT (no button background/borders).
 * - Exact Year searching (e.g. only 1999).
 * - Sub-bound selector for BETWEEN (toggle which bound the ruler adjusts).
 * - 1-year precision haptic scrolling tape with decade labels.
 */
export function YearFilterControl({ fromYear, toYear, onChange, colors, typography }) {
  const detectedMode = useMemo(() => getYearMode(fromYear, toYear), [fromYear, toYear]);
  const [explicitMode, setExplicitMode] = useState(null);
  const [activeBound, setActiveBound] = useState('low'); // 'low' or 'high' for BETWEEN

  useEffect(() => {
    if (!fromYear && !toYear) {
      setExplicitMode(null);
    }
  }, [fromYear, toYear]);

  const currentMode = explicitMode || detectedMode;

  const hiLimit = useMemo(() => yearMax(), []);
  const lowNum = useMemo(() => yearLowFromFilters(fromYear), [fromYear]);
  const highNum = useMemo(() => yearHighFromFilters(toYear), [toYear]);

  const handleSelectMode = useCallback(
    (modeId) => {
      Haptics.selectionAsync();
      setExplicitMode(modeId === 'ANY' ? null : modeId);
      const currentYear = new Date().getFullYear();

      switch (modeId) {
        case 'ANY':
          onChange('', '');
          break;
        case 'EXACT': {
          const target = fromYear
            ? parseInt(fromYear, 10)
            : toYear
              ? parseInt(toYear, 10)
              : currentYear;
          onChange(String(target), String(target));
          break;
        }
        case 'AFTER': {
          const target = fromYear ? parseInt(fromYear, 10) : 2010;
          onChange(String(target), '');
          break;
        }
        case 'BEFORE': {
          const target = toYear ? parseInt(toYear, 10) : 2000;
          onChange('', String(target));
          break;
        }
        case 'BETWEEN': {
          const start = fromYear ? parseInt(fromYear, 10) : 1990;
          const end = toYear ? parseInt(toYear, 10) : 2000;
          if (start <= end) {
            onChange(String(start), String(end));
          } else {
            onChange(String(end), String(start));
          }
          break;
        }
      }
    },
    [fromYear, toYear, onChange],
  );

  const handleRulerChange = useCallback(
    (val) => {
      switch (currentMode) {
        case 'EXACT':
          onChange(String(val), String(val));
          break;
        case 'AFTER':
          onChange(String(val), '');
          break;
        case 'BEFORE':
          onChange('', String(val));
          break;
        case 'BETWEEN':
          if (activeBound === 'low') {
            const nextLow = Math.min(val, highNum);
            onChange(String(nextLow), toYear || String(hiLimit));
          } else {
            const nextHigh = Math.max(val, lowNum);
            onChange(fromYear || String(YEAR_MIN), String(nextHigh));
          }
          break;
      }
    },
    [currentMode, activeBound, highNum, lowNum, toYear, fromYear, hiLimit, onChange],
  );

  const rulerValue = useMemo(() => {
    if (currentMode === 'BEFORE') return highNum;
    if (currentMode === 'BETWEEN') return activeBound === 'low' ? lowNum : highNum;
    return lowNum;
  }, [currentMode, activeBound, lowNum, highNum]);

  const isBetween = currentMode === 'BETWEEN';
  const showRuler = currentMode !== 'ANY';

  const onSurfaceVar = colors?.onSurfaceVariant || '#8a8a8e';

  return (
    <View style={styles.root}>
      {/* Operator Mode Bar: Pure text buttons, no borders, no backgrounds */}
      <View style={styles.modeRow}>
        {YEAR_MODES.map((m) => {
          const selected = currentMode === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => handleSelectMode(m.id)}
              activeOpacity={0.7}
              style={styles.modeBtn}
              accessibilityRole="button"
              accessibilityLabel={`${m.label} year mode`}
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
            accessibilityLabel={`Set start year, currently ${lowNum}`}
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
              FROM {lowNum}
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
            accessibilityLabel={`Set end year, currently ${highNum}`}
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
              TO {highNum}
            </Text>
            {activeBound === 'high' && <View style={styles.activeDot} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Ruler Dial */}
      {showRuler && (
        <RulerScrubber
          min={YEAR_MIN}
          max={hiLimit}
          step={1}
          value={rulerValue}
          onChange={handleRulerChange}
          tickSpacing={20}
          isMajorTick={(v) => v % 10 === 0 || v === hiLimit}
          isMediumTick={(v) => v % 5 === 0}
          formatTick={(v) => String(v)}
          formatValue={(val) => {
            if (currentMode === 'EXACT') return `${val}`;
            if (currentMode === 'AFTER') return `From ${val}`;
            if (currentMode === 'BEFORE') return `Up to ${val}`;
            if (currentMode === 'BETWEEN') {
              return activeBound === 'low' ? `From ${val}` : `To ${val}`;
            }
            return `${val}`;
          }}
          colors={colors}
          typography={typography}
          accessibilityLabel="Release Year"
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
