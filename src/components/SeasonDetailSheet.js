import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { toastiva } from 'toastiva';
import { GOLD_ACCENT } from '../theme/programme';
import { MediaArtwork } from './MediaArtwork';
import { ProgrammeEyebrowLabel } from './ProgrammeSectionHeader';
import { fetchSeasonEpisodes } from '../lib/tmdb';
import {
  searchEpisodeTorrents,
  searchSeasonPackTorrents,
} from '../lib/torrentSearchEngine';
import { launchStream } from '../lib/streamLauncher';

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count || 0} ${(count || 0) === 1 ? singular : plural}`;
}

function formatAirDate(airDate) {
  if (!airDate) return null;
  try {
    const d = new Date(`${airDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return airDate;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return airDate;
  }
}

/**
 * Enhanced Season Hub: provides interactive episode browsing, episode-level
 * playback source resolution, and complete Season Pack binge mode.
 */
export function SeasonDetailSheetContent({
  season,
  seriesTitle,
  seriesTmdbId,
  imdbId,
  seriesYear,
  colors,
  typography,
}) {
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);

  // Season Pack state
  const [seasonPacks, setSeasonPacks] = useState([]);
  const [seasonPackLoading, setSeasonPackLoading] = useState(false);
  const [showSeasonPackDrawer, setShowSeasonPackDrawer] = useState(false);

  // Per-episode streaming states: { [episodeNumber]: resultsArray }
  const [episodeSources, setEpisodeSources] = useState({});
  const [loadingEpisodes, setLoadingEpisodes] = useState({});
  const [expandedEpisodeSources, setExpandedEpisodeSources] = useState({});
  const [expandedOverview, setExpandedOverview] = useState({});

  // Fetch season episodes from TMDb
  useEffect(() => {
    let cancelled = false;
    if (seriesTmdbId && season?.seasonNumber != null) {
      setEpisodesLoading(true);
      fetchSeasonEpisodes(seriesTmdbId, season.seasonNumber).then((eps) => {
        if (!cancelled) {
          setEpisodes(eps);
          setEpisodesLoading(false);
        }
      });
    } else {
      setEpisodesLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [seriesTmdbId, season?.seasonNumber]);

  // Pre-fetch top season pack in the background
  useEffect(() => {
    let cancelled = false;
    if (seriesTitle && season?.seasonNumber != null) {
      setSeasonPackLoading(true);
      searchSeasonPackTorrents({
        seriesTitle,
        seasonNumber: season.seasonNumber,
        imdbId,
      }).then((packs) => {
        if (!cancelled) {
          setSeasonPacks(packs);
          setSeasonPackLoading(false);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [seriesTitle, season?.seasonNumber, imdbId]);

  const topSeasonPack = seasonPacks[0] || null;

  // Stream launch helper (auto opens mpv.android with auto-play in landscape)
  const handleLaunchStream = useCallback(
    async (magnetUrl, releaseName, fileIdx, episodeNum) => {
      Haptics.selectionAsync();
      await launchStream({
        magnetUrl,
        title: releaseName,
        fileIdx,
        imdbId,
        season: season?.seasonNumber,
        episode: episodeNum,
      });
    },
    [imdbId, season?.seasonNumber],
  );

  // Toggle season pack drawer
  const handleToggleSeasonPack = useCallback(() => {
    Haptics.selectionAsync();
    if (!seasonPacks.length && !seasonPackLoading && seriesTitle && season?.seasonNumber != null) {
      setSeasonPackLoading(true);
      searchSeasonPackTorrents({
        seriesTitle,
        seasonNumber: season.seasonNumber,
        imdbId,
      }).then((packs) => {
        setSeasonPacks(packs);
        setSeasonPackLoading(false);
        setShowSeasonPackDrawer(true);
      });
    } else {
      setShowSeasonPackDrawer((prev) => !prev);
    }
  }, [seasonPacks.length, seasonPackLoading, seriesTitle, season?.seasonNumber, imdbId]);

  // Fetch and expand sources for an episode
  const handleStreamEpisode = useCallback(
    async (ep) => {
      Haptics.selectionAsync();
      const epNum = ep.episodeNumber;

      // If already expanded, toggle collapse
      if (expandedEpisodeSources[epNum]) {
        setExpandedEpisodeSources((prev) => ({ ...prev, [epNum]: false }));
        return;
      }

      // If already fetched, just expand
      if (episodeSources[epNum]) {
        setExpandedEpisodeSources((prev) => ({ ...prev, [epNum]: true }));
        return;
      }

      setLoadingEpisodes((prev) => ({ ...prev, [epNum]: true }));
      try {
        const sources = await searchEpisodeTorrents({
          seriesTitle,
          seasonNumber: season.seasonNumber,
          episodeNumber: epNum,
          imdbId,
        });

        setEpisodeSources((prev) => ({ ...prev, [epNum]: sources }));
        setExpandedEpisodeSources((prev) => ({ ...prev, [epNum]: true }));

        if (!sources.length) {
          toastiva.info(`No sources found for Episode ${epNum}`);
        }
      } catch {
        toastiva.info(`Unable to query sources for Episode ${epNum}`);
      } finally {
        setLoadingEpisodes((prev) => ({ ...prev, [epNum]: false }));
      }
    },
    [expandedEpisodeSources, episodeSources, seriesTitle, season?.seasonNumber, imdbId],
  );

  if (!season) return null;

  const metaParts = [season.year, pluralize(season.episodeCount, 'episode')].filter(Boolean);

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
      {/* Header */}
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

      {/* Play Season Pack (Binge Mode) Action Bar */}
      <View style={styles.seasonPackContainer}>
        <TouchableOpacity
          style={styles.seasonPackHeader}
          onPress={handleToggleSeasonPack}
          activeOpacity={0.7}
        >
          <Ionicons name="play" size={16} color={GOLD_ACCENT} />
          <View style={styles.seasonPackTextCol}>
            <Text style={[styles.seasonPackTitle, { color: GOLD_ACCENT, ...typography.labelMd }]}>
              Play Season Pack (Binge Mode)
            </Text>
            <Text
              style={[
                styles.seasonPackSubtitle,
                { color: colors.onSurfaceVariant, ...typography.labelSm },
              ]}
              numberOfLines={1}
            >
              {seasonPackLoading
                ? 'Searching peer swarms for season pack...'
                : topSeasonPack
                ? `${topSeasonPack.attributes?.resolution} · ${topSeasonPack.formattedSize} · ${topSeasonPack.seeders} seeds`
                : 'Play complete season in one continuous playlist'}
            </Text>
          </View>
          {seasonPackLoading ? (
            <ActivityIndicator size="small" color={GOLD_ACCENT} />
          ) : (
            <Ionicons
              name={showSeasonPackDrawer ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={GOLD_ACCENT}
            />
          )}
        </TouchableOpacity>

        {/* Season Pack Drawer */}
        {showSeasonPackDrawer && (
          <View style={styles.seasonPackDrawer}>
            {!seasonPacks.length ? (
              <Text
                style={[
                  styles.emptySourcesText,
                  { color: colors.onSurfaceVariant, ...typography.labelSm },
                ]}
              >
                No season pack torrents found for this season.
              </Text>
            ) : (
              seasonPacks.slice(0, 3).map((pack) => (
                <View
                  key={pack.infoHash}
                  style={styles.sourceItem}
                >
                  <View style={styles.sourceMetaRow}>
                    <Text
                      style={[styles.sourceName, { color: colors.onSurface, ...typography.bodySm }]}
                      numberOfLines={2}
                    >
                      {pack.name}
                    </Text>
                    <View style={styles.badgeRow}>
                      <Text
                        style={[
                          styles.qualityBadge,
                          { color: GOLD_ACCENT, ...typography.labelSm },
                        ]}
                      >
                        {pack.attributes?.resolution}
                      </Text>
                      {pack.attributes?.codec && (
                        <Text
                          style={[
                            styles.attrBadge,
                            { color: colors.onSurfaceVariant, ...typography.labelSm },
                          ]}
                        >
                          {pack.attributes.codec}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.seedBadge,
                          {
                            color: pack.seeders >= 50 ? '#4CAF50' : '#E5A93C',
                            ...typography.labelSm,
                          },
                        ]}
                      >
                        {pack.seeders} seeds
                      </Text>
                      <Text
                        style={[
                          styles.sizeBadge,
                          { color: colors.onSurfaceVariant, ...typography.labelSm },
                        ]}
                      >
                        {pack.formattedSize}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sourceActionsRow}>
                    <TouchableOpacity
                      style={styles.streamPrimaryBtn}
                      onPress={() => handleLaunchStream(pack.magnetUrl, pack.name, pack.fileIdx)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="play" size={13} color={GOLD_ACCENT} />
                      <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                        Play Season
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* Season Synopsis */}
      {season.overview ? (
        <View style={styles.synopsisBlock}>
          <ProgrammeEyebrowLabel eyebrow="Synopsis" />
          <Text style={[styles.overview, { color: colors.onSurface, ...typography.bodyMd }]}>
            {season.overview}
          </Text>
        </View>
      ) : null}

      {/* Episodes Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, typography.labelMd, { color: GOLD_ACCENT }]}>
          Episodes {episodes.length ? `(${episodes.length})` : ''}
        </Text>
      </View>

      {/* Episodes List */}
      <View style={styles.episodesContainer}>
          {episodesLoading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="small" color={GOLD_ACCENT} />
              <Text
                style={[
                  styles.loaderText,
                  { color: colors.onSurfaceVariant, ...typography.labelSm },
                ]}
              >
                Loading episodes from TMDb...
              </Text>
            </View>
          ) : !episodes.length ? (
            <View style={styles.emptyEpisodes}>
              <Ionicons name="film-outline" size={24} color={colors.onSurfaceVariant} />
              <Text
                style={[
                  styles.emptyEpisodesText,
                  { color: colors.onSurfaceVariant, ...typography.bodyMd },
                ]}
              >
                No episode details available for this season.
              </Text>
            </View>
          ) : (
            episodes.map((ep) => {
              const epNum = ep.episodeNumber;
              const isLoadingStream = Boolean(loadingEpisodes[epNum]);
              const sources = episodeSources[epNum] || [];
              const isExpanded = Boolean(expandedEpisodeSources[epNum]);
              const isOverviewExpanded = Boolean(expandedOverview[epNum]);
              const formattedDate = formatAirDate(ep.airDate);
              const metaTokens = [
                formattedDate,
                ep.runtimeMinutes ? `${ep.runtimeMinutes}m` : null,
                ep.rating ? `★ ${ep.rating}` : null,
              ].filter(Boolean);

              return (
                <View key={ep.id || epNum} style={styles.episodeCard}>
                  {/* Top: Still + Metadata */}
                  <View style={styles.episodeRow}>
                    {ep.stillUrl ? (
                      <ExpoImage
                        source={{ uri: ep.stillUrl }}
                        style={styles.episodeStill}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={styles.episodePlaceholder}>
                        <Ionicons name="film-outline" size={20} color={colors.onSurfaceVariant} />
                      </View>
                    )}

                    <View style={styles.episodeBody}>
                      <Text style={[styles.episodeNumTag, { color: GOLD_ACCENT }]}>
                        EPISODE {String(epNum).padStart(2, '0')}
                      </Text>
                      <Text
                        style={[
                          styles.episodeTitle,
                          { color: colors.onSurface, ...typography.titleSm },
                        ]}
                        numberOfLines={2}
                      >
                        {ep.name}
                      </Text>
                      {metaTokens.length > 0 && (
                        <Text
                          style={[
                            styles.episodeMeta,
                            { color: colors.onSurfaceVariant, ...typography.labelSm },
                          ]}
                        >
                          {metaTokens.join(' · ')}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Synopsis */}
                  {ep.overview ? (
                    <View style={styles.episodeOverviewContainer}>
                      <Text
                        style={[
                          styles.episodeOverviewText,
                          { color: colors.onSurfaceVariant, ...typography.bodySm },
                        ]}
                        numberOfLines={isOverviewExpanded ? 0 : 2}
                      >
                        {ep.overview}
                      </Text>
                      {ep.overview.length > 100 && (
                        <TouchableOpacity
                          onPress={() =>
                            setExpandedOverview((prev) => ({
                              ...prev,
                              [epNum]: !prev[epNum],
                            }))
                          }
                          style={styles.moreBtn}
                        >
                          <Text style={[styles.moreBtnText, { color: GOLD_ACCENT }]}>
                            {isOverviewExpanded ? 'Less' : 'More'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}

                  {/* Action Row: Stream Episode Button */}
                  <View style={styles.episodeActionRow}>
                    <TouchableOpacity
                      style={styles.streamEpisodeButton}
                      onPress={() => handleStreamEpisode(ep)}
                      activeOpacity={0.7}
                    >
                      {isLoadingStream ? (
                        <ActivityIndicator size="small" color={GOLD_ACCENT} />
                      ) : (
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'play'}
                          size={14}
                          color={GOLD_ACCENT}
                        />
                      )}
                      <Text
                        style={[
                          styles.streamEpisodeButtonText,
                          { color: GOLD_ACCENT, ...typography.labelMd },
                        ]}
                      >
                        {isLoadingStream
                          ? 'Searching Swarms...'
                          : isExpanded
                          ? 'Hide Sources'
                          : 'Play Episode'}
                      </Text>
                      {sources.length > 0 && !isExpanded && (
                        <Text
                          style={[
                            styles.sourceCountBadge,
                            { color: colors.onSurfaceVariant, ...typography.labelSm },
                          ]}
                        >
                          {sources.length} sources
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Expanded Stream Sources Drawer */}
                  {isExpanded && (
                    <View style={styles.episodeSourcesDrawer}>
                      {!sources.length ? (
                        <Text
                          style={[
                            styles.emptySourcesText,
                            { color: colors.onSurfaceVariant, ...typography.labelSm },
                          ]}
                        >
                          No active sources found for this episode.
                        </Text>
                      ) : (
                        sources.slice(0, 4).map((source) => (
                          <View
                            key={source.infoHash}
                            style={styles.sourceItem}
                          >
                            <View style={styles.sourceMetaRow}>
                              <Text
                                style={[
                                  styles.sourceName,
                                  { color: colors.onSurface, ...typography.bodySm },
                                ]}
                                numberOfLines={2}
                              >
                                {source.name}
                              </Text>
                              <View style={styles.badgeRow}>
                                <Text
                                  style={[
                                    styles.qualityBadge,
                                    { color: GOLD_ACCENT, ...typography.labelSm },
                                  ]}
                                >
                                  {source.attributes?.resolution}
                                </Text>
                                {source.attributes?.codec && (
                                  <Text
                                    style={[
                                      styles.attrBadge,
                                      { color: colors.onSurfaceVariant, ...typography.labelSm },
                                    ]}
                                  >
                                    {source.attributes.codec}
                                  </Text>
                                )}
                                <Text
                                  style={[
                                    styles.seedBadge,
                                    {
                                      color: source.seeders >= 50 ? '#4CAF50' : '#E5A93C',
                                      ...typography.labelSm,
                                    },
                                  ]}
                                >
                                  {source.seeders} seeds
                                </Text>
                                <Text
                                  style={[
                                    styles.sizeBadge,
                                    { color: colors.onSurfaceVariant, ...typography.labelSm },
                                  ]}
                                >
                                  {source.formattedSize}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.sourceActionsRow}>
                              <TouchableOpacity
                                style={styles.streamPrimaryBtn}
                                onPress={() => handleLaunchStream(source.magnetUrl, source.name, source.fileIdx, item.episodeNumber)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="play" size={13} color={GOLD_ACCENT} />
                                <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                                  Play
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })
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
    marginBottom: 16,
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
  seasonPackContainer: {
    marginBottom: 16,
  },
  seasonPackHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  seasonPackTextCol: {
    flex: 1,
  },
  seasonPackTitle: {
    fontWeight: '700',
  },
  seasonPackSubtitle: {
    marginTop: 2,
  },
  seasonPackDrawer: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  synopsisBlock: {
    marginBottom: 20,
  },
  overview: {
    fontWeight: '400',
    lineHeight: 24,
  },
  sectionHeaderRow: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  episodesContainer: {
    gap: 20,
    paddingBottom: 40,
  },
  loaderCenter: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
  },
  loaderText: {
    fontWeight: '500',
  },
  emptyEpisodes: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
  },
  emptyEpisodesText: {
    textAlign: 'center',
  },
  episodeCard: {
    paddingBottom: 16,
  },
  episodeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  episodeStill: {
    aspectRatio: 16 / 9,
    borderRadius: 8,
    width: 120,
  },
  episodePlaceholder: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    justifyContent: 'center',
    width: 120,
  },
  episodeBody: {
    flex: 1,
    gap: 3,
  },
  episodeNumTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  episodeTitle: {
    fontWeight: '700',
    lineHeight: 20,
  },
  episodeMeta: {
    fontWeight: '500',
    marginTop: 2,
  },
  episodeOverviewContainer: {
    marginTop: 8,
  },
  episodeOverviewText: {
    fontWeight: '400',
    lineHeight: 20,
  },
  moreBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  moreBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  episodeActionRow: {
    marginTop: 8,
  },
  streamEpisodeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  streamEpisodeButtonText: {
    fontWeight: '700',
  },
  sourceCountBadge: {
    marginLeft: 6,
  },
  episodeSourcesDrawer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginTop: 6,
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  emptySourcesText: {
    paddingVertical: 10,
    textAlign: 'center',
  },
  sourceItem: {
    gap: 8,
    paddingVertical: 8,
  },
  sourceMetaRow: {
    gap: 4,
  },
  sourceName: {
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
  sourceActionsRow: {
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
});
