import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { serviceLabelsForRow } from '../lib/providerAvailability';
import { loadWhereToWatchPrefs } from '../lib/whereToWatch';
import { GOLD_ACCENT } from '../theme/programme';
import { MediaArtwork } from './MediaArtwork';
import { ProgrammeEyebrowLabel } from './ProgrammeSectionHeader';
import { searchMovieTorrents } from '../lib/torrentSearchEngine';
import { launchStream } from '../lib/streamLauncher';

function formatMovieRuntime(minutes) {
  if (!minutes || minutes <= 0) return null;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

/**
 * Movie Stream Hub: provides peer swarm stream resolution, 1-click landscape
 * mpv playback, quality breakdowns (4K, 1080p, 720p), and streaming provider availability.
 */
export function MovieStreamSheetContent({
  movieTitle,
  movieYear,
  imdbId,
  posterUrl,
  runtimeMinutes,
  genres,
  ratingValue,
  rows,
  providerSummary,
  colors,
  typography,
}) {
  const [activeTab, setActiveTab] = useState('streams'); // 'streams' | 'availability'
  const [streams, setStreams] = useState([]);
  const [streamsLoading, setStreamsLoading] = useState(true);

  // Streaming availability in user's country
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

  // Fetch peer swarms for the movie
  useEffect(() => {
    let cancelled = false;
    if (movieTitle) {
      setStreamsLoading(true);
      searchMovieTorrents({
        title: movieTitle,
        year: movieYear,
        imdbId,
      }).then((results) => {
        if (!cancelled) {
          setStreams(results);
          setStreamsLoading(false);
        }
      });
    } else {
      setStreamsLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [movieTitle, movieYear, imdbId]);

  const homeRow = useMemo(
    () => (homeCountry && rows ? rows.find((row) => row.code === homeCountry.code) : null),
    [rows, homeCountry],
  );

  const topStream = streams[0] || null;

  const handleLaunch = useCallback(
    async (magnetUrl, releaseName) => {
      Haptics.selectionAsync();
      await launchStream({ magnetUrl, title: releaseName });
    },
    [],
  );

  const runtimeLabel = formatMovieRuntime(runtimeMinutes);
  const metaParts = [movieYear, runtimeLabel, genres].filter(Boolean);

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <MediaArtwork
          uri={posterUrl}
          style={styles.poster}
          accessibilityLabel={`${movieTitle} poster`}
          title={movieTitle}
          icon="film-outline"
          instant
        />
        <View style={styles.headerBody}>
          <Text
            style={[styles.movieTitle, { color: colors.onSurface, ...typography.titleMd }]}
            numberOfLines={2}
          >
            {movieTitle}
          </Text>
          <Text
            style={[styles.movieMeta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
            numberOfLines={2}
          >
            {metaParts.join(' · ')}
          </Text>
          {ratingValue ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={GOLD_ACCENT} />
              <Text style={[styles.ratingText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                {typeof ratingValue === 'number' ? ratingValue.toFixed(1) : String(ratingValue)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Auto Play Best Stream Header */}
      <View style={styles.autoPlayContainer}>
        <TouchableOpacity
          style={styles.autoPlayHeader}
          onPress={() => topStream && handleLaunch(topStream.magnetUrl, topStream.name)}
          activeOpacity={topStream ? 0.7 : 1}
          disabled={!topStream}
        >
          <Ionicons name="play" size={16} color={GOLD_ACCENT} />
          <View style={styles.autoPlayTextCol}>
            <Text style={[styles.autoPlayTitle, { color: GOLD_ACCENT, ...typography.labelMd }]}>
              Auto Play Best Stream (Landscape)
            </Text>
            <Text
              style={[
                styles.autoPlaySubtitle,
                { color: colors.onSurfaceVariant, ...typography.labelSm },
              ]}
              numberOfLines={1}
            >
              {streamsLoading
                ? 'Searching peer swarms for verified releases...'
                : topStream
                ? `${topStream.attributes?.resolution} · ${topStream.formattedSize} · ${topStream.seeders} seeds`
                : 'No peer streams found'}
            </Text>
          </View>
          {streamsLoading ? (
            <ActivityIndicator size="small" color={GOLD_ACCENT} />
          ) : topStream ? (
            <Ionicons name="play-circle-outline" size={20} color={GOLD_ACCENT} />
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Segmented Tab Control */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('streams');
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              typography.labelMd,
              {
                color: activeTab === 'streams' ? GOLD_ACCENT : colors.onSurfaceVariant,
                fontWeight: activeTab === 'streams' ? '800' : '500',
              },
            ]}
          >
            {streams.length > 0 ? `Streams (${streams.length})` : 'Streams'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('availability');
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              typography.labelMd,
              {
                color: activeTab === 'availability' ? GOLD_ACCENT : colors.onSurfaceVariant,
                fontWeight: activeTab === 'availability' ? '800' : '500',
              },
            ]}
          >
            Where To Watch
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content: STREAMS */}
      {activeTab === 'streams' && (
        <View style={styles.streamsContainer}>
          {streamsLoading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="small" color={GOLD_ACCENT} />
              <Text
                style={[
                  styles.loaderText,
                  { color: colors.onSurfaceVariant, ...typography.labelSm },
                ]}
              >
                Searching peer swarms for releases...
              </Text>
            </View>
          ) : !streams.length ? (
            <View style={styles.emptyStreams}>
              <Ionicons name="film-outline" size={24} color={colors.onSurfaceVariant} />
              <Text
                style={[
                  styles.emptyStreamsText,
                  { color: colors.onSurfaceVariant, ...typography.bodyMd },
                ]}
              >
                No peer streams found for this movie.
              </Text>
            </View>
          ) : (
            streams.map((item) => (
              <View key={item.infoHash} style={styles.streamItem}>
                <View style={styles.streamMetaRow}>
                  <Text
                    style={[styles.streamName, { color: colors.onSurface, ...typography.bodySm }]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <View style={styles.badgeRow}>
                    <Text
                      style={[
                        styles.qualityBadge,
                        { color: GOLD_ACCENT, ...typography.labelSm },
                      ]}
                    >
                      {item.attributes?.resolution}
                    </Text>
                    {item.attributes?.codec && (
                      <Text
                        style={[
                          styles.attrBadge,
                          { color: colors.onSurfaceVariant, ...typography.labelSm },
                        ]}
                      >
                        {item.attributes.codec}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.seedBadge,
                        {
                          color: item.seeders >= 50 ? '#4CAF50' : '#E5A93C',
                          ...typography.labelSm,
                        },
                      ]}
                    >
                      {item.seeders} seeds
                    </Text>
                    <Text
                      style={[
                        styles.sizeBadge,
                        { color: colors.onSurfaceVariant, ...typography.labelSm },
                      ]}
                    >
                      {item.formattedSize}
                    </Text>
                  </View>
                </View>

                <View style={styles.streamActionsRow}>
                  <TouchableOpacity
                    style={styles.streamPrimaryBtn}
                    onPress={() => handleLaunch(item.magnetUrl, item.name)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="play" size={13} color={GOLD_ACCENT} />
                    <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                      Stream Movie
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Tab Content: WHERE TO WATCH */}
      {activeTab === 'availability' && (
        <View style={styles.availabilityContainer}>
          {homeCountry && (
            <View style={styles.block}>
              <ProgrammeEyebrowLabel
                text={`STREAMING IN ${homeCountry.label || homeCountry.code}`}
                colors={colors}
                typography={typography}
              />
              {homeRow ? (
                <View style={styles.homeStatus}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <View style={styles.homeStatusBody}>
                    <Text
                      style={[
                        styles.homeStatusLabel,
                        { color: colors.onSurfaceVariant, ...typography.labelSm },
                      ]}
                    >
                      Available
                    </Text>
                    <Text
                      style={[
                        styles.homeStatusDetail,
                        { color: colors.onSurface, ...typography.bodyMd },
                      ]}
                    >
                      {serviceLabelsForRow(homeRow).join(', ') || 'Streaming available'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.fallbackRow}>
                  <Ionicons name="globe-outline" size={15} color={colors.onSurfaceVariant} />
                  <Text
                    style={[
                      styles.fallbackText,
                      { color: colors.onSurfaceVariant, ...typography.labelSm },
                    ]}
                  >
                    Not currently streaming on subscribed services in {homeCountry.label}.
                  </Text>
                </View>
              )}
            </View>
          )}

          {rows && rows.length > 0 && (
            <View style={styles.block}>
              <ProgrammeEyebrowLabel
                text="GLOBAL AVAILABILITY"
                colors={colors}
                typography={typography}
              />
              <View style={styles.table}>
                {rows.slice(0, 8).map((row) => (
                  <View key={row.code} style={styles.tableRow}>
                    <Text
                      style={[
                        styles.countryName,
                        { color: colors.onSurface, ...typography.bodySm },
                      ]}
                      numberOfLines={1}
                    >
                      {row.name || row.code}
                    </Text>
                    <View style={styles.providerBadges}>
                      {serviceLabelsForRow(row).slice(0, 3).map((serviceName, idx) => {
                        const summaryMatch = providerSummary?.find(
                          (p) => p.name?.toLowerCase() === serviceName.toLowerCase(),
                        );
                        return summaryMatch?.logoUrl ? (
                          <Image
                            key={idx}
                            source={{ uri: summaryMatch.logoUrl }}
                            style={styles.serviceLogo}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            key={idx}
                            style={[styles.dot, { backgroundColor: colors.outlineVariant }]}
                          />
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  poster: {
    borderRadius: 8,
    height: 96,
    width: 64,
  },
  headerBody: {
    flex: 1,
    gap: 4,
  },
  movieTitle: {
    fontWeight: '700',
    lineHeight: 22,
  },
  movieMeta: {
    fontWeight: '500',
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontWeight: '700',
  },
  autoPlayContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginBottom: 16,
  },
  autoPlayHeader: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  autoPlayTextCol: {
    flex: 1,
    gap: 2,
  },
  autoPlayTitle: {
    fontWeight: '700',
  },
  autoPlaySubtitle: {
    fontWeight: '500',
  },
  tabBar: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  tabButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 6,
  },
  tabText: {
    letterSpacing: 0.3,
  },
  streamsContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingBottom: 24,
  },
  loaderCenter: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  loaderText: {
    fontWeight: '500',
  },
  emptyStreams: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  emptyStreamsText: {
    fontWeight: '500',
    textAlign: 'center',
  },
  streamItem: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    gap: 8,
    paddingVertical: 10,
  },
  streamMetaRow: {
    gap: 4,
  },
  streamName: {
    fontWeight: '600',
    lineHeight: 18,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  qualityBadge: {
    fontWeight: '800',
  },
  attrBadge: {
    fontWeight: '600',
  },
  seedBadge: {
    fontWeight: '700',
  },
  sizeBadge: {
    fontWeight: '500',
  },
  streamActionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  streamPrimaryBtn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  streamPrimaryText: {
    color: GOLD_ACCENT,
    fontWeight: '700',
  },
  availabilityContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingBottom: 24,
  },
  block: {
    marginBottom: 24,
  },
  fallbackRow: {
    alignItems: 'center',
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
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
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
    marginTop: 12,
  },
  tableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
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
    height: 24,
    width: 24,
  },
});
