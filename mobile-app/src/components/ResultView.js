import React, { Fragment, useRef, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, Image, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as ExpoSharing from 'expo-sharing';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { ShareCard } from './ShareCard';
import { ShareOptionsSheet } from './ShareOptionsSheet';

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count || 0} ${(count || 0) === 1 ? singular : plural}`;
}

function formatRuntime(minutes, mediaType) {
  if (!minutes) return mediaType === 'tv' ? 'Episode length N/A' : 'Runtime N/A';
  if (mediaType === 'tv') return `${minutes}m episodes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function ResultView({ result, onBack, onToggleWatchlist, isInWatchlist, onSelectSimilar, onPersonPress }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const shareCardRef = useRef(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareCountries, setShareCountries] = useState(null);

  const doCapture = useCallback(async () => {
    if (!shareCardRef.current) return;
    try {
      const uri = await shareCardRef.current.capture();
      const canShare = await ExpoSharing.isAvailableAsync();
      if (canShare) {
        await ExpoSharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Check out ${result?.title}`,
          UTI: 'public.png',
        });
      } else {
        await Share.share({
          message: `Check out "${result?.title}" (${result?.year}) – ${result?.genres || 'Unknown Genre'}`,
        });
      }
    } catch (err) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Share failed', 'Unable to generate the share card. Please try again.');
      }
    }
  }, [result]);

  const handleShareConfirm = useCallback(async (selectedCountries) => {
    setShareSheetVisible(false);
    setShareCountries(selectedCountries);
    // Wait one frame for ShareCard to re-render with the new countries.
    await new Promise(resolve => setTimeout(resolve, 120));
    await doCapture();
  }, [doCapture]);

  if (!result) return null;

  const isTv = result.mediaType === 'tv';
  const seasonCount = result.numberOfSeasons || result.seasons?.length || 0;
  const episodeCount = result.numberOfEpisodes || 0;
  const hasSeasonDetails = isTv && (seasonCount > 0 || episodeCount > 0 || result.seasons?.length > 0);

  return (
    <>
    {/* Off-screen share card – captured by ViewShot, never visible to the user */}
    <ViewShot
      ref={shareCardRef}
      options={{ format: 'png', quality: 1 }}
      style={styles.offScreen}
    >
      <ShareCard result={result} selectedCountries={shareCountries} />
    </ViewShot>

    <ShareOptionsSheet
      visible={shareSheetVisible}
      result={result}
      onClose={() => setShareSheetVisible(false)}
      onShare={handleShareConfirm}
    />

    <ScrollView style={styles.container}>
      <View style={styles.heroSection}>
        <MediaArtwork
          uri={result.backdropUrl || result.posterUrl}
          style={styles.backdrop}
          resizeMode="cover"
          accessibilityLabel={`${result.title} artwork`}
        />
        <View style={styles.scrim} />
        
        <View style={styles.heroContent}>
          <View style={styles.metaRow}>
            <View style={[styles.genreBadge, { backgroundColor: colors.primary + '33' }]}>
              <Text style={[styles.genreText, { color: colors.primary, ...typography.labelSm }]}>{result.genres || 'Unknown Genre'}</Text>
            </View>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={colors.primary} />
              <Text style={[styles.ratingText, { color: colors.onSurface, ...typography.labelSm }]}>{result.rating}</Text>
            </View>
          </View>
          
          <Text style={[styles.title, { color: colors.onSurface, ...typography.displayLg }]}>{result.title}</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoPill}>
              <Ionicons name="calendar-outline" size={14} color={colors.onSurfaceVariant} />
              <Text style={[styles.infoText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>{result.year}</Text>
            </View>
            <View style={styles.infoPill}>
              <Ionicons name={isTv ? 'tv-outline' : 'time-outline'} size={14} color={colors.onSurfaceVariant} />
              <Text style={[styles.infoText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                {isTv ? pluralize(seasonCount, 'season') : formatRuntime(result.runtimeMinutes, result.mediaType)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.detailsContent}>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
              {isTv ? 'CREATED BY' : 'DIRECTOR'}
            </Text>
            {isTv ? (
              result.createdByPersons && result.createdByPersons.length > 0 ? (
                <View style={styles.personLinkRow}>
                  {result.createdByPersons.map((person, idx) => (
                    <React.Fragment key={person.id}>
                      <TouchableOpacity
                        onPress={() => onPersonPress?.(person.id, person.name, 'tv')}
                        accessibilityRole="button"
                        accessibilityLabel={`View shows created by ${person.name}`}
                      >
                        <Text style={[styles.metaText, styles.personLink, { color: colors.primary, ...typography.bodyMd }]}>
                          {person.name}
                        </Text>
                      </TouchableOpacity>
                      {idx < result.createdByPersons.length - 1 && (
                        <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]}>{', '}</Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]}>{result.createdBy}</Text>
              )
            ) : (
              result.directorId ? (
                <TouchableOpacity
                  onPress={() => onPersonPress?.(result.directorId, result.director, 'movie')}
                  accessibilityRole="button"
                  accessibilityLabel={`View films directed by ${result.director}`}
                >
                  <Text style={[styles.metaText, styles.personLink, { color: colors.primary, ...typography.bodyMd }]}>
                    {result.director}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]}>{result.director}</Text>
              )
            )}
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>STARRING</Text>
            {result.starringPersons && result.starringPersons.length > 0 ? (
              <View style={styles.personLinkRow}>
                {result.starringPersons.map((person, idx) => (
                  <React.Fragment key={person.id}>
                    <TouchableOpacity
                      onPress={() => onPersonPress?.(person.id, person.name, 'cast')}
                      accessibilityRole="button"
                      accessibilityLabel={`View filmography for ${person.name}`}
                    >
                      <Text style={[styles.metaText, styles.personLink, { color: colors.primary, ...typography.bodyMd }]}>
                        {person.name}
                      </Text>
                    </TouchableOpacity>
                    {idx < result.starringPersons.length - 1 && (
                      <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]}>{', '}</Text>
                    )}
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={2}>
                {result.starring}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>SYNOPSIS</Text>
          <Text style={[styles.synopsis, { color: colors.onSurface, ...typography.bodyLg }]}>
            {result.synopsis}
          </Text>
        </View>

        {/* ─── Ratings ─────────────────────────────────────────────────── */}
        {result.omdbRatings && (result.omdbRatings.imdbRating || result.omdbRatings.rottenTomatoes || result.omdbRatings.metascore) && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>RATINGS</Text>
            <View style={styles.ratingsRow}>
              {result.omdbRatings.imdbRating && (
                <View style={[styles.ratingBadge, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '26' }]}>
                  <Text style={styles.ratingBadgeIcon}>⭐</Text>
                  <View>
                    <Text style={[styles.ratingBadgeLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>IMDb</Text>
                    <Text style={[styles.ratingBadgeValue, { color: colors.onSurface, ...typography.titleLg }]}>{result.omdbRatings.imdbRating}</Text>
                  </View>
                </View>
              )}
              {result.omdbRatings.rottenTomatoes && (
                <View style={[styles.ratingBadge, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '26' }]}>
                  <Text style={styles.ratingBadgeIcon}>🍅</Text>
                  <View>
                    <Text style={[styles.ratingBadgeLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Rotten Tomatoes</Text>
                    <Text style={[styles.ratingBadgeValue, { color: colors.onSurface, ...typography.titleLg }]}>{result.omdbRatings.rottenTomatoes}</Text>
                  </View>
                </View>
              )}
              {result.omdbRatings.metascore && (
                <View style={[styles.ratingBadge, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '26' }]}>
                  <Text style={styles.ratingBadgeIcon}>🛡️</Text>
                  <View>
                    <Text style={[styles.ratingBadgeLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Metascore</Text>
                    <Text style={[styles.ratingBadgeValue, { color: colors.onSurface, ...typography.titleLg }]}>{result.omdbRatings.metascore}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {hasSeasonDetails && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>SEASONS & EPISODES</Text>
            <View style={[styles.seriesStats, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '26', borderRadius: radii.xl }]}>
              <View style={styles.seriesStat}>
                <Ionicons name="albums-outline" size={22} color={colors.primary} />
                <Text style={[styles.seriesStatValue, { color: colors.onSurface, ...typography.titleLg }]}>{seasonCount}</Text>
                <Text style={[styles.seriesStatLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                  {seasonCount === 1 ? 'SEASON' : 'SEASONS'}
                </Text>
              </View>
              <View style={[styles.seriesDivider, { backgroundColor: colors.outlineVariant + '33' }]} />
              <View style={styles.seriesStat}>
                <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
                <Text style={[styles.seriesStatValue, { color: colors.onSurface, ...typography.titleLg }]}>{episodeCount}</Text>
                <Text style={[styles.seriesStatLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                  {episodeCount === 1 ? 'EPISODE' : 'EPISODES'}
                </Text>
              </View>
              <View style={[styles.seriesDivider, { backgroundColor: colors.outlineVariant + '33' }]} />
              <View style={styles.seriesStat}>
                <Ionicons name="timer-outline" size={22} color={colors.primary} />
                <Text style={[styles.seriesStatValue, { color: colors.onSurface, ...typography.titleLg }]}>
                  {result.runtimeMinutes ? `${result.runtimeMinutes}m` : 'N/A'}
                </Text>
                <Text style={[styles.seriesStatLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>AVG LENGTH</Text>
              </View>
            </View>

            {result.seasons?.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.seasonsScroll}
              >
                {result.seasons.map((season) => (
                  <View key={season.id || season.seasonNumber} style={[styles.seasonCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '26', borderRadius: radii.md }]}>
                    {season.posterUrl ? (
                      <MediaArtwork uri={season.posterUrl} style={styles.seasonPoster} accessibilityLabel={`${season.name} poster`} />
                    ) : (
                      <View style={[styles.seasonPosterFallback, { backgroundColor: colors.surfaceContainerHighest }]}>
                        <Ionicons name="tv-outline" size={28} color={colors.onSurfaceVariant} />
                      </View>
                    )}
                    <View style={styles.seasonBody}>
                      <Text style={[styles.seasonName, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={2}>
                        {season.name}
                      </Text>
                      <Text style={[styles.seasonMeta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                        {season.year} • {pluralize(season.episodeCount, 'episode')}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={[styles.streamingCard, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl, borderColor: colors.outlineVariant + '26' }]}>
          <Text style={[styles.sectionLabel, { color: colors.onSurface, ...typography.labelSm, marginBottom: 24 }]}>WHERE TO STREAM</Text>
          {result.providerAvailabilityConfidence === 'show' && isTv && (
            <Text style={[styles.providerNote, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
              TV availability is estimated from show-level provider data.
            </Text>
          )}
          
          {result.providerSummary.map((provider) => (
            <View key={provider.key} style={styles.providerRow}>
              <View style={styles.providerInfo}>
                <View style={[styles.providerIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <Ionicons name="film-outline" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.providerName, { color: colors.onSurface, ...typography.bodyLg }]}>{provider.label}</Text>
              </View>
              <Text style={[styles.providerStatus, { color: provider.count > 0 ? colors.primary : colors.onSurfaceVariant, ...typography.labelSm }]}>
                {provider.count > 0 ? `Available in ${provider.count} countries` : 'Not available'}
              </Text>
            </View>
          ))}
          
          <View style={styles.actionRow}>
            {result.trailer && result.trailer !== 'N/A' && (
              <TouchableOpacity
                style={[styles.watchButton, { backgroundColor: colors.primary }]}
                onPress={() => Linking.openURL(result.trailer)}
                accessibilityRole="button"
                accessibilityLabel={`Watch trailer for ${result.title}`}
              >
                <Text style={[styles.watchButtonText, { color: colors.onPrimary, ...typography.labelSm }]}>▶ WATCH TRAILER</Text>
              </TouchableOpacity>
            )}

            {result.imdbId && (
              <TouchableOpacity
                style={[styles.imdbButton, { backgroundColor: '#F5C518', borderColor: '#D4A800' }]}
                onPress={() => Linking.openURL(`https://www.imdb.com/title/${result.imdbId}/`)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${result.title} on IMDb`}
              >
                <Text style={[styles.imdbButtonText, { ...typography.labelSm }]}>IMDb</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.bookmarkButton, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant + '4D' }]}
              onPress={() => onToggleWatchlist(result)}
              accessibilityRole="button"
              accessibilityLabel={isInWatchlist ? `Remove ${result.title} from watchlist` : `Add ${result.title} to watchlist`}
              accessibilityState={{ selected: isInWatchlist }}
            >
              <Ionicons 
                name={isInWatchlist ? "bookmark" : "bookmark-outline"} 
                size={24} 
                color={isInWatchlist ? colors.primary : colors.onSurfaceVariant} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bookmarkButton, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant + '4D' }]}
              onPress={() => setShareSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Share ${result.title}`}
            >
              <Ionicons name="share-social-outline" size={24} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Detailed Country View */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>GLOBAL AVAILABILITY</Text>
          
          <View style={styles.legend}>
            {result.providerSummary.map((provider) => (
              <View key={provider.key} style={styles.legendItem}>
                {provider.logoUrl ? (
                  <Image
                    source={{ uri: provider.logoUrl }}
                    style={[styles.serviceLogo, { borderColor: provider.fallbackColor }]}
                    accessibilityLabel={provider.label}
                  />
                ) : (
                  <View style={[styles.dot, { backgroundColor: provider.fallbackColor }]} />
                )}
                <Text style={[styles.legendText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                  {provider.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.table, { borderColor: colors.outlineVariant + '26' }]}>
            {result.rows.map((row, index) => (
              <View key={row.code} style={[styles.tableRow, index % 2 === 0 ? { backgroundColor: colors.surfaceContainerLow } : null]}>
                <Text style={[styles.countryName, { color: colors.onSurface, ...typography.bodyMd }]}>{row.country}</Text>
                <View style={styles.providerBadges}>
                  {result.providerSummary.map((provider) =>
                    row.providers[provider.key] ? (
                      provider.logoUrl ? (
                        <Image
                          key={provider.key}
                          source={{ uri: provider.logoUrl }}
                          style={[styles.serviceLogo, { borderColor: provider.fallbackColor }]}
                          accessibilityLabel={provider.label}
                        />
                      ) : (
                        <View key={provider.key} style={[styles.dot, { backgroundColor: provider.fallbackColor }]} />
                      )
                    ) : null
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* More Like This */}
        {result.similar && result.similar.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>MORE LIKE THIS</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarScroll}
            >
              {result.similar.map((item) => (
                <TouchableOpacity 
                  key={item.tmdbId} 
                  style={styles.similarItem}
                  onPress={() => onSelectSimilar(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open details for ${item.title}`}
                >
                  <View style={[styles.similarPoster, { backgroundColor: colors.surfaceContainer, borderRadius: radii.md }]}>
                    <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} />
                    <View style={styles.similarRating}>
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>{item.rating}</Text>
                    </View>
                  </View>
                  <Text style={[styles.similarTitle, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offScreen: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    opacity: 0,
    pointerEvents: 'none',
  },
  heroSection: {
    height: 600,
    width: '100%',
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 20, 0.4)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  genreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  genreText: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontWeight: '800',
  },
  title: {
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontWeight: '600',
  },
  detailsContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 40,
  },
  sectionLabel: {
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  synopsis: {
    fontWeight: '300',
    lineHeight: 28,
  },
  streamingCard: {
    padding: 24,
    marginBottom: 40,
    borderWidth: 1,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontWeight: '600',
  },
  providerStatus: {
    fontWeight: '600',
  },
  providerNote: {
    marginBottom: 18,
    lineHeight: 20,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 40,
  },
  metaItem: {
    flex: 1,
  },
  personLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  personLink: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  metaText: {
    fontWeight: '700',
  },
  seriesStats: {
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 16,
    paddingVertical: 18,
  },
  seriesStat: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  seriesStatValue: {
    fontWeight: '900',
  },
  seriesStatLabel: {
    fontWeight: '800',
    textAlign: 'center',
  },
  seriesDivider: {
    width: 1,
    marginVertical: 6,
  },
  seasonsScroll: {
    gap: 12,
    paddingRight: 40,
  },
  seasonCard: {
    borderWidth: 1,
    overflow: 'hidden',
    width: 150,
  },
  seasonPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  seasonPosterFallback: {
    alignItems: 'center',
    aspectRatio: 2 / 3,
    justifyContent: 'center',
    width: '100%',
  },
  seasonBody: {
    gap: 4,
    padding: 10,
  },
  seasonName: {
    fontWeight: '800',
    minHeight: 40,
  },
  seasonMeta: {
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  watchButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchButtonText: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  bookmarkButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imdbButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imdbButtonText: {
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  similarScroll: {
    gap: 16,
    paddingRight: 40,
  },
  similarItem: {
    width: 120,
  },
  similarPoster: {
    width: 120,
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  similarRating: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  similarTitle: {
    fontWeight: '700',
  },
  table: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  countryName: {
    fontWeight: '500',
  },
  providerBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serviceLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  ratingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minWidth: 130,
  },
  ratingBadgeIcon: {
    fontSize: 24,
  },
  ratingBadgeLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ratingBadgeValue: {
    fontWeight: '900',
  },
});
