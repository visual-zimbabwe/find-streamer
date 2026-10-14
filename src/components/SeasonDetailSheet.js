import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import * as IntentLauncher from 'expo-intent-launcher';
import * as ScreenOrientation from 'expo-screen-orientation';
import { toastiva } from 'toastiva';
import { serviceLabelsForRow } from '../lib/providerAvailability';
import { loadWhereToWatchPrefs } from '../lib/whereToWatch';
import { GOLD_ACCENT } from '../theme/programme';
import { MediaArtwork } from './MediaArtwork';
import { ProgrammeEyebrowLabel } from './ProgrammeSectionHeader';
import { fetchSeasonEpisodes } from '../lib/tmdb';
import {
  searchEpisodeTorrents,
  searchSeasonPackTorrents,
} from '../lib/torrentSearchEngine';

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
 * stream source resolution, complete Season Pack binge mode, and streaming
 * provider availability.
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
  const [activeTab, setActiveTab] = useState('episodes'); // 'episodes' | 'availability'
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

  const rows = useMemo(() => season?.availabilityRows || null, [season]);
  const providerSummary = useMemo(() => season?.providerSummary || [], [season]);

  const homeRow = useMemo(
    () => (homeCountry && rows ? rows.find((row) => row.code === homeCountry.code) : null),
    [rows, homeCountry],
  );

  const topSeasonPack = seasonPacks[0] || null;

  // Stream launch helper (auto opens mpv.android with auto-play in landscape)
  const handleLaunchStream = useCallback(async (magnetUrl, releaseName) => {
    Haptics.selectionAsync();

    // On Android, stream through local embedded engine directly into mpv in landscape
    if (Platform.OS === 'android') {
      const streamUrl = `http://127.0.0.1:8899/stream?magnet=${encodeURIComponent(magnetUrl)}`;

      // Prime swarm metadata in background
      try {
        fetch(`http://127.0.0.1:8899/preload?magnet=${encodeURIComponent(magnetUrl)}`).catch(() => {});
      } catch {
        // Preload is opportunistic
      }

      // Lock orientation to LANDSCAPE prior to launching the player
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (orientErr) {
        console.log('[handleLaunchStream] Orientation lock error:', orientErr);
      }

      toastiva.info('Streaming in mpv (Landscape)...');

      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: streamUrl,
          type: 'video/*',
          packageName: 'is.xyz.mpv',
          className: 'is.xyz.mpv.MPVActivity',
          extra: {
            title: releaseName || 'Trova Stream',
          },
        });
        return;
      } catch (mpvError) {
        console.log('[handleLaunchStream] MPVActivity direct launch failed, attempting generic video viewer:', mpvError);
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: streamUrl,
            type: 'video/*',
            extra: {
              title: releaseName || 'Trova Stream',
            },
          });
          return;
        } catch (genericError) {
          console.log('[handleLaunchStream] Generic video player launch failed:', genericError);
          // Fallback to launching the mpv app or system magnet
          try {
            IntentLauncher.openApplication('is.xyz.mpv');
            return;
          } catch {
            // Fall through to system magnet handler
          }
        }
      } finally {
        // Restore portrait orientation upon returning to Trova
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch {
          // Ignored
        }
      }
    }

    // Fallback: try default system magnet handler
    try {
      const supported = await Linking.canOpenURL(magnetUrl);
      if (supported) {
        await Linking.openURL(magnetUrl);
        return;
      }
    } catch {
      // Ignored - fall through to toast
    }

    toastiva.info('Unable to launch video player');
  }, []);

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
          toastiva.info(`No peer streams found for Episode ${epNum}`);
        }
      } catch {
        toastiva.info(`Unable to query streams for Episode ${epNum}`);
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
                : 'Stream complete season in one continuous playlist'}
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
                      onPress={() => handleLaunchStream(pack.magnetUrl, pack.name)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="play" size={13} color={GOLD_ACCENT} />
                      <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                        Stream Season
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

      {/* Navigation Tabs: Episodes vs Where to Watch */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'episodes' && styles.tabButtonActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('episodes');
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'episodes' ? GOLD_ACCENT : colors.onSurfaceVariant,
                fontWeight: activeTab === 'episodes' ? '800' : '600',
                ...typography.labelMd,
              },
            ]}
          >
            Episodes {episodes.length ? `(${episodes.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'availability' && styles.tabButtonActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('availability');
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'availability' ? GOLD_ACCENT : colors.onSurfaceVariant,
                ...typography.labelMd,
              },
            ]}
          >
            Where To Watch
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content: EPISODES */}
      {activeTab === 'episodes' && (
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
                          ? 'Hide Stream Sources'
                          : 'Stream Episode'}
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
                          No active streams found for this episode.
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
                                onPress={() => handleLaunchStream(source.magnetUrl, source.name)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="play" size={13} color={GOLD_ACCENT} />
                                <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                                  Stream
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
      )}

      {/* Tab Content: WHERE TO WATCH (Original Availability Table) */}
      {activeTab === 'availability' && (
        <View style={styles.block}>
          <ProgrammeEyebrowLabel eyebrow="Where To Watch This Season" />

          {!rows ? (
            <View style={styles.fallbackRow}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.fallbackText,
                  { color: colors.onSurfaceVariant, ...typography.labelSm },
                ]}
              >
                Season-by-season availability isn&apos;t available for this show — see Where To
                Watch for the series-wide answer.
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
                  style={styles.homeStatus}
                  accessible
                  accessibilityLabel={`In your country, ${homeCountry.label}: ${
                    homeRow
                      ? serviceLabelsForRow(homeRow).join(', ')
                      : 'this season is not free to stream'
                  }`}
                >
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
                {rows.map((row) => {
                  const isHome = homeCountry ? row.code === homeCountry.code : false;
                  const rowServices = serviceLabelsForRow(row);
                  return (
                    <View
                      key={row.code}
                      style={styles.tableRow}
                      accessible
                      accessibilityLabel={`${row.country}${
                        isHome ? ', your country' : ''
                      }: ${rowServices.join(', ')}`}
                    >
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
                                style={styles.serviceLogo}
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
      )}
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
  tabBar: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  tabButton: {
    paddingBottom: 4,
  },
  tabButtonActive: {},
  tabText: {
    letterSpacing: 0.4,
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
  block: {
    marginBottom: 28,
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
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 0,
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
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  tableRowHome: {},
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
