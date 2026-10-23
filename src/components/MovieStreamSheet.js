import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { GOLD_ACCENT } from '../theme/programme';
import { MediaArtwork } from './MediaArtwork';
import { searchMovieTorrents } from '../lib/torrentSearchEngine';
import { launchStream } from '../lib/streamLauncher';
import { useDownloads } from '../lib/downloadManager';
import { trovaToast as toastiva } from '../lib/trovaToast';

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
 * mpv playback, offline 75 GB storage downloads, and quality breakdowns.
 */
export function MovieStreamSheetContent({
  movieTitle,
  originalTitle,
  movieYear,
  tmdbId,
  imdbId,
  posterUrl,
  runtimeMinutes,
  genres,
  ratingValue,
  rows,
  providerSummary,
  colors,
  typography,
  onSizeChange,
}) {
  const [streams, setStreams] = useState([]);
  const [streamsLoading, setStreamsLoading] = useState(true);
  const [launchingStreamKey, setLaunchingStreamKey] = useState(null);
  const [showReleases, setShowReleases] = useState(false);

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

  const movieDownload = getForMedia({ imdbId, tmdbId });
  const hasDownload = Boolean(movieDownload);

  useEffect(() => {
    const nextSize = showReleases ? 'large' : hasDownload ? 'medium' : 'compact';
    onSizeChange?.(nextSize);
  }, [showReleases, hasDownload, onSizeChange]);

  // Fetch peer swarms for the movie
  useEffect(() => {
    let cancelled = false;
    if (movieTitle) {
      setStreamsLoading(true);
      searchMovieTorrents({
        title: movieTitle,
        originalTitle,
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
  }, [movieTitle, originalTitle, movieYear, imdbId]);

  const topStream = streams[0] || null;

  // Opportunistically warm up the top peer swarm while the sheet is open
  useEffect(() => {
    if (topStream?.magnetUrl && topStream.seeders > 0) {
      fetch(
        `http://127.0.0.1:8899/preload?magnet=${encodeURIComponent(topStream.magnetUrl)}`,
      ).catch(() => {});
    }
  }, [topStream?.magnetUrl, topStream?.seeders]);

  const handleLaunch = useCallback(
    async (magnetUrl, releaseName, fileIdx, seeders = 1, streamKey = 'autoplay') => {
      if (launchingStreamKey) return;
      Haptics.selectionAsync();
      if (seeders === 0) {
        toastiva.info('Warning: Swarm has 0 seeders. Buffering may fail.');
      }
      setLaunchingStreamKey(streamKey);
      try {
        await launchStream({
          magnetUrl,
          title: releaseName,
          mediaTitle: movieTitle,
          originalTitle,
          year: movieYear,
          tmdbId,
          fileIdx,
          imdbId,
        });
      } finally {
        setLaunchingStreamKey(null);
      }
    },
    [imdbId, launchingStreamKey, movieTitle, originalTitle, movieYear, tmdbId],
  );

  const handleStartDownload = useCallback(
    async (item) => {
      if (!item?.magnetUrl) return;
      Haptics.selectionAsync();
      await startDownload({
        magnet: item.magnetUrl,
        infoHash: item.infoHash,
        fileIdx: item.fileIdx,
        title: movieTitle,
        releaseName: item.name,
        mediaType: 'movie',
        tmdbId,
        imdbId,
        year: movieYear,
        posterUrl,
        quality: item.attributes?.resolution || '',
        codec: item.attributes?.codec || '',
      });
    },
    [startDownload, movieTitle, tmdbId, imdbId, movieYear, posterUrl],
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
              <Text style={[styles.ratingText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                {typeof ratingValue === 'number' ? ratingValue.toFixed(1) : String(ratingValue)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Pinned Offline Download Card (works 100% offline) */}
      {movieDownload ? (
        <View style={styles.downloadedSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, typography.labelMd, { color: GOLD_ACCENT }]}>
              {movieDownload.state === 'completed'
                ? 'Downloaded on Device'
                : movieDownload.state === 'paused'
                ? 'Download Paused'
                : movieDownload.state === 'error'
                ? 'Download Error'
                : 'Downloading to Device'}
            </Text>
            <Text style={[styles.storageText, typography.labelSm, { color: colors.onSurfaceVariant }]}>
              {formatBytes(usedBytes)} / 75 GB
            </Text>
          </View>

          <Text
            style={[styles.streamName, { color: colors.onSurface, ...typography.bodySm }]}
            numberOfLines={2}
          >
            {movieDownload.releaseName || movieDownload.title || movieTitle}
          </Text>

          <Text
            style={[styles.downloadStatusMeta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
            numberOfLines={2}
          >
            {movieDownload.state === 'completed'
              ? `${movieDownload.quality ? `${movieDownload.quality} · ` : ''}${formatBytes(
                  movieDownload.totalBytes || movieDownload.completedBytes,
                )} · Ready for offline playback`
              : movieDownload.state === 'error'
              ? movieDownload.error || 'Unable to complete download'
              : movieDownload.state === 'paused'
              ? `Paused at ${Math.round((movieDownload.progress || 0) * 100)}% · ${formatBytes(
                  movieDownload.completedBytes,
                )}${movieDownload.totalBytes > 0 ? ` / ${formatBytes(movieDownload.totalBytes)}` : ''}`
              : `${Math.round((movieDownload.progress || 0) * 100)}% · ${formatBytes(
                  movieDownload.completedBytes,
                )}${movieDownload.totalBytes > 0 ? ` / ${formatBytes(movieDownload.totalBytes)}` : ''}${
                  movieDownload.speedBps > 0
                    ? ` · ${formatSpeed(movieDownload.speedBps)}`
                    : ' · Connecting to peers...'
                }`}
          </Text>

          <View style={styles.streamActionsRow}>
            {(movieDownload.state === 'completed' || movieDownload.completedBytes > 0) && (
              <TouchableOpacity
                style={styles.streamPrimaryBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  playDownloaded(movieDownload);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                  {movieDownload.state === 'completed' ? 'Play Downloaded' : 'Play Now'}
                </Text>
              </TouchableOpacity>
            )}

            {(movieDownload.state === 'downloading' || movieDownload.state === 'resolving') && (
              <TouchableOpacity
                style={styles.streamSecondaryBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  pauseDownload(movieDownload.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.streamSecondaryText, { color: colors.onSurface, ...typography.labelSm }]}>
                  Pause
                </Text>
              </TouchableOpacity>
            )}

            {(movieDownload.state === 'paused' || movieDownload.state === 'error') && (
              <TouchableOpacity
                style={styles.streamPrimaryBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  resumeDownload(movieDownload.id, movieDownload.title || movieTitle);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                  Resume
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.streamSecondaryBtn}
              onPress={() => {
                Haptics.selectionAsync();
                deleteDownload(movieDownload.id);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.streamSecondaryText,
                  { color: colors.onSurfaceVariant, ...typography.labelSm },
                ]}
              >
                {movieDownload.state === 'completed' ? 'Delete Download' : 'Cancel Download'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Primary Stream Action */}
      <View style={styles.autoPlayContainer}>
        <TouchableOpacity
          style={styles.autoPlayHeader}
          onPress={() => {
            if (movieDownload?.state === 'completed') {
              Haptics.selectionAsync();
              playDownloaded(movieDownload);
              return;
            }
            if (!topStream) return;
            if (topStream.seeders === 0) {
              toastiva.info('No active peers found in swarm');
              return;
            }
            handleLaunch(
              topStream.magnetUrl,
              topStream.name,
              topStream.fileIdx,
              topStream.seeders,
              'autoplay',
            );
          }}
          activeOpacity={
            (topStream || movieDownload?.state === 'completed') && !launchingStreamKey ? 0.7 : 1
          }
          disabled={
            Boolean(launchingStreamKey) || (!topStream && movieDownload?.state !== 'completed')
          }
          accessibilityRole="button"
          accessibilityLabel={
            launchingStreamKey
              ? 'Starting stream and loading subtitles'
              : movieDownload?.state === 'completed'
              ? 'Play Downloaded in Landscape'
              : 'Play Best Stream in Landscape'
          }
        >
          <View style={styles.autoPlayTextCol}>
            <Text style={[styles.autoPlayTitle, { color: GOLD_ACCENT, ...typography.labelLg }]}>
              {launchingStreamKey === 'autoplay'
                ? 'Starting Stream...'
                : movieDownload?.state === 'completed'
                ? 'Play Downloaded'
                : topStream?.attributes?.resolution
                ? `Play Best Stream (${topStream.attributes.resolution})`
                : 'Play Best Stream'}
            </Text>
            <Text
              style={[
                styles.autoPlaySubtitle,
                { color: colors.onSurfaceVariant, ...typography.labelSm },
              ]}
              numberOfLines={1}
            >
              {launchingStreamKey === 'autoplay'
                ? 'Connecting to peer swarm & fetching subtitles...'
                : movieDownload?.state === 'completed'
                ? `${formatBytes(movieDownload.totalBytes || movieDownload.completedBytes)} · Stored on device`
                : streamsLoading
                ? 'Searching peer swarms for verified releases...'
                : !topStream
                ? 'No releases found'
                : topStream.seeders === 0
                ? 'No active seeders in peer swarm'
                : `Opens in landscape · ${topStream.formattedSize} · ${topStream.seeders} seeds`}
            </Text>
          </View>
          {(streamsLoading && movieDownload?.state !== 'completed') ||
          launchingStreamKey === 'autoplay' ? (
            <ActivityIndicator size="small" color={GOLD_ACCENT} />
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Collapsible Advanced Releases Toggle */}
      {!streamsLoading && streams.length > 0 ? (
        <TouchableOpacity
          style={styles.releasesToggleRow}
          onPress={() => {
            Haptics.selectionAsync();
            setShowReleases((prev) => !prev);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            showReleases
              ? `Hide available releases (${streams.length})`
              : `Choose another release (${streams.length})`
          }
        >
          <View style={styles.releasesToggleTextCol}>
            <Text
              style={[
                styles.sectionTitle,
                typography.labelMd,
                { color: showReleases ? GOLD_ACCENT : colors.onSurface },
              ]}
            >
              {`Choose Another Release (${streams.length})`}
            </Text>
            <Text
              style={[styles.storageText, typography.labelSm, { color: colors.onSurfaceVariant }]}
              numberOfLines={1}
            >
              {`All qualities & offline downloads · ${formatBytes(usedBytes)} / 75 GB used`}
            </Text>
          </View>
          <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            {showReleases ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Streams List */}
      {!streamsLoading && !streams.length ? (
        <View style={styles.emptyStreams}>
          <Text
            style={[
              styles.emptyStreamsText,
              { color: colors.onSurfaceVariant, ...typography.bodyMd },
            ]}
          >
            No releases found for this movie.
          </Text>
        </View>
      ) : showReleases ? (
        <View style={styles.streamsContainer}>
          {streams.map((item) => {
            const itemDownload = getForMedia({
              infoHash: item.infoHash,
              fileIdx: item.fileIdx,
            });
            const isItemCompleted = itemDownload?.state === 'completed';
            const isItemActive =
              itemDownload?.state === 'downloading' || itemDownload?.state === 'resolving';
            const isItemPaused = itemDownload?.state === 'paused';

            return (
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
                    {item.attributes?.audioBadge && (
                      <View
                        style={[
                          styles.langBadgeWrap,
                          {
                            backgroundColor: item.attributes.audioBadge.isDub
                              ? (colors.error || '#CF6679') + '22'
                              : GOLD_ACCENT + '20',
                            borderColor: item.attributes.audioBadge.isDub
                              ? (colors.error || '#CF6679') + '55'
                              : GOLD_ACCENT + '55',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.langBadgeText,
                            {
                              color: item.attributes.audioBadge.isDub
                                ? colors.error || '#CF6679'
                                : GOLD_ACCENT,
                              ...typography.labelSm,
                            },
                          ]}
                        >
                          {item.attributes.audioBadge.text}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.seedBadge,
                        {
                          color:
                            item.seeders >= 20
                              ? '#4CAF50'
                              : item.seeders > 0
                              ? '#E5A93C'
                              : colors.onSurfaceVariant,
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
                    onPress={() => {
                      if (isItemCompleted) {
                        Haptics.selectionAsync();
                        playDownloaded(itemDownload);
                      } else {
                        handleLaunch(
                          item.magnetUrl,
                          item.name,
                          item.fileIdx,
                          item.seeders,
                          item.infoHash || item.magnetUrl,
                        );
                      }
                    }}
                    disabled={Boolean(launchingStreamKey)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.streamPrimaryText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                      {launchingStreamKey === (item.infoHash || item.magnetUrl)
                        ? 'Starting...'
                        : isItemCompleted
                        ? 'Play Downloaded'
                        : 'Play Now'}
                    </Text>
                  </TouchableOpacity>

                  {isItemCompleted ? (
                    <TouchableOpacity
                      style={styles.streamSecondaryBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        deleteDownload(itemDownload.id);
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
                  ) : isItemActive ? (
                    <>
                      <TouchableOpacity
                        style={styles.streamSecondaryBtn}
                        onPress={() => {
                          Haptics.selectionAsync();
                          pauseDownload(itemDownload.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.streamSecondaryText,
                            { color: GOLD_ACCENT, ...typography.labelSm },
                          ]}
                        >
                          {`Downloading ${Math.round((itemDownload.progress || 0) * 100)}% · Pause`}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.streamSecondaryBtn}
                        onPress={() => {
                          Haptics.selectionAsync();
                          deleteDownload(itemDownload.id);
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
                  ) : isItemPaused ? (
                    <>
                      <TouchableOpacity
                        style={styles.streamSecondaryBtn}
                        onPress={() => {
                          Haptics.selectionAsync();
                          resumeDownload(itemDownload.id, movieTitle);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.streamSecondaryText,
                            { color: GOLD_ACCENT, ...typography.labelSm },
                          ]}
                        >
                          {`Resume (${Math.round((itemDownload.progress || 0) * 100)}%)`}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.streamSecondaryBtn}
                        onPress={() => {
                          Haptics.selectionAsync();
                          deleteDownload(itemDownload.id);
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
                      onPress={() => handleStartDownload(item)}
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
          })}
        </View>
      ) : null}
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
    marginBottom: 14,
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
  downloadedSection: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    gap: 4,
    marginBottom: 18,
    paddingHorizontal: 0,
  },
  downloadStatusMeta: {
    fontWeight: '500',
    marginTop: 2,
  },
  autoPlayContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginBottom: 12,
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
  sectionHeaderRow: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  releasesToggleRow: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 6,
  },
  releasesToggleTextCol: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  storageText: {
    fontWeight: '500',
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
  langBadgeWrap: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeText: {
    fontWeight: '700',
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
