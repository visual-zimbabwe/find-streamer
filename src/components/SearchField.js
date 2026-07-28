import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Animated, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { scale } from '../utils/responsive';

/**
 * The query field, split out of `SearchPanel` so it can be docked above the
 * scroll view instead of scrolling away with the suggestions and the rails.
 * Refining a search is the commonest thing anyone does after searching, and it
 * used to cost a scroll back past the whole results grid.
 */
export const SearchField = forwardRef(function SearchField(
  { value, onChangeText, onSubmit, onClear, busy, busyLabel },
  ref,
) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const inputRef = useRef(null);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const input = inputRef.current;
        if (!input) return;
        // Dismissing the keyboard — with Back, or by dragging the list — leaves
        // the field focused on Android, and focusing an already-focused input
        // is a no-op, so every later focus request was silently doing nothing.
        // Bouncing focus is what actually asks for the keyboard back.
        if (input.isFocused?.()) {
          input.blur();
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
        input.focus();
      },
    }),
    [],
  );

  const hasSearchText = (value || '').length > 0;

  return (
    <View
      style={[
        styles.searchTheatre,
        {
          backgroundColor: colors.glass,
          borderColor: GOLD_DIM,
          borderRadius: radii.lg,
        },
      ]}
    >
      <View style={styles.searchRow}>
        {/*
          Fixed-width slots on both edges. The trailing slot used to render the
          ✕, the progress dot or a spacer depending on two booleans, so it swung
          between 30, 40 and 70px — and with the text centred, every one of
          those swings dragged the user's own query sideways mid-keystroke.
        */}
        <View style={styles.leadSlot}>
          <Ionicons name="search-outline" size={20} color={GOLD_ACCENT} />
        </View>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.onSurface, ...typography.bodyLg }]}
          placeholder="Search for a movie, show"
          placeholderTextColor={colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          // The field is full of proper nouns, so autocorrect is a liability
          // rather than a help, and the action key should say what it does.
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
          autoComplete="off"
          accessibilityLabel="Search for a movie or show"
          accessibilityState={{ busy: Boolean(busy) }}
        />
        <View style={styles.trailSlot}>
          {hasSearchText ? (
            <TouchableOpacity
              style={styles.clearButton}
              // Clears the committed results too, not just the text. Clearing
              // only the field left the previous search's "Top Matches" sitting
              // under an empty search box. Rendered whenever there is text —
              // it used to be suppressed while a keystroke was in flight, which
              // is to say for most of the time anyone is actually typing.
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle-outline" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Progress lives on its own edge now rather than in a control's seat. */}
      <BusyRule busy={busy} label={busyLabel} />
    </View>
  );
});

function BusyRule({ busy, label }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!busy) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, pulse]);

  if (!busy) return null;

  return (
    <Animated.View
      style={[
        styles.busyRule,
        {
          backgroundColor: GOLD_ACCENT,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
        },
      ]}
      accessibilityLabel={label || 'Searching'}
    />
  );
}

const styles = StyleSheet.create({
  searchTheatre: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 0 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
    }),
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: scale(56),
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
  },
  leadSlot: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    marginRight: scale(8),
    width: 24,
  },
  input: {
    flex: 1,
    fontWeight: '600',
    minHeight: scale(44),
    paddingVertical: 0,
  },
  trailSlot: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  clearButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  busyRule: {
    // Inset from the corners and lifted off the border so it reads as progress
    // rather than as the box's own gold hairline.
    borderRadius: 2,
    bottom: scale(4),
    height: 3,
    left: scale(14),
    position: 'absolute',
    right: scale(14),
  },
});
