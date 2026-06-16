import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { WATCHLIST_STATUSES } from '../lib/watchlistModel';

export function WatchlistCollectionsSheet({
  item,
  collections,
  onCreateCollection,
  onToggleCollection,
  onSetStatus,
  onRemove,
  onClose,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii, spacing } = theme;
  const [name, setName] = useState('');
  const selectedCollectionIds = new Set(item?.collectionIds || []);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateCollection(trimmed);
    setName('');
  };

  return (
    <View style={styles.collectionSheetContent}>
      <View style={styles.collectionSheetHeader}>
        <Text style={[styles.categoryEyebrow, { color: colors.primary, ...typography.labelSm }]}>
          Library
        </Text>
        <Text
          style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]}
          numberOfLines={2}
        >
          {item?.title}
        </Text>
        <Text
          style={[
            styles.collectionSheetHint,
            { color: colors.onSurfaceVariant, ...typography.bodyMd },
          ]}
        >
          Bookmark saves this title to your library. Collections can overlap.
        </Text>
      </View>

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
                size={15}
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
          placeholder="New collection name"
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
          accessibilityLabel="Create collection"
          accessibilityState={{ disabled: !name.trim() }}
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.categoryList}>
        {collections.map((collection) => {
          const isSelected = selectedCollectionIds.has(collection.id);
          const locked = collection.immutable && isSelected;
          return (
            <TouchableOpacity
              key={collection.id}
              style={[
                styles.categoryOption,
                {
                  backgroundColor: isSelected ? colors.primary + '18' : colors.surfaceContainerHigh,
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
                    <View style={[styles.currentBadge, { backgroundColor: colors.primary + '22' }]}>
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

        <TouchableOpacity
          style={[
            styles.removeOption,
            {
              backgroundColor: colors.error + '12',
              borderColor: colors.error + '33',
              borderRadius: radii.lg,
              marginTop: spacing[2],
            },
          ]}
          activeOpacity={0.82}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove from library"
        >
          <View style={[styles.categoryIcon, { backgroundColor: colors.error + '22' }]}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </View>
          <View style={styles.categoryCopy}>
            <Text
              style={[styles.categoryOptionTitle, { color: colors.error, ...typography.bodyLg }]}
            >
              Remove from Library
            </Text>
            <Text
              style={[
                styles.categoryOptionDescription,
                { color: colors.onSurfaceVariant, ...typography.bodyMd },
              ]}
            >
              Removes this title from your saved library.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.error} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.doneCollectionButton,
            { backgroundColor: colors.primary, borderRadius: radii.full },
          ]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Done managing collections"
        >
          <Text
            style={[
              styles.doneCollectionButtonText,
              { color: colors.onPrimary, ...typography.labelSm },
            ]}
          >
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collectionSheetContent: {
    gap: 14,
  },
  collectionSheetHeader: {
    gap: 4,
    marginBottom: 2,
  },
  collectionSheetHint: {
    fontWeight: '500',
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
    paddingVertical: 9,
  },
  statusChipText: {
    fontWeight: '900',
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
  removeOption: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    padding: 14,
  },
  doneCollectionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 14,
  },
  doneCollectionButtonText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
