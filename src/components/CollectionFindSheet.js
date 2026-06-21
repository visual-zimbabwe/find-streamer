import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
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
import {
  DECADE_PRESETS,
  SIZE_BUCKETS,
  SIZE_FILTER_KEYS,
  buildJumpToNames,
  validateCustomDecadeRange,
} from '../lib/collectionFilters';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { scale } from '../utils/responsive';

const SHEET_HEADER_HEIGHT = 52;

function FilterChip({ label, active, onPress, colors, typography, radii }) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: active ? GOLD_ACCENT + '18' : colors.surfaceContainerHigh,
          borderColor: active ? GOLD_ACCENT : GOLD_DIM,
          borderRadius: radii.full,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          {
            color: active ? GOLD_ACCENT : colors.onSurface,
            ...typography.labelSm,
            fontWeight: '700',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function CollectionFindSheet({
  visible,
  onClose,
  colors,
  typography,
  radii,
  searchQuery,
  onSearchQueryChange,
  sizeFilters,
  onToggleSizeFilter,
  decadeFilters,
  onToggleDecadeFilter,
  customDecadeRange,
  onCustomDecadeRangeChange,
  onResetFilters,
  filteredRows,
  onJumpTo,
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef(null);
  const scrollContentRef = useRef(null);
  const customDecadeRef = useRef(null);
  const minInputRef = useRef(null);
  const maxInputRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [yearFieldFocused, setYearFieldFocused] = useState(false);
  const [showCustomDecade, setShowCustomDecade] = useState(
    customDecadeRange?.min != null || customDecadeRange?.max != null,
  );

  const sheetMaxHeight = Math.round(windowHeight * 0.88);
  const scrollMaxHeight = sheetMaxHeight - SHEET_HEADER_HEIGHT - insets.bottom - 32;

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      setYearFieldFocused(false);
      return undefined;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setYearFieldFocused(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [visible]);

  const jumpToNames = useMemo(() => buildJumpToNames(filteredRows), [filteredRows]);

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

  const handleJump = useCallback(
    (rowId) => {
      onJumpTo?.(rowId);
      handleClose();
    },
    [handleClose, onJumpTo],
  );

  const scrollToCustomDecade = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      if (!customDecadeRef.current || !scrollContentRef.current) return;
      customDecadeRef.current.measureLayout(
        scrollContentRef.current,
        (_x, y) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - 24),
            animated: true,
          });
        },
        () => {},
      );
    }, 120);
  }, []);

  const handleYearFocus = useCallback(() => {
    setYearFieldFocused(true);
    scrollToCustomDecade();
  }, [scrollToCustomDecade]);

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
        requestAnimationFrame(() => {
          if (field === 'min') {
            maxInputRef.current?.focus();
          } else {
            minInputRef.current?.focus();
          }
        });
      }

      onCustomDecadeRangeChange?.(next);
    },
    [customDecadeRange, onCustomDecadeRangeChange],
  );

  const renderJumpItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={[styles.jumpRow, { borderBottomColor: GOLD_DIM }]}
        onPress={() => handleJump(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Jump to ${item.title}`}
      >
        <Text style={[{ color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={GOLD_ACCENT} />
      </TouchableOpacity>
    ),
    [colors, typography, handleJump],
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
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                  Find
                </Text>
                <Text
                  style={[{ color: colors.onSurface, ...typography.titleMd, fontWeight: '800' }]}
                >
                  Collection
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close find collection"
              >
                <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm, fontWeight: '800' }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              style={[styles.sheetScroll, { maxHeight: scrollMaxHeight }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.sheetBody,
                yearFieldFocused && keyboardHeight > 0
                  ? { paddingBottom: keyboardHeight + 16 }
                  : null,
              ]}
            >
              <View ref={scrollContentRef} collapsable={false}>
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: GOLD_DIM,
                      borderRadius: radii.md,
                    },
                  ]}
                >
                  <Ionicons
                    name="search-outline"
                    size={16}
                    color={GOLD_ACCENT}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={[{ flex: 1, color: colors.onSurface, ...typography.bodyMd }]}
                    placeholder="Search franchises…"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={searchQuery}
                    onChangeText={onSearchQueryChange}
                    autoCorrect={false}
                    accessibilityLabel="Search franchise collections"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => onSearchQueryChange('')}
                      accessibilityRole="button"
                      accessibilityLabel="Clear franchise search"
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color={colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.filterSection}>
                  <View style={styles.filterHeaderRow}>
                    <Text
                      style={[
                        styles.filterEyebrow,
                        { color: colors.onSurface, ...typography.labelSm },
                      ]}
                    >
                      Size
                    </Text>
                    <TouchableOpacity
                      onPress={handleReset}
                      accessibilityRole="button"
                      accessibilityLabel="Reset filters"
                    >
                      <Text
                        style={[{ color: GOLD_ACCENT, ...typography.labelSm, fontWeight: '700' }]}
                      >
                        Reset
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.chipRow}>
                    {SIZE_FILTER_KEYS.map((sizeKey) => (
                      <FilterChip
                        key={sizeKey}
                        label={SIZE_BUCKETS[sizeKey].label}
                        active={sizeFilters.includes(sizeKey)}
                        onPress={() => onToggleSizeFilter(sizeKey)}
                        colors={colors}
                        typography={typography}
                        radii={radii}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text
                    style={[
                      styles.filterEyebrow,
                      { color: colors.onSurface, ...typography.labelSm },
                    ]}
                  >
                    Decade
                  </Text>
                  <View style={styles.chipRow}>
                    {DECADE_PRESETS.map((preset) => (
                      <FilterChip
                        key={preset.key}
                        label={preset.key}
                        active={decadeFilters.includes(preset.key)}
                        onPress={() => onToggleDecadeFilter(preset.key)}
                        colors={colors}
                        typography={typography}
                        radii={radii}
                      />
                    ))}
                    <FilterChip
                      label="Custom…"
                      active={showCustomDecade}
                      onPress={() => setShowCustomDecade((prev) => !prev)}
                      colors={colors}
                      typography={typography}
                      radii={radii}
                    />
                  </View>
                  {showCustomDecade && (
                    <View ref={customDecadeRef} collapsable={false}>
                      <View style={styles.customRangeRow}>
                        <TextInput
                          ref={minInputRef}
                          style={[
                            styles.yearInput,
                            {
                              color: colors.onSurface,
                              borderColor: GOLD_DIM,
                              borderRadius: radii.md,
                            },
                          ]}
                          placeholder="From"
                          placeholderTextColor={colors.onSurfaceVariant}
                          keyboardType="number-pad"
                          maxLength={4}
                          value={
                            customDecadeRange?.min != null ? String(customDecadeRange.min) : ''
                          }
                          onFocus={handleYearFocus}
                          onChangeText={(value) => updateCustomField('min', value)}
                          accessibilityLabel="Custom decade from year"
                        />
                        <Text style={{ color: colors.onSurfaceVariant, ...typography.bodyMd }}>
                          –
                        </Text>
                        <TextInput
                          ref={maxInputRef}
                          style={[
                            styles.yearInput,
                            {
                              color: colors.onSurface,
                              borderColor: GOLD_DIM,
                              borderRadius: radii.md,
                            },
                          ]}
                          placeholder="To"
                          placeholderTextColor={colors.onSurfaceVariant}
                          keyboardType="number-pad"
                          maxLength={4}
                          value={
                            customDecadeRange?.max != null ? String(customDecadeRange.max) : ''
                          }
                          onFocus={handleYearFocus}
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

                <View style={styles.filterSection}>
                  <Text
                    style={[
                      styles.filterEyebrow,
                      { color: colors.onSurface, ...typography.labelSm },
                    ]}
                  >
                    Jump to
                  </Text>
                  <FlatList
                    data={jumpToNames}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderJumpItem}
                    scrollEnabled={false}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={12}
                    maxToRenderPerBatch={16}
                    windowSize={5}
                    ListEmptyComponent={
                      <Text
                        style={[
                          {
                            color: colors.onSurfaceVariant,
                            ...typography.bodyMd,
                            textAlign: 'center',
                            marginTop: 12,
                          },
                        ]}
                      >
                        No collections match your filters.
                      </Text>
                    }
                  />
                </View>
              </View>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    paddingTop: 16,
    paddingHorizontal: scale(22),
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: SHEET_HEADER_HEIGHT,
  },
  sheetEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sheetBody: {
    paddingBottom: 8,
    gap: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: {
    marginRight: 8,
  },
  filterSection: {
    gap: 10,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterEyebrow: {
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yearInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 8,
  },
  jumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
