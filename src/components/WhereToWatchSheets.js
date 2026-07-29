// Sheet contents for the watchlist Where-to-Watch filter: country picker,
// service picker, and collection scope picker. Each component owns its local
// UI state and reports the final choice through a callback, so the sheets stay
// correct even though StackBottomSheet snapshots its content when shown.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { fetchWatchProviderRegions, SERVICE_FALLBACK_COLORS } from '../lib/tmdb';
import { FALLBACK_WATCH_REGIONS, WHERE_TO_WATCH_SERVICES } from '../lib/whereToWatch';

function OptionRow({ label, sublabel, selected, onPress, leading, accessibilityLabel }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  return (
    <TouchableOpacity
      style={[
        styles.optionRow,
        {
          backgroundColor: selected ? GOLD_ACCENT + '18' : colors.surfaceContainerHigh,
          borderColor: selected ? GOLD_ACCENT + '66' : colors.outlineVariant + '33',
          borderRadius: radii.lg,
        },
      ]}
      activeOpacity={0.82}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected }}
    >
      {leading}
      <View style={styles.optionCopy}>
        <Text
          style={[
            styles.optionLabel,
            { color: selected ? GOLD_ACCENT : colors.onSurface, ...typography.bodyLg },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {!!sublabel && (
          <Text
            style={[styles.optionSublabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
            numberOfLines={1}
          >
            {sublabel}
          </Text>
        )}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={selected ? GOLD_ACCENT : colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );
}

export function WhereToWatchCountrySheet({ selectedCode, onSelect, allowAll = false }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const [regions, setRegions] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    fetchWatchProviderRegions()
      .then((fetched) => {
        if (alive && fetched.length) setRegions(fetched);
      })
      .catch(() => {
        // Fallback list is already on screen; nothing to do.
      });
    return () => {
      alive = false;
    };
  }, []);

  const visibleRegions = useMemo(() => {
    const base = regions || FALLBACK_WATCH_REGIONS;
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return base;
    return base.filter(
      (region) =>
        region.label.toLowerCase().includes(trimmed) || region.code.toLowerCase() === trimmed,
    );
  }, [regions, query]);

  return (
    <View style={styles.sheetContent}>
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
        <Ionicons name="search-outline" size={18} color={colors.onSurfaceVariant} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search countries"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[styles.searchInput, { color: colors.onSurface, ...typography.bodyLg }]}
          autoCorrect={false}
          accessibilityLabel="Search countries"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear country search"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {allowAll && !query.trim() ? (
        <OptionRow
          label="All Countries"
          sublabel="Show everything in your library"
          selected={!selectedCode}
          onPress={() => onSelect({ code: null, label: 'All countries' })}
          accessibilityLabel="Show titles from all countries"
          leading={
            <View style={[styles.leadingBadge, { borderColor: GOLD_DIM }]}>
              <Ionicons name="earth-outline" size={16} color={GOLD_ACCENT} />
            </View>
          }
        />
      ) : null}

      {visibleRegions.map((region) => (
        <OptionRow
          key={region.code}
          label={region.label}
          sublabel={region.code}
          selected={region.code === selectedCode}
          onPress={() => onSelect(region)}
          accessibilityLabel={`Filter availability for ${region.label}`}
          leading={
            <View style={[styles.leadingBadge, { borderColor: GOLD_DIM }]}>
              <Text style={[styles.leadingBadgeText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                {region.code}
              </Text>
            </View>
          }
        />
      ))}

      {visibleRegions.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          No countries match that search.
        </Text>
      )}
    </View>
  );
}

export function WhereToWatchServiceSheet({ selectedKey, onSelect }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <View style={styles.sheetContent}>
      <OptionRow
        label="Any Service"
        sublabel="Match titles on any tracked streaming service"
        selected={!selectedKey}
        onPress={() => onSelect(null)}
        accessibilityLabel="Match any streaming service"
        leading={
          <View style={[styles.leadingBadge, { borderColor: GOLD_DIM }]}>
            <Ionicons name="apps-outline" size={16} color={GOLD_ACCENT} />
          </View>
        }
      />
      {WHERE_TO_WATCH_SERVICES.map((service) => (
        <OptionRow
          key={service.key}
          label={service.label}
          selected={service.key === selectedKey}
          onPress={() => onSelect(service.key)}
          accessibilityLabel={`Only show titles on ${service.label}`}
          leading={
            <View style={[styles.leadingBadge, { borderColor: GOLD_DIM }]}>
              <View
                style={[
                  styles.serviceDot,
                  { backgroundColor: SERVICE_FALLBACK_COLORS[service.key] || GOLD_ACCENT },
                ]}
              />
            </View>
          }
        />
      ))}
      <Text style={[styles.footnote, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
        Availability data by TMDB · JustWatch. Rent and buy options are not included.
      </Text>
    </View>
  );
}

export function WhereToWatchCollectionsSheet({ collections, selectedIds, onApply }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const allIds = useMemo(() => collections.map((collection) => collection.id), [collections]);
  const [selected, setSelected] = useState(
    () => new Set(selectedIds?.length ? selectedIds : allIds),
  );

  const allSelected = selected.size === allIds.length;

  const toggle = (collectionId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };

  return (
    <View style={styles.sheetContent}>
      <OptionRow
        label="All Collections"
        sublabel="Search across your entire library"
        selected={allSelected}
        onPress={() => setSelected(new Set(allIds))}
        accessibilityLabel="Search across all collections"
        leading={
          <View style={[styles.leadingBadge, { borderColor: GOLD_DIM }]}>
            <Ionicons name="albums-outline" size={16} color={GOLD_ACCENT} />
          </View>
        }
      />
      {collections.map((collection) => (
        <OptionRow
          key={collection.id}
          label={collection.name}
          selected={selected.has(collection.id)}
          onPress={() => toggle(collection.id)}
          accessibilityLabel={`${selected.has(collection.id) ? 'Exclude' : 'Include'} ${collection.name}`}
          leading={
            <View style={[styles.leadingBadge, { borderColor: GOLD_DIM }]}>
              <Ionicons
                name={collection.icon || 'albums-outline'}
                size={16}
                color={GOLD_ACCENT}
              />
            </View>
          }
        />
      ))}

      <TouchableOpacity
        style={[
          styles.applyButton,
          {
            backgroundColor: selected.size ? GOLD_ACCENT : colors.surfaceContainerHigh,
            borderRadius: radii.full,
          },
        ]}
        disabled={!selected.size}
        onPress={() => onApply(allSelected ? null : Array.from(selected))}
        accessibilityRole="button"
        accessibilityLabel="Apply collection selection"
        accessibilityState={{ disabled: !selected.size }}
      >
        <Text
          style={[
            styles.applyButtonText,
            { color: selected.size ? '#1C1710' : colors.onSurfaceVariant, ...typography.labelSm },
          ]}
        >
          {selected.size ? `Search ${allSelected ? 'All' : selected.size} Collection${allSelected || selected.size !== 1 ? 's' : ''}` : 'Pick at least one'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    gap: 10,
    paddingBottom: 8,
  },
  searchBox: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    padding: 0,
  },
  optionRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    fontWeight: '700',
  },
  optionSublabel: {
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  leadingBadge: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  leadingBadgeText: {
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  serviceDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  emptyText: {
    paddingVertical: 12,
    textAlign: 'center',
  },
  footnote: {
    marginTop: 4,
    textAlign: 'center',
  },
  applyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 50,
  },
  applyButtonText: {
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
