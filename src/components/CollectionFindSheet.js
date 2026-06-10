import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DECADE_PRESETS,
  SIZE_BUCKETS,
  SIZE_FILTER_KEYS,
  buildJumpToNames,
} from '../lib/collectionFilters';

function FilterChip({ label, active, onPress, colors, typography, radii }) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary + '22' : colors.surfaceContainerHigh,
          borderColor: active ? colors.primary : colors.outlineVariant,
          borderRadius: radii.full,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[{ color: active ? colors.primary : colors.onSurface, ...typography.labelSm, fontWeight: '700' }]}>
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
  const [showCustomDecade, setShowCustomDecade] = useState(
    customDecadeRange?.min != null || customDecadeRange?.max != null,
  );

  const jumpToNames = useMemo(() => buildJumpToNames(filteredRows), [filteredRows]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleReset = useCallback(() => {
    setShowCustomDecade(false);
    onResetFilters?.();
  }, [onResetFilters]);

  const handleJump = useCallback((rowId) => {
    onJumpTo?.(rowId);
    handleClose();
  }, [handleClose, onJumpTo]);

  const updateCustomField = useCallback((field, value) => {
    const digits = value.replace(/[^\d]/g, '');
    const parsed = digits.length ? Number.parseInt(digits, 10) : null;
    onCustomDecadeRangeChange?.({
      ...customDecadeRange,
      [field]: Number.isFinite(parsed) ? parsed : null,
    });
  }, [customDecadeRange, onCustomDecadeRangeChange]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
        >
          <View style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[{ color: colors.onSurface, ...typography.titleMd, fontWeight: '800' }]}>
                Find collection
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close find collection"
              >
                <Text style={[{ color: colors.primary, ...typography.labelSm, fontWeight: '800' }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetBody}
            >
              <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.md }]}>
                <Ionicons name="search-outline" size={16} color={colors.onSurfaceVariant} style={styles.searchIcon} />
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
                    <Ionicons name="close-circle-outline" size={16} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterSection}>
                <View style={styles.filterHeaderRow}>
                  <Text style={[{ color: colors.onSurface, ...typography.labelSm, fontWeight: '800' }]}>Size</Text>
                  <TouchableOpacity onPress={handleReset} accessibilityRole="button" accessibilityLabel="Reset filters">
                    <Text style={[{ color: colors.primary, ...typography.labelSm, fontWeight: '700' }]}>Reset</Text>
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
                <Text style={[{ color: colors.onSurface, ...typography.labelSm, fontWeight: '800' }]}>Decade</Text>
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
                  <View style={styles.customRangeRow}>
                    <TextInput
                      style={[styles.yearInput, { color: colors.onSurface, borderColor: colors.outlineVariant, borderRadius: radii.md }]}
                      placeholder="From"
                      placeholderTextColor={colors.onSurfaceVariant}
                      keyboardType="number-pad"
                      value={customDecadeRange?.min != null ? String(customDecadeRange.min) : ''}
                      onChangeText={(value) => updateCustomField('min', value)}
                      accessibilityLabel="Custom decade from year"
                    />
                    <Text style={{ color: colors.onSurfaceVariant, ...typography.bodyMd }}>–</Text>
                    <TextInput
                      style={[styles.yearInput, { color: colors.onSurface, borderColor: colors.outlineVariant, borderRadius: radii.md }]}
                      placeholder="To"
                      placeholderTextColor={colors.onSurfaceVariant}
                      keyboardType="number-pad"
                      value={customDecadeRange?.max != null ? String(customDecadeRange.max) : ''}
                      onChangeText={(value) => updateCustomField('max', value)}
                      accessibilityLabel="Custom decade to year"
                    />
                  </View>
                )}
              </View>

              <View style={styles.filterSection}>
                <Text style={[{ color: colors.onSurface, ...typography.labelSm, fontWeight: '800' }]}>Jump to</Text>
                <FlatList
                  data={jumpToNames}
                  keyExtractor={(item) => String(item.id)}
                  style={styles.jumpList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.jumpRow, { borderBottomColor: colors.outlineVariant }]}
                      onPress={() => handleJump(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Jump to ${item.title}`}
                    >
                      <Text style={[{ color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.onSurfaceVariant} />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={(
                    <Text style={[{ color: colors.onSurfaceVariant, ...typography.bodyMd, textAlign: 'center', marginTop: 12 }]}>
                      No collections match your filters.
                    </Text>
                  )}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    maxHeight: '88%',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
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
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  jumpList: {
    maxHeight: 220,
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
