import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { flagForCountryCode, serviceLabelsForRow } from '../lib/providerAvailability';
import { loadWhereToWatchPrefs } from '../lib/whereToWatch';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { MediaArtwork } from './MediaArtwork';
import { ProgrammeEyebrowLabel } from './ProgrammeSectionHeader';

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count || 0} ${(count || 0) === 1 ? singular : plural}`;
}

/**
 * Bottom-sheet peek for a single season: identity, synopsis, and — when the
 * episode-level provider scan ran — the countries where *that season* streams.
 *
 * The season-scoped answer is the honest one for a multi-season show: the
 * show-level table in Where To Watch intersects every season, so a series whose
 * last season moved service reads as unavailable everywhere. This sheet is
 * where that nuance lives.
 */
export function SeasonDetailSheetContent({ season, seriesTitle, colors, typography }) {
  const [homeCountry, setHomeCountry] = useState(null);

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

  const rows = useMemo(() => season?.availabilityRows || null, [season]);
  const providerSummary = useMemo(() => season?.providerSummary || [], [season]);

  const homeRow = useMemo(
    () => (homeCountry && rows ? rows.find((row) => row.code === homeCountry.code) : null),
    [rows, homeCountry],
  );

  if (!season) return null;

  const metaParts = [season.year, pluralize(season.episodeCount, 'episode')].filter(Boolean);

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
      <View style={styles.header}>
        <MediaArtwork
          uri={season.posterUrl}
          style={styles.poster}
          accessibilityLabel={`${season.name} poster`}
          title={season.name}
          icon="tv-outline"
          instant
        />
        <View style={styles.headerBody}>
          <Text
            style={[styles.seriesTitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
            numberOfLines={1}
          >
            {seriesTitle}
          </Text>
          <Text
            style={[styles.seasonName, { color: colors.onSurface, ...typography.titleMd }]}
            numberOfLines={2}
          >
            {season.name}
          </Text>
          <Text
            style={[styles.seasonMeta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
          >
            {metaParts.join(' · ')}
          </Text>
          {season.ratingValue ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={GOLD_ACCENT} />
              <Text style={[styles.ratingText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                {season.ratingValue.toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {season.overview ? (
        <View style={styles.block}>
          <ProgrammeEyebrowLabel eyebrow="Synopsis" />
          <Text style={[styles.overview, { color: colors.onSurface, ...typography.bodyMd }]}>
            {season.overview}
          </Text>
        </View>
      ) : null}

      <View style={styles.block}>
        <ProgrammeEyebrowLabel eyebrow="Where To Watch This Season" />

        {!rows ? (
          <View style={styles.fallbackRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.onSurfaceVariant} />
            <Text
              style={[
                styles.fallbackText,
                { color: colors.onSurfaceVariant, ...typography.labelSm },
              ]}
            >
              Season-by-season availability isn&apos;t available for this show — see Where To Watch
              for the series-wide answer.
            </Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.fallbackRow}>
            <Ionicons name="earth-outline" size={16} color={colors.onSurfaceVariant} />
            <Text
              style={[
                styles.fallbackText,
                { color: colors.onSurfaceVariant, ...typography.labelSm },
              ]}
            >
              This season isn&apos;t free to stream anywhere right now.
            </Text>
          </View>
        ) : (
          <>
            {homeCountry ? (
              <View
                style={[
                  styles.homeStatus,
                  {
                    backgroundColor: colors.surfaceContainer,
                    borderColor: homeRow ? GOLD_DIM : colors.outlineVariant,
                  },
                ]}
                accessible
                accessibilityLabel={`In your country, ${homeCountry.label}: ${
                  homeRow
                    ? serviceLabelsForRow(homeRow).join(', ')
                    : 'this season is not free to stream'
                }`}
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
                        color: homeRow ? GOLD_ACCENT : colors.onSurfaceVariant,
                        ...typography.bodyMd,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {homeRow
                      ? serviceLabelsForRow(homeRow).join(', ')
                      : 'Not free to stream here right now'}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.table}>
              {rows.map((row, rowIndex) => {
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
                    accessibilityLabel={`${row.country}${
                      isHome ? ', your country' : ''
                    }: ${rowServices.join(', ')}`}
                  >
                    <Text style={styles.rowFlag} importantForAccessibility="no">
                      {flagForCountryCode(row.code)}
                    </Text>
                    <Text
                      style={[
                        styles.countryName,
                        { color: isHome ? GOLD_ACCENT : colors.onSurface, ...typography.bodyMd },
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
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 28,
  },
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: 10,
    width: 92,
  },
  headerBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  seriesTitle: {
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  seasonName: {
    fontWeight: '800',
  },
  seasonMeta: {
    fontWeight: '600',
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontWeight: '800',
  },
  block: {
    marginBottom: 28,
  },
  overview: {
    fontWeight: '400',
    lineHeight: 24,
  },
  fallbackRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  fallbackText: {
    flex: 1,
    fontWeight: '500',
    lineHeight: 20,
  },
  homeStatus: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
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
});
