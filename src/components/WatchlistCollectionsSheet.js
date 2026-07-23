import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { WATCHLIST_STATUSES } from '../lib/watchlistModel';

// Show the filter field only once the list is long enough to warrant hunting.
const SEARCH_THRESHOLD = 6;

/**
 * The destination picker behind the bookmark. Every save flows through here —
 * there is no instant save — so it is built for speed: a "Recent" quick-pick
 * row, a search field when lists pile up, lists as the hero with status as a
 * secondary detail, and a pinned primary action. Nothing is committed until the
 * user picks; `committed` reflects whether the row now exists in the library.
 */
export function WatchlistCollectionsSheet({
  item,
  collections,
  committed = false,
  recentCollectionIds = [],
  onCreateCollection,
  onToggleCollection,
  onSetStatus,
  onSave,
  onRemove,
  onClose,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii, spacing } = theme;
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const selectedCollectionIds = new Set(item?.collectionIds || []);

  const showSearch = collections.length > SEARCH_THRESHOLD;

  const filteredCollections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((collection) => collection.name.toLowerCase().includes(q));
  }, [collections, query]);

  // Recent lists the user hasn't already filed this title into — a one-tap path
  // pre-commit so "pick every time" doesn't mean "scroll every time".
  const recentCollections = useMemo(() => {
    if (committed) return [];
    return recentCollectionIds
      .map((id) => collections.find((collection) => collection.id === id))
      .filter((collection) => collection && !selectedCollectionIds.has(collection.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, recentCollectionIds, collections, item?.collectionIds]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateCollection(trimmed);
    setName('');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Text
          style={[
            styles.hint,
            { color: colors.onSurfaceVariant, ...typography.bodyMd },
          ]}
        >
          {committed
            ? 'Manage where this lives. Lists can overlap.'
            : 'Choose where this goes. Pick a list or status to save it.'}
        </Text>

        {/* Recent — fast pre-commit path */}
        {recentCollections.length > 0 && (
          <View style={styles.block}>
            <Text
              style={[styles.groupLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
            >
              Recent
            </Text>
            <View style={styles.recentRow}>
              {recentCollections.map((collection) => (
                <TouchableOpacity
                  key={collection.id}
                  style={[
                    styles.recentChip,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.primary + '55',
                      borderRadius: radii.full,
                    },
                  ]}
                  onPress={() => onToggleCollection(collection.id)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Save to ${collection.name}`}
                >
                  <Ionicons
                    name={collection.icon || 'albums-outline'}
                    size={15}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.recentChipText, { color: colors.onSurface, ...typography.labelSm }]}
                    numberOfLines={1}
                  >
                    {collection.name}
                  </Text>
                  <Ionicons name="add" size={15} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Lists — the hero */}
        <View style={styles.block}>
          <Text
            style={[styles.groupLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
          >
            Add to a list
          </Text>

          {showSearch && (
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant + '35',
                  borderRadius: radii.lg,
                },
              ]}
            >
              <Ionicons name="search" size={16} color={colors.onSurfaceVariant} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search lists"
                placeholderTextColor={colors.onSurfaceVariant}
                style={[styles.searchInput, { color: colors.onSurface, ...typography.bodyMd }]}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.categoryList}>
            {filteredCollections.map((collection) => {
              const isSelected = selectedCollectionIds.has(collection.id);
              const locked = collection.immutable && isSelected;
              return (
                <TouchableOpacity
                  key={collection.id}
                  style={[
                    styles.categoryOption,
                    {
                      backgroundColor: isSelected
                        ? colors.primary + '18'
                        : colors.surfaceContainerHigh,
                      borderColor: isSelected ? colors.primary + '66' : colors.outlineVariant + '33',
                      borderRadius: radii.lg,
                    },
                  ]}
                  activeOpacity={locked ? 1 : 0.82}
                  onPress={() => {
                    if (!locked) onToggleCollection(collection.id);
                  }}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${isSelected ? 'Remove from' : 'Add to'} ${collection.name}`}
                  accessibilityState={{ checked: isSelected, disabled: locked }}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: isSelected ? colors.primary + '33' : colors.primary + '22' },
                    ]}
                  >
                    <Ionicons
                      name={collection.icon || 'albums-outline'}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.categoryCopy}>
                    <View style={styles.categoryLabelRow}>
                      <Text
                        style={[
                          styles.categoryOptionTitle,
                          {
                            color: isSelected ? colors.primary : colors.onSurface,
                            ...typography.bodyLg,
                          },
                        ]}
                      >
                        {collection.name}
                      </Text>
                      {locked && (
                        <View
                          style={[styles.currentBadge, { backgroundColor: colors.primary + '22' }]}
                        >
                          <Text
                            style={[
                              styles.currentBadgeText,
                              { color: colors.primary, ...typography.labelSm },
                            ]}
                          >
                            Default
                          </Text>
                        </View>
                      )}
                    </View>
                    {!!collection.description && (
                      <Text
                        style={[
                          styles.categoryOptionDescription,
                          { color: colors.onSurfaceVariant, ...typography.bodyMd },
                        ]}
                        numberOfLines={2}
                      >
                        {collection.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={isSelected ? colors.primary : colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              );
            })}

            {filteredCollections.length === 0 && (
              <Text
                style={[
                  styles.emptyHint,
                  { color: colors.onSurfaceVariant, ...typography.bodyMd },
                ]}
              >
                No lists match “{query.trim()}”.
              </Text>
            )}
          </View>

          {/* Create a new list */}
          <View
            style={[
              styles.createCollectionBox,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant + '35',
                borderRadius: radii.lg,
              },
            ]}
          >
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="New list name"
              placeholderTextColor={colors.onSurfaceVariant}
              style={[styles.collectionInput, { color: colors.onSurface, ...typography.bodyLg }]}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity
              style={[
                styles.createCollectionButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radii.full,
                  opacity: name.trim() ? 1 : 0.5,
                },
              ]}
              onPress={handleCreate}
              disabled={!name.trim()}
              accessibilityRole="button"
              accessibilityLabel="Create list"
              accessibilityState={{ disabled: !name.trim() }}
            >
              <Ionicons name="add" size={20} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status — secondary detail */}
        <View style={styles.block}>
          <Text
            style={[styles.groupLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
          >
            Status
          </Text>
          <View style={styles.statusRow}>
            {WATCHLIST_STATUSES.filter((status) => status.id !== 'dropped').map((status) => {
              const selected = item?.status === status.id;
              return (
                <TouchableOpacity
                  key={status.id}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: selected ? colors.primary + '22' : colors.surfaceContainerHigh,
                      borderColor: selected ? colors.primary + '66' : colors.outlineVariant + '33',
                      borderRadius: radii.full,
                    },
                  ]}
                  onPress={() => onSetStatus(status.id)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Set status to ${status.label}`}
                  accessibilityState={{ selected }}
                >
                  <Ionicons
                    name={status.icon}
                    size={14}
                    color={selected ? colors.primary : colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: selected ? colors.primary : colors.onSurface, ...typography.labelSm },
                    ]}
                  >
                    {status.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Remove — de-emphasized and kept well clear of the primary action */}
        {committed && (
          <View style={styles.removeWrap}>
            <View style={[styles.removeDivider, { backgroundColor: colors.outlineVariant + '30' }]} />
            <TouchableOpacity
              style={styles.removeLink}
              activeOpacity={0.7}
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel="Remove from library"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.removeLinkText, { color: colors.error, ...typography.labelSm }]}>
                Remove from library
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Pinned primary action */}
      <View style={[styles.footer, { borderTopColor: colors.outlineVariant + '30' }]}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, borderRadius: radii.full, marginTop: spacing[1] },
          ]}
          onPress={committed ? onClose : onSave}
          accessibilityRole="button"
          accessibilityLabel={committed ? 'Done' : 'Save to library'}
        >
          <Text
            style={[styles.primaryButtonText, { color: colors.onPrimary, ...typography.labelLg }]}
          >
            {committed ? 'Done' : 'Save to Library'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 12,
  },
  hint: {
    fontWeight: '500',
  },
  block: {
    gap: 10,
  },
  groupLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recentChipText: {
    flexShrink: 1,
    fontWeight: '800',
  },
  searchBox: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 24,
    padding: 0,
  },
  categoryList: {
    gap: 10,
  },
  categoryOption: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  categoryOptionTitle: {
    fontWeight: '800',
  },
  categoryOptionDescription: {
    lineHeight: 18,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  currentBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  emptyHint: {
    paddingVertical: 8,
  },
  createCollectionBox: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collectionInput: {
    flex: 1,
    minHeight: 42,
    padding: 0,
  },
  createCollectionButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipText: {
    fontWeight: '800',
  },
  removeWrap: {
    gap: 12,
  },
  removeDivider: {
    height: StyleSheet.hairlineWidth,
  },
  removeLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  removeLinkText: {
    fontWeight: '800',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    paddingTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  primaryButtonText: {
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
