import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, Image, Share, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProgressiveBlur } from './ProgressiveBlur';
import * as Haptics from 'expo-haptics';
import ViewShot from 'react-native-view-shot';
import * as ExpoSharing from 'expo-sharing';
import { toastiva } from 'toastiva';
import { useTheme } from '../theme/ThemeProvider';
import { usePosterTheme } from '../lib/usePosterTheme';
import { MediaArtwork } from './MediaArtwork';
import { ShareCard } from './ShareCard';
import { ShareOptionsSheet } from './ShareOptionsSheet';
import { TrailerModal } from './TrailerModal';
import { searchPersonByName } from '../lib/tmdb';
import { scale, verticalScale, screenHeight } from '../utils/responsive';

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count || 0} ${(count || 0) === 1 ? singular : plural}`;
}

function hasValue(value) {
  if (value == null) return false;
  const text = String(value).trim();
  return Boolean(text) && !['N/A', 'Undefined', 'undefined', 'Unknown Genre'].includes(text);
}

/** TMDb-style ratings on cards: show `7.6` not `7.6/10`. */
function ratingForCard(rating) {
  if (rating == null || rating === '') return '';
  const s = String(rating);
  if (s === 'N/A') return 'N/A';
  return s.split('/')[0];
}

// ── Award logo definitions ────────────────────────────────────────────────
const AWARD_DEFS = [
  {
    key: 'oscar',
    label: 'Oscars',
    regex: /oscars?|academy awards?/i,
    winRegex: /won\s+(\d+)\s+(?:oscars?|academy awards?)/i,
    logoUri: 'https://images.ctfassets.net/mqgaq446dh9d/1hRNcghUHboflQc5dN5lhO/f331d2533a40ce9f53d25eecf77adaf4/oscars_logo_white_mode.jpg?fm=jpg&q=80&w=768',
  },
  {
    key: 'emmy',
    label: 'Emmys',
    regex: /emmys?|emmy awards?/i,
    winRegex: /won\s+(\d+)\s+(?:primetime\s+|daytime\s+|international\s+)?(?:emmys?|emmy awards?)/i,
    logoUri: 'https://www.televisionacademy.com/build/assets/tva-logo.png',
  },
  {
    key: 'globe',
    label: 'Golden Globes',
    regex: /golden globes?(?: awards?)?/i,
    winRegex: /won\s+(\d+)\s+golden globes?(?: awards?)?/i,
    logoUri: 'https://goldenglobes.com/wp-content/uploads/2025/12/default-stacked.jpg',
  },
];

/**
 * Parse the raw OMDb Awards string and return only official-logo awards with wins.
 */
function parseAwards(awardsStr) {
  if (!awardsStr) return { badges: [] };
  const badges = [];

  for (const def of AWARD_DEFS) {
    if (!def.regex.test(awardsStr)) continue;
    const wonMatch = awardsStr.match(def.winRegex);
    const won = wonMatch ? parseInt(wonMatch[1], 10) : null;
    if (!won) continue;

    badges.push({ ...def, won });
  }

  return { badges };
}

function formatRuntime(minutes, mediaType) {
  if (!minutes) return null;
  if (mediaType === 'tv') return `${minutes}m episodes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

const HERO_HEIGHT = verticalScale(600);

function splitPeople(value) {
  if (!hasValue(value)) return [];
  return String(value)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Loose match for OMDb vs TMDB display names (spacing, punctuation, diacritics). */
function normalizePersonName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function initialsForName(name = '') {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || '?';
}

function personKey(person, index) {
  return `${person.role || 'person'}-${person.id || person.name}-${index}`;
}

export function ResultView({ result, onBack, onToggleWatchlist, isInWatchlist, onSelectSimilar, onPersonPress, onCompanyPress }) {
  const { theme } = useTheme();
  const { typography, radii } = theme;
  const shareCardRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  // Sticky header appears after hero scrolls out of view
  const stickyOpacity = scrollY.interpolate({
    inputRange: [HERO_HEIGHT - 100, HERO_HEIGHT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const stickyTranslateY = scrollY.interpolate({
    inputRange: [HERO_HEIGHT - 100, HERO_HEIGHT],
    outputRange: [-16, 0],
    extrapolate: 'clamp',
  });
  const meshShift = useRef(new Animated.Value(0)).current;
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareCountries, setShareCountries] = useState(null);
  const [showAllCast, setShowAllCast] = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

  // ── Dynamic poster palette ───────────────────────────────────────────────
  const { palette } = usePosterTheme(result?.posterUrl);
  // Merge poster palette over base theme; fall back gracefully
  const colors = palette ?? theme.colors;

  // Fade in when palette arrives so the color shift feels smooth
  const paletteOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    paletteOpacity.setValue(0.3);
    Animated.timing(paletteOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [palette, paletteOpacity]);

  useEffect(() => {
    setShowAllCast(false);
    setIsSynopsisExpanded(false);
  }, [result?.tmdbId]);

  const handlePersonPressWithFallback = useCallback(async (person, role) => {
    if (!onPersonPress) return;

    if (person.id) {
      onPersonPress(person.id, person.name, role);
      return;
    }

    // Fallback: search for the person by name to get their TMDB ID
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const found = await searchPersonByName(person.name);
      if (found && found.id) {
        onPersonPress(found.id, person.name, role);
      } else {
        Alert.alert('Person Not Found', `We couldn't find a filmography for "${person.name}" on TMDb.`);
      }
    } catch (err) {
      Alert.alert('Search Failed', 'Unable to search for this person. Please check your connection.');
    }
  }, [onPersonPress]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(meshShift, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(meshShift, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [meshShift]);

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
        toastiva.success("Shared successfully");
      } else {
        await Share.share({
          message: `Check out "${result?.title}" (${result?.year}) – ${result?.genres || 'Unknown Genre'}`,
        });
        toastiva.success("Shared successfully");
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

  const peopleSections = useMemo(() => {
    const current = result || {};
    const omdbWriterNames = splitPeople(current.omdbRatings?.writer);
    const tmdbWriterNames = splitPeople(current.writer);
    const writerNames = omdbWriterNames.length ? omdbWriterNames : tmdbWriterNames;
    const writerPersons = current.writerPersons || [];

    const writerPeople = writerPersons.length
      ? writerPersons.map((person) => ({
        ...person,
        role: 'writer',
        roleLabel: person.job || 'Writer',
      }))
      : writerNames.map((name) => {
        const match = writerPersons.find(
          (person) => normalizePersonName(person.name) === normalizePersonName(name),
        );
        return {
          ...(match || {}),
          name,
          role: 'writer',
          roleLabel: match?.job || 'Writer',
        };
      });

    const directorPeople = current.mediaType === 'tv'
      ? (current.createdByPersons || []).map((person) => ({
        ...person,
        role: 'creator',
        roleLabel: 'Creator',
      }))
      : (current.directorPersons?.length ? current.directorPersons : (current.directorId && hasValue(current.director) ? [{ id: current.directorId, name: current.director }] : []))
        .map((person) => ({
          ...person,
          role: 'director',
          roleLabel: 'Director',
        }));

    const tmdbCast = current.castPersons?.length
      ? current.castPersons
      : current.starringPersons || [];
    const omdbCast = splitPeople(current.omdbRatings?.actors).map((name) => ({
      id: null,
      name,
      character: '',
      profileUrl: null,
    }));
    const castSource = tmdbCast.length ? tmdbCast : omdbCast;
    const castPeople = castSource.map((person) => ({
      ...person,
      role: 'cast',
      roleLabel: person.character ? person.character : 'Cast',
    }));

    return {
      crewPeople: [...directorPeople, ...writerPeople],
      castPeople,
    };
  }, [result]);

  if (!result) return null;

  const isTv = result.mediaType === 'tv';
  const seasonCount = result.numberOfSeasons || result.seasons?.length || 0;
  const hasSeasonDetails =
    isTv && ((result.seasons?.length ?? 0) > 0 || Boolean(result.runtimeMinutes));
  const runtimeLabel = formatRuntime(result.runtimeMinutes, result.mediaType);
  const hasRating = hasValue(result.rating);
  const hasGenres = hasValue(result.genres);
  const hasPeople = peopleSections.crewPeople.length > 0 || peopleSections.castPeople.length > 0;
  const visibleCastPeople = showAllCast ? peopleSections.castPeople : peopleSections.castPeople.slice(0, 10);
  const remainingCastCount = Math.max(peopleSections.castPeople.length - visibleCastPeople.length, 0);
  const providerSummary = result.providerSummary || [];
  const hasAvailabilityRows = (result.rows || []).length > 0;
  const hasAvailabilityData = Array.isArray(result.rows);
  const displaySynopsis = (result.synopsis && result.synopsis !== 'No synopsis available.')
    ? result.synopsis
    : (result.omdbRatings?.plot || result.synopsis || 'No synopsis available.');
  const meshColors = colors.meshColors || [
    colors.primary,
    colors.surfaceContainerHighest,
    colors.surfaceContainer,
    colors.background,
  ];
  const heroTransform = {
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [-120, 0, HERO_HEIGHT],
          outputRange: [-30, 0, HERO_HEIGHT * 0.22],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: scrollY.interpolate({
          inputRange: [-120, 0, HERO_HEIGHT],
          outputRange: [1.2, 1, 1.12],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
  const heroContentMotion = {
    opacity: scrollY.interpolate({
      inputRange: [0, 260, 430],
      outputRange: [1, 0.65, 0.05],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, HERO_HEIGHT],
          outputRange: [0, HERO_HEIGHT * 0.12],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
  const meshA = {
    backgroundColor: meshColors[0],
    transform: [
      {
        translateX: meshShift.interpolate({
          inputRange: [0, 1],
          outputRange: [-48, 18],
        }),
      },
      {
        translateY: meshShift.interpolate({
          inputRange: [0, 1],
          outputRange: [-16, 36],
        }),
      },
    ],
  };
  const meshB = {
    backgroundColor: meshColors[1],
    transform: [
      {
        translateX: meshShift.interpolate({
          inputRange: [0, 1],
          outputRange: [28, -30],
        }),
      },
      {
        translateY: meshShift.interpolate({
          inputRange: [0, 1],
          outputRange: [20, -24],
        }),
      },
    ],
  };
  const meshC = {
    backgroundColor: meshColors[2],
    transform: [
      {
        translateX: meshShift.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 42],
        }),
      },
      {
        translateY: meshShift.interpolate({
          inputRange: [0, 1],
          outputRange: [30, -8],
        }),
      },
    ],
  };

  return (
    <>
      {/* Off-screen share card – captured by ViewShot, never visible to the user */}
      <ViewShot
        ref={shareCardRef}
        options={{ format: 'png', quality: 1 }}
        style={styles.offScreen}
      >
        <ShareCard result={result} selectedCountries={shareCountries} themeColors={colors} />
      </ViewShot>

      <ShareOptionsSheet
        visible={shareSheetVisible}
        result={result}
        onClose={() => setShareSheetVisible(false)}
        onShare={handleShareConfirm}
      />

      <TrailerModal
        visible={trailerVisible}
        trailerUrl={result?.trailer}
        title={result?.title}
        onClose={() => setTrailerVisible(false)}
      />

      {/* ── Collapsing sticky title bar ─────────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.stickyTitleBar,
          {
            opacity: stickyOpacity,
            transform: [{ translateY: stickyTranslateY }],
            backgroundColor: colors.background + 'F0',
            borderBottomColor: colors.outlineVariant + '33',
          },
        ]}
      >
        {Platform.OS === 'android' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background + 'D9' }]} />
        ) : (
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.stickyTitleContent}>
          <Text
            style={[styles.stickyTitle, { color: colors.onSurface, ...typography.titleMd }]}
            numberOfLines={1}
          >
            {result?.title}
          </Text>
          {result?.year ? (
            <Text style={[{ color: colors.onSurfaceVariant, ...typography.labelSm }]}>
              {result.year}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={[styles.container, { opacity: paletteOpacity, backgroundColor: colors.background }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.heroSection}>
          <Animated.View style={[styles.parallaxArtwork, heroTransform]}>
            <MediaArtwork
              uri={result.backdropUrl || result.posterUrl}
              style={styles.backdrop}
              resizeMode="cover"
              accessibilityLabel={`${result.title} artwork`}
              title={result.title}
            />
          </Animated.View>
          {/* Gradient scrim tinted with the extracted accent color */}
          <View style={[styles.scrimTop, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
          <ProgressiveBlur
            intensity={80}
            tint="dark"
            direction="bottom"
            locations={[0, 1]}
            overlayColor={colors.background}
            style={styles.scrimBottom}
          />

          <Animated.View style={[styles.heroContent, heroContentMotion]}>
            <View style={styles.heroMetaStack}>
              {hasGenres && (
                <View style={styles.genreBadge}>
                  <Text style={[styles.genreText, { color: '#ffffff', ...typography.labelSm }]} numberOfLines={1}>
                    {result.genres}
                  </Text>
                </View>
              )}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.heroRatingsStrip}
              >
                {hasRating && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Linking.openURL(`https://www.themoviedb.org/${result.mediaType === 'tv' ? 'tv' : 'movie'}/${result.tmdbId}`);
                    }}
                    style={styles.heroRatingItem}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${result.title} on TMDB`}
                  >
                    <View style={styles.badgeTmdb}>
                      <Text style={styles.badgeTmdbText}>TMDb</Text>
                    </View>
                    <Text style={[styles.heroRatingText, { ...typography.labelSm }]}>
                      {result.rating.toString().split('/')[0]}
                    </Text>
                  </TouchableOpacity>
                )}

                {result.omdbRatings?.imdbRating && result.imdbId && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Linking.openURL(`https://www.imdb.com/title/${result.imdbId}/`);
                    }}
                    style={styles.heroRatingItem}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${result.title} on IMDb`}
                  >
                    <View style={styles.badgeImdb}>
                      <Text style={styles.badgeImdbText}>IMDb</Text>
                    </View>
                    <Text style={[styles.heroRatingText, { ...typography.labelSm }]}>
                      {result.omdbRatings.imdbRating.split('/')[0]}
                    </Text>
                  </TouchableOpacity>
                )}

                {result.omdbRatings?.rottenTomatoes && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Linking.openURL(`https://www.rottentomatoes.com/search?search=${encodeURIComponent(result.title || '')}`);
                    }}
                    style={styles.heroRatingItem}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${result.title} on Rotten Tomatoes`}
                  >
                    <View style={styles.badgeRt}>
                      <Text style={styles.badgeRtText}>🍅</Text>
                    </View>
                    <Text style={[styles.heroRatingText, { ...typography.labelSm }]}>
                      {result.omdbRatings.rottenTomatoes.replace('%', '')}%
                    </Text>
                  </TouchableOpacity>
                )}

                {result.omdbRatings?.metascore && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Linking.openURL(`https://www.metacritic.com/search/all/${encodeURIComponent(result.title || '')}/results`);
                    }}
                    style={styles.heroRatingItem}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${result.title} on Metacritic`}
                  >
                    <View style={styles.badgeMeta}>
                      <Text style={styles.badgeMetaText}>M</Text>
                    </View>
                    <Text style={[styles.heroRatingText, { ...typography.labelSm }]}>
                      {result.omdbRatings.metascore}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {/* Title stays white — it always sits on top of the backdrop image */}
            <Text style={[styles.title, { color: '#ffffff', ...typography.displayLg }]}>{result.title}</Text>

            <View style={[styles.infoRow, { alignItems: 'center' }]}>
              <View style={styles.infoPill}>
                <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.75)" />
                <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.75)', ...typography.labelSm }]}>{result.year}</Text>
              </View>
              {isTv && seasonCount > 0 && (
                <View style={styles.infoPill}>
                  <Ionicons name="tv-outline" size={14} color="rgba(255,255,255,0.75)" />
                  <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.75)', ...typography.labelSm }]}>
                    {pluralize(seasonCount, 'season')}
                  </Text>
                </View>
              )}
              {!isTv && runtimeLabel && (
                <View style={styles.infoPill}>
                  <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.75)" />
                  <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.75)', ...typography.labelSm }]}>
                    {runtimeLabel}
                  </Text>
                </View>
              )}
              {result.omdbRatings?.rated && (
                <View style={[styles.infoPill, styles.ratedBadge]}>
                  <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.85)', ...typography.labelSm }]}>
                    {result.omdbRatings.rated}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.infoPill}
                onPress={() => setShareSheetVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={`Share ${result.title}`}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="share-social-outline" size={18} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              {result.trailer && result.trailer !== 'N/A' && (
                <TouchableOpacity
                  style={styles.infoPill}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTrailerVisible(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Watch trailer for ${result.title}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="logo-youtube" size={20} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.infoPill}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (isInWatchlist) {
                    toastiva.info('Already saved — tap to manage');
                  } else {
                    toastiva.success('Adding to Watchlist…');
                  }
                  onToggleWatchlist(result);
                }}
                accessibilityRole="button"
                accessibilityLabel={isInWatchlist ? `Remove ${result.title} from watchlist` : `Add ${result.title} to watchlist`}
                accessibilityState={{ selected: isInWatchlist }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isInWatchlist ? "bookmark" : "bookmark-outline"}
                  size={20}
                  color="rgba(255,255,255,0.85)"
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>

        <View style={[styles.detailsContent, { backgroundColor: colors.background }]}>
          <View pointerEvents="none" style={styles.meshBackdrop}>
            <LinearGradient
              colors={[colors.background, meshColors[3] || colors.surfaceContainer, colors.background]}
              locations={[0, 0.48, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[styles.meshOrb, styles.meshOrbA, meshA]} />
            <Animated.View style={[styles.meshOrb, styles.meshOrbB, meshB]} />
            <Animated.View style={[styles.meshOrb, styles.meshOrbC, meshC]} />
            <View style={[styles.meshVeil, { backgroundColor: colors.background + 'D9' }]} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Synopsis</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsSynopsisExpanded(!isSynopsisExpanded);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.synopsis, { color: colors.onSurface, ...typography.bodyLg }]}>
                {isSynopsisExpanded || (displaySynopsis?.length || 0) <= 250
                  ? displaySynopsis
                  : `${displaySynopsis.substring(0, 250)}...`}
              </Text>
            </TouchableOpacity>
          </View>

          {hasSeasonDetails && (
            <View style={styles.section}>
              {result.runtimeMinutes && (
                <View style={styles.seriesStats}>
                  <View style={styles.seriesStat}>
                    <Ionicons name="timer-outline" size={22} color={colors.primary} />
                    <Text style={[styles.seriesStatValue, { color: colors.onSurface, ...typography.titleLg }]}>
                      {`${result.runtimeMinutes}m`}
                    </Text>
                    <Text style={[styles.seriesStatLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Avg Length</Text>
                  </View>
                </View>
              )}

              {result.seasons?.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonsScroll}
                >
                  {result.seasons.map((season) => (
                    <View key={season.id || season.seasonNumber} style={styles.seasonCard}>
                      <MediaArtwork uri={season.posterUrl} style={styles.seasonPoster} accessibilityLabel={`${season.name} poster`} title={season.name} icon="tv-outline" />
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

          {hasPeople && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm, marginBottom: 0 }]}>Cast & Crew</Text>
                {remainingCastCount > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowAllCast(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${remainingCastCount} more cast members`}
                    style={styles.seeAllButton}
                  >
                    <Text style={[styles.seeAllText, { color: colors.primary, ...typography.labelSm }]}>See All</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.peopleScroll}
                decelerationRate="fast"
              >
                {peopleSections.crewPeople.map((person, index) => (
                  <TouchableOpacity
                    key={personKey(person, index)}
                    style={styles.personCard}
                    onPress={() => {
                      const filmographyRole = person.role === 'creator'
                        ? 'tv'
                        : person.role === 'writer'
                          ? 'writer'
                          : 'movie';
                      handlePersonPressWithFallback(person, filmographyRole);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`View work by ${person.name}`}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.avatarRing, !person.profileUrl && { backgroundColor: colors.primaryContainer }]}>
                      {person.profileUrl ? (
                        <MediaArtwork
                          uri={person.profileUrl}
                          style={styles.personAvatar}
                          accessibilityLabel={`${person.name} profile photo`}
                          title={person.name}
                          icon="person-outline"
                          compactFallback
                        />
                      ) : (
                        <Text style={[styles.avatarInitials, { color: colors.primary, ...typography.labelSm }]}>
                          {initialsForName(person.name)}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.personName, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={2}>
                      {person.name}
                    </Text>
                    <Text style={[styles.personRole, { color: colors.onSurfaceVariant, ...typography.labelSm }]} numberOfLines={2}>
                      {person.roleLabel}
                    </Text>
                  </TouchableOpacity>
                ))}

                {visibleCastPeople.map((person, index) => (
                  <TouchableOpacity
                    key={personKey(person, index)}
                    style={styles.personCard}
                    onPress={() => handlePersonPressWithFallback(person, 'cast')}
                    accessibilityRole="button"
                    accessibilityLabel={`View filmography for ${person.name}`}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.avatarRing, !person.profileUrl && { backgroundColor: colors.surfaceContainerHigh }]}>
                      {person.profileUrl ? (
                        <MediaArtwork
                          uri={person.profileUrl}
                          style={styles.personAvatar}
                          accessibilityLabel={`${person.name} profile photo`}
                          title={person.name}
                          icon="person-outline"
                          compactFallback
                        />
                      ) : (
                        <Text style={[styles.avatarInitials, { color: colors.onSurface, ...typography.labelSm }]}>
                          {initialsForName(person.name)}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.personName, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={2}>
                      {person.name}
                    </Text>
                    <Text style={[styles.personRole, { color: colors.onSurfaceVariant, ...typography.labelSm }]} numberOfLines={2}>
                      {person.roleLabel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}



          {/* ─── Awards ──────────────────────────────────────────────────── */}
          {result.omdbRatings?.awards && (() => {
            const parsed = parseAwards(result.omdbRatings.awards);
            const hasBadges = parsed.badges && parsed.badges.length > 0;
            if (!hasBadges) return null;

            return (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Awards & Recognition</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.awardsScroll}
                >
                  {parsed.badges.map((badge) => (
                    <View
                      key={badge.key}
                      style={styles.awardTile}
                    >
                      <Image
                        source={{ uri: badge.logoUri }}
                        style={styles.awardLogo}
                        resizeMode="contain"
                        accessibilityLabel={`${badge.label} logo`}
                      />
                      <Text style={[styles.awardWonText, { color: colors.onSurface, ...typography.labelSm }]}>
                        {badge.won} {badge.won === 1 ? 'Win' : 'Wins'}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            );
          })()}

          {result.productionCompanies && result.productionCompanies.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Production Companies</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productionScroll}
              >
                {result.productionCompanies.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={styles.productionTile}
                    onPress={() => {
                      if (!onCompanyPress) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onCompanyPress(company.id, company.name, company.logoUrl);
                    }}
                    disabled={!onCompanyPress}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel={onCompanyPress ? `View titles from ${company.name}` : undefined}
                    accessibilityState={{ disabled: !onCompanyPress }}
                  >
                    <View
                      style={[
                        styles.productionLogoHaloBase,
                        Platform.OS === 'ios' ? styles.productionLogoHaloOuterIos : styles.productionLogoHaloOuterAndroid,
                      ]}
                    >
                      {Platform.OS === 'ios' ? (
                        <View style={[styles.productionLogoHaloBase, styles.productionLogoHaloInnerIos]}>
                          <Image
                            source={{ uri: company.logoUrl }}
                            style={styles.productionLogo}
                            resizeMode="contain"
                            accessibilityLabel={`${company.name} logo`}
                          />
                        </View>
                      ) : (
                        <Image
                          source={{ uri: company.logoUrl }}
                          style={styles.productionLogo}
                          resizeMode="contain"
                          accessibilityLabel={`${company.name} logo`}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Detailed Country View */}
          {hasAvailabilityData && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Global Availability</Text>

              {hasAvailabilityRows ? (
                <View style={styles.table}>
                  {result.rows.map((row) => (
                    <View key={row.code} style={styles.tableRow}>
                      <Text style={[styles.countryName, { color: colors.onSurface, ...typography.bodyMd }]}>{row.country}</Text>
                      <View style={styles.providerBadges}>
                        {providerSummary.map((provider) =>
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
              ) : (
                <View style={styles.availabilityEmpty}>
                  <Ionicons name="earth-outline" size={22} color={colors.onSurfaceVariant} />
                  <Text style={[styles.availabilityEmptyText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                    Not listed on Netflix, Prime Video, or HBO Max in any country right now.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* More From This Cast & Crew */}
          {result.moreFromCastAndCrew && result.moreFromCastAndCrew.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>More From This Cast & Crew</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarScroll}
              >
                {result.moreFromCastAndCrew.map((item) => (
                  <TouchableOpacity
                    key={item.tmdbId}
                    style={styles.similarItem}
                    onPress={() => onSelectSimilar(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open details for ${item.title}`}
                  >
                    <View style={[styles.similarPoster, { borderRadius: radii.md }]}>
                      <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} title={item.title} />
                      {item.omdbRatings?.imdbRating && (
                        <View style={[styles.similarRating, { backgroundColor: '#F5C518' }]}>
                          <Text style={{ color: '#000000', fontSize: 10, fontWeight: '800' }}>IMDb {ratingForCard(item.omdbRatings.imdbRating)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.similarTitle, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* More Like This */}
          {result.similar && result.similar.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>More Like This</Text>
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
                    <View style={[styles.similarPoster, { borderRadius: radii.md }]}>
                      <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} title={item.title} />
                      <View style={styles.similarRating}>
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>{ratingForCard(item.rating)}</Text>
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
      </Animated.ScrollView>
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
  stickyTitleBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    zIndex: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stickyTitleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    height: '100%',
  },
  stickyTitle: {
    fontWeight: '800',
    flex: 1,
  },
  heroSection: {
    height: HERO_HEIGHT,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  parallaxArtwork: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  scrimTop: {
    ...StyleSheet.absoluteFillObject,
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  heroContent: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  heroMetaStack: {
    gap: 12,
    marginBottom: 20,
  },
  genreBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  genreText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroRatingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingRight: 20,
  },
  heroRatingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  heroRatingText: {
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  badgeTmdb: {
    backgroundColor: '#0d253f',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#01b4e4',
  },
  badgeTmdbText: {
    color: '#01b4e4',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeImdb: {
    backgroundColor: '#F5C518',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeImdbText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  badgeRt: {
    backgroundColor: '#FA320A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRtText: {
    color: '#ffffff',
    fontSize: 10,
  },
  badgeMeta: {
    backgroundColor: '#66CC33',
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMetaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
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
  ratedBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detailsContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 100,
    position: 'relative',
    overflow: 'hidden',
    // backgroundColor applied inline via colors.background so it shifts with the poster palette
  },
  meshBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.88,
  },
  meshOrb: {
    position: 'absolute',
    opacity: 0.24,
  },
  meshOrbA: {
    width: 320,
    height: 320,
    borderRadius: 160,
    left: -150,
    top: 24,
  },
  meshOrbB: {
    width: 280,
    height: 280,
    borderRadius: 140,
    right: -126,
    top: 340,
  },
  meshOrbC: {
    width: 360,
    height: 360,
    borderRadius: 180,
    left: -80,
    bottom: 220,
  },
  meshVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
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
  seeAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  seeAllText: {
    fontWeight: '900',
    letterSpacing: 1,
  },
  peopleScroll: {
    gap: 16,
    paddingRight: 40,
  },
  personCard: {
    alignItems: 'center',
    width: scale(92),
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: scale(38),
    height: scale(76),
    justifyContent: 'center',
    marginBottom: scale(10),
    overflow: 'hidden',
    width: scale(76),
  },
  personAvatar: {
    height: '100%',
    width: '100%',
  },
  avatarInitials: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  personName: {
    fontWeight: '800',
    minHeight: 40,
    textAlign: 'center',
  },
  personRole: {
    fontWeight: '700',
    minHeight: 32,
    textAlign: 'center',
  },
  seriesStats: {
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
  seasonsScroll: {
    gap: 12,
    paddingRight: 40,
  },
  seasonCard: {
    overflow: 'hidden',
    width: scale(150),
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
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  watchButton: {
    flex: 1,
    flexDirection: 'row',
    gap: scale(8),
    height: verticalScale(56),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  watchButtonText: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  bookmarkButton: {
    width: scale(56),
    height: verticalScale(56),
    borderRadius: scale(12),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imdbButton: {
    width: scale(56),
    height: verticalScale(56),
    borderRadius: scale(12),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imdbButtonText: {
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  rtButton: {
    width: scale(64),
    height: verticalScale(56),
    borderRadius: scale(12),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rtButtonText: {
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  similarScroll: {
    gap: 16,
    paddingRight: 40,
  },
  similarItem: {
    width: scale(120),
  },
  similarPoster: {
    width: scale(120),
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
    overflow: 'hidden',
  },
  availabilityEmpty: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  availabilityEmptyText: {
    flex: 1,
    fontWeight: '500',
    lineHeight: 22,
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
    gap: 12,
    paddingRight: 4,
  },
  ratingBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 4,
  },
  ratingLogoImdb: {
    width: 32,
    height: 16,
  },
  ratingLogoRt: {
    width: 22,
    height: 22,
  },
  ratingLogoMeta: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  ratingValueCompact: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  ratingBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  // ── Awards ──────────────────────────────────────────────────────────────
  awardsScroll: {
    gap: 12,
    paddingRight: 24,
    marginBottom: 20,
  },
  awardTile: {
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 10,
    minWidth: 120,
  },
  awardLogo: {
    width: 86,
    height: 54,
  },
  awardWonText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // ── Production Companies ────────────────────────────────────────────────
  productionScroll: {
    gap: 12,
    paddingRight: 24,
    paddingVertical: 6,
  },
  productionTile: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    minWidth: 120,
    overflow: 'visible',
  },
  productionLogoHaloBase: {
    width: 80,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productionLogoHaloOuterIos: {
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 3,
  },
  productionLogoHaloInnerIos: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
  },
  productionLogoHaloOuterAndroid: {
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  productionLogo: {
    width: 80,
    height: 40,
  },
});
