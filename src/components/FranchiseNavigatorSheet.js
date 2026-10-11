import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  CURATED_UNIVERSES,
  DECADE_PRESETS,
  SIZE_BUCKETS,
  SIZE_FILTER_KEYS,
  buildJumpToNames,
  findRowIndexForLetter,
  getLetterCounts,
  sortCollectionRows,
  validateCustomDecadeRange,
} from '../lib/collectionFilters';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { moderateScale, scale, verticalScale } from '../utils/responsive';

const ALL_LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

function HubChip({ label, active, onPress, colors, typography, radii }) {
  return (
    <TouchableOpacity
      style={[
        styles.hubChip,
        {
          backgroundColor: active ? GOLD_ACCENT : colors.surfaceContainerHigh,
          borderRadius: radii.full,
        },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.hubChipText,
          {
            color: active ? '#0c0c0e' : colors.onSurface,
            ...typography.labelSm,
            fontWeight: active ? '800' : '600',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LetterTile({ letter, count, active, onPress, colors, typography, radii }) {
  const disabled = count === 0;
  return (
    <TouchableOpacity
      style={[
        styles.letterTile,
        {
          backgroundColor: active
            ? GOLD_ACCENT
            : disabled
            ? 'rgba(255,255,255,0.03)'
            : colors.surfaceContainerHigh,
          borderRadius: radii.md,
          opacity: disabled ? 0.35 : 1,
        },
      ]}
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync();
        onPress(letter);
      }}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Letter ${letter}, ${count} collections`}
    >
      <Text
        style={[
          styles.letterTileChar,
          {
            color: active ? '#0c0c0e' : disabled ? colors.onSurfaceVariant : GOLD_ACCENT,
            ...typography.titleMd,
          },
        ]}
      >
        {letter}
      </Text>
      <Text
        style={[
          styles.letterTileCount,
          {
            color: active ? '#0c0c0e' : colors.onSurfaceVariant,
            ...typography.labelSm,
            fontWeight: active ? '800' : '600',
          },
        ]}
      >
        {count}
      </Text>
    </TouchableOpacity>
  );
}

export function FranchiseNavigatorSheet({
  visible,
  onClose,
  colors,
  typography,
  radii,
  allRows = [],
  filteredRows = [],
  searchQuery,
  onSearchQueryChange,
  letterFilter,
  onSelectLetter,
  sortMode,
  onSortModeChange,
  sizeFilters,
  onToggleSizeFilter,
  decadeFilters,
  onToggleDecadeFilter,
  customDecadeRange,
  onCustomDecadeRangeChange,
  onResetFilters,
  onJumpToLetter,
  onJumpToRowId,
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef(null);
  const scrollContentRef = useRef(null);
  const customDecadeRef = useRef(null);
  const minInputRef = useRef(null);
  const maxInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('universes'); // 'universes' | 'alphabet' | 'filters'
  const [showCustomDecade, setShowCustomDecade] = useState(
    customDecadeRange?.min != null || customDecadeRange?.max != null,
  );

  const sheetMaxHeight = Math.round(windowHeight * 0.9);
  const scrollMaxHeight = sheetMaxHeight - verticalScale(120) - insets.bottom;

  const letterCounts = useMemo(() => getLetterCounts(filteredRows.length > 0 ? filteredRows : allRows), [filteredRows, allRows]);

  const customDecadeError = useMemo(
    () => (showCustomDecade ? validateCustomDecadeRange(customDecadeRange) : null),
    [showCustomDecade, customDecadeRange],
  );

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleReset = useCallback(() => {
    setShowCustomDecade(false);
    onResetFilters?.();
  }, [onResetFilters]);

  const handleSelectUniverse = useCallback((universe) => {
    onSearchQueryChange?.(universe.query);
    handleClose();
  }, [onSearchQueryChange, handleClose]);

  const handleLetterPress = useCallback((letter) => {
    onSelectLetter?.(letter);
    handleClose();
  }, [onSelectLetter, handleClose]);

  const updateCustomField = useCallback(
    (field, value) => {
      const digits = value.replace(/[^\d]/g, '');
      const parsed = digits.length ? Number.parseInt(digits, 10) : null;
      let next = {
        ...customDecadeRange,
        [field]: Number.isFinite(parsed) ? parsed : null,
      };

      if (next.min != null && next.max != null && next.min > next.max) {
        next = { min: next.max, max: next.min };
      }

      onCustomDecadeRangeChange?.(next);
    },
    [customDecadeRange, onCustomDecadeRangeChange],
  );

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.keyboardWrap}>
          <View
            style={[
              styles.sheet,
              {
                maxHeight: sheetMaxHeight,
                backgroundColor: colors.surface,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Sheet Marquee Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                  Franchise Explorer
                </Text>
                <Text
                  style={[{ color: colors.onSurface, ...typography.titleMd, fontWeight: '800' }]}
                >
                  Quick Index & Hubs
                </Text>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  onPress={handleReset}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.resetButton}
                  accessibilityRole="button"
                  accessibilityLabel="Reset all filters"
                >
                  <Text style={[{ color: colors.onSurfaceVariant, ...typography.labelSm, fontWeight: '700' }]}>
                    Reset
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.doneButton, { backgroundColor: GOLD_ACCENT, borderRadius: radii.full }]}
                  accessibilityRole="button"
                  accessibilityLabel="Close explorer"
                >
                  <Text style={[{ color: '#0c0c0e', ...typography.labelSm, fontWeight: '800' }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Navigation Segment Tabs */}
            <View
              style={[
                styles.segmentBar,
                { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.full },
              ]}
            >
              {[
                { key: 'universes', label: 'Universes' },
                { key: 'alphabet', label: 'A – Z Keypad' },
                { key: 'filters', label: 'Era & Size' },
              ].map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.segmentTab,
                      active && { backgroundColor: GOLD_ACCENT },
                      { borderRadius: radii.full },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveTab(tab.key);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.segmentLabel,
                        {
                          color: active ? '#0c0c0e' : colors.onSurfaceVariant,
                          ...typography.labelSm,
                          fontWeight: active ? '800' : '600',
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Scrollable Body Content */}
            <ScrollView
              ref={scrollRef}
              style={[styles.sheetScroll, { maxHeight: scrollMaxHeight }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetBody}
            >
              {/* TAB 1: CURATED UNIVERSES */}
              {activeTab === 'universes' && (
                <View style={styles.tabContent}>
                  <Text style={[styles.sectionTitle, { color: colors.onSurface, ...typography.labelSm }]}>
                    Iconic Franchises & Universes
                  </Text>
                  <View style={styles.hubGrid}>
                    {CURATED_UNIVERSES.map((universe) => {
                      const active = searchQuery.trim().toLowerCase() === universe.query.toLowerCase();
                      return (
                        <HubChip
                          key={universe.id}
                          label={universe.label}
                          active={active}
                          onPress={() => handleSelectUniverse(universe)}
                          colors={colors}
                          typography={typography}
                          radii={radii}
                        />
                      );
                    })}
                  </View>

                  <View style={styles.sortSection}>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface, ...typography.labelSm }]}>
                      Catalogue Sort Mode
                    </Text>
                    <View style={styles.sortGrid}>
                      {[
                        { key: 'popular', label: 'Most Popular' },
                        { key: 'rating', label: 'Highest Rated' },
                        { key: 'az', label: 'Alphabetical A–Z' },
                        { key: 'count', label: 'Franchise Size' },
                      ].map((mode) => {
                        const active = sortMode === mode.key;
                        return (
                          <TouchableOpacity
                            key={mode.key}
                            style={[
                              styles.sortCard,
                              {
                                backgroundColor: active ? GOLD_ACCENT + '20' : colors.surfaceContainerHigh,
                                borderRadius: radii.md,
                              },
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onSortModeChange?.(mode.key);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <Text
                              style={[
                                styles.sortCardText,
                                {
                                  color: active ? GOLD_ACCENT : colors.onSurface,
                                  ...typography.labelSm,
                                  fontWeight: active ? '800' : '600',
                                },
                              ]}
                            >
                              {mode.label}
                            </Text>
                            {active && <Ionicons name="checkmark-circle" size={16} color={GOLD_ACCENT} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 2: ALPHABET KEYPAD JUMP */}
              {activeTab === 'alphabet' && (
                <View style={styles.tabContent}>
                  <View style={styles.alphabetHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface, ...typography.labelSm, marginBottom: 0 }]}>
                      Tap a letter to filter instantly
                    </Text>
                    {letterFilter && (
                      <TouchableOpacity
                        onPress={() => handleLetterPress(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Show all letters"
                      >
                        <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm, fontWeight: '800' }]}>
                          Show All
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.letterGrid}>
                    {ALL_LETTERS.map((letter) => (
                      <LetterTile
                        key={letter}
                        letter={letter}
                        count={letterCounts[letter] || 0}
                        active={letterFilter === letter}
                        onPress={handleLetterPress}
                        colors={colors}
                        typography={typography}
                        radii={radii}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* TAB 3: DECADE & SIZE FILTERS */}
              {activeTab === 'filters' && (
                <View style={styles.tabContent}>
                  {/* Franchise Size */}
                  <View style={styles.filterGroup}>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface, ...typography.labelSm }]}>
                      Franchise Size
                    </Text>
                    <View style={styles.chipRow}>
                      {SIZE_FILTER_KEYS.map((sizeKey) => {
                        const active = sizeFilters.includes(sizeKey);
                        const bucket = SIZE_BUCKETS[sizeKey];
                        return (
                          <TouchableOpacity
                            key={sizeKey}
                            style={[
                              styles.filterPill,
                              {
                                backgroundColor: active ? GOLD_ACCENT : colors.surfaceContainerHigh,
                                borderRadius: radii.full,
                              },
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onToggleSizeFilter?.(sizeKey);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <Text
                              style={[
                                styles.filterPillText,
                                {
                                  color: active ? '#0c0c0e' : colors.onSurface,
                                  ...typography.labelSm,
                                  fontWeight: active ? '800' : '600',
                                },
                              ]}
                            >
                              {bucket.label} ({bucket.min === bucket.max ? bucket.min : `${bucket.min}${bucket.max === Infinity ? '+' : `–${bucket.max}`}`} Films)
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Decade Presets */}
                  <View style={styles.filterGroup}>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface, ...typography.labelSm }]}>
                      Era & Decade
                    </Text>
                    <View style={styles.chipRow}>
                      {DECADE_PRESETS.map((preset) => {
                        const active = decadeFilters.includes(preset.key);
                        return (
                          <TouchableOpacity
                            key={preset.key}
                            style={[
                              styles.filterPill,
                              {
                                backgroundColor: active ? GOLD_ACCENT : colors.surfaceContainerHigh,
                                borderRadius: radii.full,
                              },
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onToggleDecadeFilter?.(preset.key);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <Text
                              style={[
                                styles.filterPillText,
                                {
                                  color: active ? '#0c0c0e' : colors.onSurface,
                                  ...typography.labelSm,
                                  fontWeight: active ? '800' : '600',
                                },
                              ]}
                            >
                              {preset.key}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        style={[
                          styles.filterPill,
                          {
                            backgroundColor: showCustomDecade ? GOLD_ACCENT : colors.surfaceContainerHigh,
                            borderRadius: radii.full,
                          },
                        ]}
                        onPress={() => setShowCustomDecade((prev) => !prev)}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.filterPillText,
                            {
                              color: showCustomDecade ? '#0c0c0e' : colors.onSurface,
                              ...typography.labelSm,
                              fontWeight: showCustomDecade ? '800' : '600',
                            },
                          ]}
                        >
                          Custom Range…
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showCustomDecade && (
                      <View ref={customDecadeRef} style={styles.customRangeWrap}>
                        <View style={styles.customRangeRow}>
                          <TextInput
                            ref={minInputRef}
                            style={[
                              styles.yearInput,
                              {
                                color: colors.onSurface,
                                borderRadius: radii.md,
                                backgroundColor: colors.surfaceContainerHigh,
                              },
                            ]}
                            placeholder="From Year (e.g. 1970)"
                            placeholderTextColor={colors.onSurfaceVariant}
                            keyboardType="number-pad"
                            maxLength={4}
                            value={customDecadeRange?.min != null ? String(customDecadeRange.min) : ''}
                            onChangeText={(value) => updateCustomField('min', value)}
                            accessibilityLabel="Custom decade from year"
                          />
                          <Text style={{ color: colors.onSurfaceVariant, ...typography.bodyMd }}>–</Text>
                          <TextInput
                            ref={maxInputRef}
                            style={[
                              styles.yearInput,
                              {
                                color: colors.onSurface,
                                borderRadius: radii.md,
                                backgroundColor: colors.surfaceContainerHigh,
                              },
                            ]}
                            placeholder="To Year (e.g. 2024)"
                            placeholderTextColor={colors.onSurfaceVariant}
                            keyboardType="number-pad"
                            maxLength={4}
                            value={customDecadeRange?.max != null ? String(customDecadeRange.max) : ''}
                            onChangeText={(value) => updateCustomField('max', value)}
                            accessibilityLabel="Custom decade to year"
                          />
                        </View>
                        {customDecadeError && (
                          <View
                            style={[
                              styles.validationBanner,
                              { backgroundColor: colors.error + '18', borderRadius: radii.md },
                            ]}
                          >
                            <Ionicons name="warning-outline" size={16} color={colors.error} />
                            <Text style={[{ color: colors.error, ...typography.bodyMd, flex: 1 }]}>
                              {customDecadeError}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    paddingTop: 16,
    paddingHorizontal: scale(20),
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(14),
  },
  sheetEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  segmentBar: {
    flexDirection: 'row',
    padding: 3,
    marginBottom: scale(14),
    gap: 2,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 5,
  },
  segmentLabel: {
    fontSize: scale(11),
  },
  sheetBody: {
    paddingBottom: scale(24),
  },
  tabContent: {
    gap: scale(16),
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: scale(6),
  },
  alphabetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(8),
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  hubChipText: {
    fontSize: scale(12),
  },
  sortSection: {
    marginTop: scale(10),
    gap: scale(8),
  },
  sortGrid: {
    gap: 8,
  },
  sortCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sortCardText: {
    fontSize: scale(12.5),
  },
  letterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    justifyContent: 'space-between',
  },
  letterTile: {
    width: '18%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  letterTileChar: {
    fontWeight: '900',
    fontSize: scale(16),
    lineHeight: scale(20),
  },
  letterTileCount: {
    fontSize: scale(9.5),
    fontWeight: '700',
    marginTop: 2,
  },
  filterGroup: {
    gap: scale(8),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterPillText: {
    fontSize: scale(11.5),
  },
  customRangeWrap: {
    marginTop: scale(8),
    gap: 8,
  },
  customRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yearInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: scale(12),
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
});
