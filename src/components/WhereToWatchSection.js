import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  SERVICE_LABELS,
  flagForCountryCode,
  serviceLabelsForRow,
} from '../lib/providerAvailability';
import { loadWhereToWatchPrefs } from '../lib/whereToWatch';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { hugLabel } from '../utils/labelText';
import { ProgrammeEyebrowLabel } from './ProgrammeSectionHeader';

/** Countries rendered before the user asks for the full list. */
const COLLAPSED_ROW_COUNT = 8;

function joinWithOr(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

/**
 * Global availability atlas for one title: every country where it streams free
 * (subscription / ad-supported), filterable by service.
 *
 * Deliberately *not* localised down to the viewer's country — showing the whole
 * world is the point of this section. The viewer's own country is called out in
 * a status line so that answer is always one glance away, however long the list
 * gets and wherever the country falls alphabetically.
 *
 * Mount with `key={tmdbId}` so filter/expand state resets between titles.
 */
export function WhereToWatchSection({
  rows,
  providerSummary = [],
  confidence,
  isTv,
  colors,
  typography,
}) {
  const [serviceFilter, setServiceFilter] = useState(null);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [homeCountry, setHomeCountry] = useState(null);

  // Reuses the country the watchlist's Where-to-Watch filter last persisted.
  useEffect(() => {
    let cancelled = false;
    loadWhereToWatchPrefs().then((prefs) => {
      if (!cancelled && prefs?.countryCode) {
        setHomeCountry({ code: prefs.countryCode, label: prefs.countryLabel });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allRows = useMemo(() => rows || [], [rows]);

  const availableProviders = useMemo(
    () => providerSummary.filter((provider) => provider.count > 0),
    [providerSummary],
  );

  const filteredRows = useMemo(
    () => (serviceFilter ? allRows.filter((row) => row.providers[serviceFilter]) : allRows),
    [allRows, serviceFilter],
  );

  const visibleRows = showAllCountries ? filteredRows : filteredRows.slice(0, COLLAPSED_ROW_COUNT);
  const hiddenRowCount = filteredRows.length - visibleRows.length;

  const homeRow = useMemo(
    () => (homeCountry ? allRows.find((row) => row.code === homeCountry.code) : null),
    [allRows, homeCountry],
  );

  const handleServicePress = useCallback((key) => {
    Haptics.selectionAsync();
    setShowAllCountries(false);
    setServiceFilter((current) => (current === key ? null : key));
  }, []);

  const handleShowAll = useCallback(() => {
    Haptics.selectionAsync();
    setShowAllCountries(true);
  }, []);

  const filterLabel = serviceFilter ? SERVICE_LABELS[serviceFilter] : null;

  // Availability in the viewer's own country, under the current filter.
  let homeStatus = null;
  if (homeCountry) {
    const homeServices = serviceLabelsForRow(homeRow);
    const streamsHere = serviceFilter
      ? Boolean(homeRow?.providers[serviceFilter])
      : homeServices.length > 0;

    let detail;
    if (streamsHere) {
      detail = serviceFilter ? filterLabel : homeServices.join(', ');
    } else if (serviceFilter) {
      detail = `Not on ${filterLabel} here`;
    } else {
      detail = 'Not free to stream here right now';
    }
    homeStatus = { streamsHere, detail };
  }

  return (
    <View style={styles.section}>
      <ProgrammeEyebrowLabel eyebrow="Where To Watch" />

      {isTv && confidence === 'episode' ? (
        <View style={styles.confidenceRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={GOLD_ACCENT} />
          <Text
            style={[styles.confidenceText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
          >
            Every episode checked — not just the series listing
          </Text>
        </View>
      ) : null}

      {allRows.length === 0 ? (
        <View style={styles.availabilityEmpty}>
          <Ionicons name="earth-outline" size={22} color={colors.onSurfaceVariant} />
          <View style={styles.availabilityEmptyBody}>
            <Text
              style={[
                styles.availabilityEmptyTitle,
                { color: colors.onSurface, ...typography.bodyMd },
              ]}
            >
              Not free to stream anywhere right now.
            </Text>
            <Text
              style={[
                styles.availabilityEmptyText,
                { color: colors.onSurfaceVariant, ...typography.labelSm },
              ]}
            >
              {`Trova tracks subscription and ad-supported catalogues on ${joinWithOr(
                Object.values(SERVICE_LABELS),
              )}. Rentals and purchases aren't included.`}
            </Text>
          </View>
        </View>
      ) : (
        <>
          {availableProviders.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { borderColor: colors.outlineVariant },
                  !serviceFilter && styles.filterChipActive,
                ]}
                onPress={() => handleServicePress(null)}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={`Show all services, ${allRows.length} countries`}
                accessibilityState={{ selected: !serviceFilter }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: !serviceFilter ? GOLD_ACCENT : colors.onSurfaceVariant,
                      ...typography.labelSm,
                    },
                  ]}
                >
                  {hugLabel(`All · ${allRows.length}`)}
                </Text>
              </TouchableOpacity>

              {availableProviders.map((provider) => {
                const isActive = serviceFilter === provider.key;
                return (
                  <TouchableOpacity
                    key={provider.key}
                    style={[
                      styles.filterChip,
                      { borderColor: colors.outlineVariant },
                      isActive && styles.filterChipActive,
                    ]}
                    onPress={() => handleServicePress(provider.key)}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel={`${provider.label}, ${provider.count} ${
                      provider.count === 1 ? 'country' : 'countries'
                    }`}
                    accessibilityState={{ selected: isActive }}
                  >
                    {provider.logoUrl ? (
                      <Image
                        source={{ uri: provider.logoUrl }}
                        style={styles.filterChipLogo}
                        importantForAccessibility="no"
                      />
                    ) : (
                      <View
                        style={[styles.dot, { backgroundColor: provider.fallbackColor }]}
                        importantForAccessibility="no"
                      />
                    )}
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: isActive ? GOLD_ACCENT : colors.onSurfaceVariant,
                          ...typography.labelSm,
                        },
                      ]}
                    >
                      {hugLabel(`${provider.label} · ${provider.count}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {homeStatus ? (
            <View
              style={[
                styles.homeStatus,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: homeStatus.streamsHere ? GOLD_DIM : colors.outlineVariant,
                },
              ]}
              accessible
              accessibilityLabel={`In your country, ${homeCountry.label}: ${homeStatus.detail}`}
            >
              <Text style={styles.homeStatusFlag} importantForAccessibility="no">
                {flagForCountryCode(homeCountry.code)}
              </Text>
              <View style={styles.homeStatusBody}>
                <Text
                  style={[
                    styles.homeStatusLabel,
                    { color: colors.onSurfaceVariant, ...typography.labelSm },
                  ]}
                >
                  {`Your country · ${homeCountry.label}`}
                </Text>
                <Text
                  style={[
                    styles.homeStatusDetail,
                    {
                      color: homeStatus.streamsHere ? GOLD_ACCENT : colors.onSurfaceVariant,
                      ...typography.bodyMd,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {homeStatus.detail}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.table}>
            {visibleRows.map((row, rowIndex) => {
              const isHome = homeCountry ? row.code === homeCountry.code : false;
              const rowServices = serviceLabelsForRow(row);
              return (
                <View
                  key={row.code}
                  style={[
                    styles.tableRow,
                    rowIndex > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: GOLD_DIM,
                    },
                    isHome && styles.tableRowHome,
                  ]}
                  accessible
                  accessibilityLabel={`${row.country}${isHome ? ', your country' : ''}: ${rowServices.join(
                    ', ',
                  )}`}
                >
                  <Text style={styles.rowFlag} importantForAccessibility="no">
                    {flagForCountryCode(row.code)}
                  </Text>
                  <Text
                    style={[
                      styles.countryName,
                      {
                        color: isHome ? GOLD_ACCENT : colors.onSurface,
                        ...typography.bodyMd,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {row.country}
                  </Text>
                  <View style={styles.providerBadges} importantForAccessibility="no">
                    {providerSummary.map((provider) =>
                      row.providers[provider.key] ? (
                        provider.logoUrl ? (
                          <Image
                            key={provider.key}
                            source={{ uri: provider.logoUrl }}
                            style={[styles.serviceLogo, { borderColor: provider.fallbackColor }]}
                          />
                        ) : (
                          <View
                            key={provider.key}
                            style={[styles.dot, { backgroundColor: provider.fallbackColor }]}
                          />
                        )
                      ) : null,
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {hiddenRowCount > 0 ? (
            <TouchableOpacity
              onPress={handleShowAll}
              style={[styles.showAllButton, { borderColor: colors.outlineVariant }]}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Show all ${filteredRows.length} countries`}
            >
              <Text style={[styles.showAllText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                {`Show all ${filteredRows.length} countries`}
              </Text>
              <Ionicons name="chevron-down" size={14} color={GOLD_ACCENT} />
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 40,
  },
  confidenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    marginTop: -6,
  },
  confidenceText: {
    flex: 1,
    fontWeight: '600',
  },
  filterScroll: {
    gap: 8,
    paddingRight: 24,
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: GOLD_ACCENT + '18',
    borderColor: GOLD_ACCENT,
  },
  filterChipLogo: {
    borderRadius: 5,
    height: 18,
    width: 18,
  },
  filterChipText: {
    fontWeight: '700',
  },
  homeStatus: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  homeStatusFlag: {
    fontSize: 22,
  },
  homeStatusBody: {
    flex: 1,
  },
  homeStatusLabel: {
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  homeStatusDetail: {
    fontWeight: '700',
  },
  table: {
    marginTop: 16,
    overflow: 'hidden',
  },
  tableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 11,
  },
  tableRowHome: {
    borderLeftColor: GOLD_ACCENT,
    borderLeftWidth: 2,
    paddingLeft: 10,
  },
  rowFlag: {
    fontSize: 18,
  },
  countryName: {
    flex: 1,
    fontWeight: '500',
  },
  providerBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  serviceLogo: {
    borderRadius: 6,
    borderWidth: 1.5,
    height: 24,
    width: 24,
  },
  availabilityEmpty: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  availabilityEmptyBody: {
    flex: 1,
  },
  availabilityEmptyTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  availabilityEmptyText: {
    fontWeight: '500',
    lineHeight: 20,
  },
  showAllButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  showAllText: {
    fontWeight: '800',
  },
});
