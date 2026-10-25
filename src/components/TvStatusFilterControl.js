import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { TV_STATUS_PRESETS, getTvStatusMode } from '../lib/discoverRanges';
import { GOLD_ACCENT } from '../theme/programme';
import { scale } from '../utils/responsive';

/**
 * TV Show Status filter control.
 *
 * Provides instant one-tap presets: Any, Returning, Ended (pure text buttons,
 * no button backgrounds or borders, matching Trova Discover aesthetic).
 */
export function TvStatusFilterControl({ tvStatus, onChange, colors, typography }) {
  const currentMode = getTvStatusMode(tvStatus);
  const onSurfaceVar = colors?.onSurfaceVariant || '#8a8a8e';

  return (
    <View style={styles.root}>
      <View style={styles.modeRow}>
        {TV_STATUS_PRESETS.map((p) => {
          const selected = currentMode === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(p.value);
              }}
              activeOpacity={0.7}
              style={styles.modeBtn}
              accessibilityRole="button"
              accessibilityLabel={`${p.label} TV status preset`}
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
});
