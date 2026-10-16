import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { useDownloads } from '../lib/downloadManager';

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
 * playback source resolution, offline 75 GB storage downloads, and complete Season Pack binge mode.
 */
export function SeasonDetailSheetContent({
  season,
  seriesTitle,
  seriesTmdbId,
  imdbId,
  seriesYear,
  seriesPosterUrl,
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

  const {
    usedBytes,
    startDownload,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    playDownloaded,
    getForMedia,
    formatBytes,
    formatSpeed,
  } = useDownloads();

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

  const handleStartEpisodeDownload = useCallback(
    async (source, ep) => {
      if (!source?.magnetUrl) return;
      Haptics.selectionAsync();
      const epNum = ep?.episodeNumber || 0;
      await startDownload({
        magnet: source.magnetUrl,
        infoHash: source.infoHash,
        fileIdx: source.fileIdx,
        title: seriesTitle,
        releaseName: source.name,
        mediaType: 'tv',
        tmdbId: seriesTmdbId,
        imdbId,
        year: season?.year || seriesYear,
        posterUrl: season?.posterUrl || seriesPosterUrl || ep?.stillUrl || '',
        season: season?.seasonNumber || 0,
        episode: epNum,
        episodeTitle: ep?.name || '',
        quality: source.attributes?.resolution || '',
        codec: source.attributes?.codec || '',
      });
    },
    [
      startDownload,
      seriesTitle,
      seriesTmdbId,
      imdbId,
      season?.year,
      season?.posterUrl,
      season?.seasonNumber,
      seriesYear,
      seriesPosterUrl,
    ],
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
            <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
              {showSeasonPackDrawer ? 'Hide' : 'Show'}
            </Text>
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
              seasonPacks.slice(0, 3).map((pack) => {
                const packDownload = getForMedia({
                  infoHash: pack.infoHash,
                  fileIdx: pack.fileIdx,
                });
                const isPackCompleted = packDownload?.state === 'completed';
                const isPackActive =
                  packDownload?.state === 'downloading' || packDownload?.state === 'resolving';

                return (
                  <View key={pack.infoHash} style={styles.sourceItem}>
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
                        onPress={() => {
                          if (isPackCompleted) {
                            Haptics.selectionAsync();
                            playDownloaded(packDownload);
                          } else {
                            handleLaunchStream(pack.magnetUrl, pack.name, pack.fileIdx);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                          {isPackCompleted ? 'Play Downloaded' : 'Play Season'}
                        </Text>
                      </TouchableOpacity>

                      {isPackCompleted ? (
                        <TouchableOpacity
                          style={styles.streamSecondaryBtn}
                          onPress={() => {
                            Haptics.selectionAsync();
                            deleteDownload(packDownload.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.streamSecondaryText,
                              { color: colors.onSurfaceVariant, ...typography.labelSm },
                            ]}
                          >
                            Delete Download
                          </Text>
                        </TouchableOpacity>
                      ) : isPackActive ? (
                        <>
                          <TouchableOpacity
                            style={styles.streamSecondaryBtn}
                            onPress={() => {
                              Haptics.selectionAsync();
                              pauseDownload(packDownload.id);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.streamSecondaryText,
                                { color: GOLD_ACCENT, ...typography.labelSm },
                              ]}
                            >
                              {`Downloading ${Math.round((packDownload.progress || 0) * 100)}% · Pause`}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.streamSecondaryBtn}
                            onPress={() => {
                              Haptics.selectionAsync();
                              deleteDownload(packDownload.id);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.streamSecondaryText,
                                { color: colors.onSurfaceVariant, ...typography.labelSm },
                              ]}
                            >
                              Cancel
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={styles.streamSecondaryBtn}
                          onPress={() => handleStartEpisodeDownload(pack, null)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.streamSecondaryText,
                              { color: colors.onSurface, ...typography.labelSm },
                            ]}
                          >
                            Download
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
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
        <Text style={[styles.storageText, typography.labelSm, { color: colors.onSurfaceVariant }]}>
          {formatBytes(usedBytes)} / 75 GB used
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
              ep.rating ? `${ep.rating}/10` : null,
            ].filter(Boolean);

            const epDownload = getForMedia({
              imdbId,
              tmdbId: seriesTmdbId,
              season: season.seasonNumber,
              episode: epNum,
            });
            const isEpCompleted = epDownload?.state === 'completed';
            const isEpActive =
              epDownload?.state === 'downloading' || epDownload?.state === 'resolving';
            const isEpPaused = epDownload?.state === 'paused' || epDownload?.state === 'error';

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
                      <Text style={{ color: colors.onSurfaceVariant, ...typography.labelSm }}>
                        {`EP ${String(epNum).padStart(2, '0')}`}
                      </Text>
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

                {/* Episode Download Status Banner (if downloaded or downloading) */}
                {epDownload ? (
                  <Text
                    style={[
                      styles.episodeDownloadStatus,
                      { color: isEpCompleted ? GOLD_ACCENT : colors.onSurfaceVariant, ...typography.labelSm },
                    ]}
                    numberOfLines={1}
                  >
                    {isEpCompleted
                      ? `Downloaded on device · ${formatBytes(
                          epDownload.totalBytes || epDownload.completedBytes,
                        )} · Ready offline`
                      : isEpActive
                      ? `Downloading ${Math.round((epDownload.progress || 0) * 100)}% · ${formatBytes(
                          epDownload.completedBytes,
                        )}${epDownload.totalBytes > 0 ? ` / ${formatBytes(epDownload.totalBytes)}` : ''}${
                          epDownload.speedBps > 0 ? ` · ${formatSpeed(epDownload.speedBps)}` : ''
                        }`
                      : epDownload.state === 'error'
                      ? epDownload.error || 'Download failed'
                      : `Paused at ${Math.round((epDownload.progress || 0) * 100)}% · ${formatBytes(
                          epDownload.completedBytes,
                        )}`}
                  </Text>
                ) : null}

                {/* Action Row: Play Downloaded / Stream Episode / Delete */}
                <View style={styles.episodeActionRow}>
                  {isEpCompleted && (
                    <TouchableOpacity
                      style={styles.streamEpisodeButton}
                      onPress={() => {
                        Haptics.selectionAsync();
                        playDownloaded(epDownload);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.streamEpisodeButtonText,
                          { color: GOLD_ACCENT, ...typography.labelMd },
                        ]}
                      >
                        Play Downloaded
                      </Text>
                    </TouchableOpacity>
                  )}

                  {isEpActive && (
                    <TouchableOpacity
                      style={styles.streamEpisodeButton}
                      onPress={() => {
                        Haptics.selectionAsync();
                        pauseDownload(epDownload.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.streamEpisodeButtonText,
                          { color: colors.onSurface, ...typography.labelMd },
                        ]}
                      >
                        Pause
                      </Text>
                    </TouchableOpacity>
                  )}

                  {isEpPaused && (
                    <TouchableOpacity
                      style={styles.streamEpisodeButton}
                      onPress={() => {
                        Haptics.selectionAsync();
                        resumeDownload(epDownload.id, `${seriesTitle} S${season.seasonNumber}E${epNum}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.streamEpisodeButtonText,
                          { color: GOLD_ACCENT, ...typography.labelMd },
                        ]}
                      >
                        Resume
                      </Text>
                    </TouchableOpacity>
                  )}

                  {epDownload && (
                    <TouchableOpacity
                      style={styles.streamEpisodeButton}
                      onPress={() => {
                        Haptics.selectionAsync();
                        deleteDownload(epDownload.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.streamEpisodeButtonText,
                          { color: colors.onSurfaceVariant, ...typography.labelMd },
                        ]}
                      >
                        {isEpCompleted ? 'Delete Download' : 'Cancel Download'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.streamEpisodeButton}
                    onPress={() => handleStreamEpisode(ep)}
                    activeOpacity={0.7}
                  >
                    {isLoadingStream ? (
                      <ActivityIndicator size="small" color={GOLD_ACCENT} />
                    ) : null}
                    <Text
                      style={[
                        styles.streamEpisodeButtonText,
                        {
                          color: isEpCompleted ? colors.onSurface : GOLD_ACCENT,
                          ...typography.labelMd,
                        },
                      ]}
                    >
                      {isLoadingStream
                        ? 'Searching Swarms...'
                        : isExpanded
                        ? 'Hide Sources'
                        : isEpCompleted
                        ? 'Other Sources'
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
                      sources.slice(0, 4).map((source) => {
                        const srcDownload = getForMedia({
                          infoHash: source.infoHash,
                          season: season.seasonNumber,
                          episode: epNum,
                        });
                        const isSrcCompleted = srcDownload?.state === 'completed';
                        const isSrcActive =
                          srcDownload?.state === 'downloading' || srcDownload?.state === 'resolving';
                        const isSrcPaused = srcDownload?.state === 'paused';

                        return (
                          <View key={source.infoHash} style={styles.sourceItem}>
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
                                onPress={() => {
                                  if (isSrcCompleted) {
                                    Haptics.selectionAsync();
                                    playDownloaded(srcDownload);
                                  } else {
                                    handleLaunchStream(
                                      source.magnetUrl,
                                      source.name,
                                      source.fileIdx,
                                      epNum,
                                    );
                                  }
                                }}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.streamPrimaryText,
                                    { color: GOLD_ACCENT, ...typography.labelSm },
                                  ]}
                                >
                                  {isSrcCompleted ? 'Play Downloaded' : 'Play'}
                                </Text>
                              </TouchableOpacity>

                              {isSrcCompleted ? (
                                <TouchableOpacity
                                  style={styles.streamSecondaryBtn}
                                  onPress={() => {
                                    Haptics.selectionAsync();
                                    deleteDownload(srcDownload.id);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.streamSecondaryText,
                                      { color: colors.onSurfaceVariant, ...typography.labelSm },
                                    ]}
                                  >
                                    Delete Download
                                  </Text>
                                </TouchableOpacity>
                              ) : isSrcActive ? (
                                <>
                                  <TouchableOpacity
                                    style={styles.streamSecondaryBtn}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      pauseDownload(srcDownload.id);
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text
                                      style={[
                                        styles.streamSecondaryText,
                                        { color: GOLD_ACCENT, ...typography.labelSm },
                                      ]}
                                    >
                                      {`Downloading ${Math.round((srcDownload.progress || 0) * 100)}% · Pause`}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.streamSecondaryBtn}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      deleteDownload(srcDownload.id);
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text
                                      style={[
                                        styles.streamSecondaryText,
                                        { color: colors.onSurfaceVariant, ...typography.labelSm },
                                      ]}
                                    >
                                      Cancel
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              ) : isSrcPaused ? (
                                <>
                                  <TouchableOpacity
                                    style={styles.streamSecondaryBtn}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      resumeDownload(
                                        srcDownload.id,
                                        `${seriesTitle} S${season.seasonNumber}E${epNum}`,
                                      );
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text
                                      style={[
                                        styles.streamSecondaryText,
                                        { color: GOLD_ACCENT, ...typography.labelSm },
                                      ]}
                                    >
                                      {`Resume (${Math.round((srcDownload.progress || 0) * 100)}%)`}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.streamSecondaryBtn}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      deleteDownload(srcDownload.id);
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text
                                      style={[
                                        styles.streamSecondaryText,
                                        { color: colors.onSurfaceVariant, ...typography.labelSm },
                                      ]}
                                    >
                                      Delete
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <TouchableOpacity
                                  style={styles.streamSecondaryBtn}
                                  onPress={() => handleStartEpisodeDownload(source, ep)}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.streamSecondaryText,
                                      { color: colors.onSurface, ...typography.labelSm },
                                    ]}
                                  >
                                    Download
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })
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
    backgroundColor: 'transparent',
    borderWidth: 0,
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
    backgroundColor: 'transparent',
    borderWidth: 0,
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
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  storageText: {
    fontWeight: '500',
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
  episodeDownloadStatus: {
    fontWeight: '600',
    marginTop: 6,
  },
  episodeActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
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
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 2,
  },
  streamPrimaryBtn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  streamPrimaryText: {
    color: GOLD_ACCENT,
    fontWeight: '700',
  },
  streamSecondaryBtn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  streamSecondaryText: {
    fontWeight: '700',
  },
});
