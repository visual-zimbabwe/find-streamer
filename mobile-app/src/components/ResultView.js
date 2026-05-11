import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, Image, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ViewShot from 'react-native-view-shot';
import * as ExpoSharing from 'expo-sharing';
import { useTheme } from '../theme/ThemeProvider';
import { usePosterTheme } from '../lib/usePosterTheme';
import { MediaArtwork } from './MediaArtwork';
import { ShareCard } from './ShareCard';
import { ShareOptionsSheet } from './ShareOptionsSheet';
import { TrailerModal } from './TrailerModal';

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count || 0} ${(count || 0) === 1 ? singular : plural}`;
}

function hasValue(value) {
  if (value == null) return false;
  const text = String(value).trim();
  return Boolean(text) && !['N/A', 'Undefined', 'undefined', 'Unknown Genre'].includes(text);
}

// ── Award badge definitions ───────────────────────────────────────────────
const AWARD_DEFS = [
  { key: 'oscar', label: 'Oscar', icon: '🏆', regex: /oscar/i, color: '#C9A84C', bg: '#3A2E14' },
  { key: 'globe', label: 'Golden Globe', icon: '🌐', regex: /golden globe/i, color: '#C9A84C', bg: '#2E2E14' },
  { key: 'bafta', label: 'BAFTA', icon: '🎭', regex: /bafta/i, color: '#9B59B6', bg: '#2A1A3A' },
  { key: 'emmy', label: 'Emmy', icon: '📡', regex: /emmy/i, color: '#3498DB', bg: '#0D2236' },
  { key: 'sag', label: 'SAG Award', icon: '🎬', regex: /screen actors guild|sag award/i, color: '#E74C3C', bg: '#2A0E0E' },
  { key: 'critics', label: 'Critics Choice', icon: '✍️', regex: /critics.{0,6}choice/i, color: '#27AE60', bg: '#0E2A16' },
];

/**
 * Parse the raw OMDb Awards string and return an array of detected award badges.
 * Each badge has: key, label, icon, color, bg, won (number|null), nominated (number|null).
 */
function parseAwards(awardsStr) {
  if (!awardsStr) return [];
  const badges = [];

  for (const def of AWARD_DEFS) {
    if (!def.regex.test(awardsStr)) continue;

    // Look for "Won N <award>" or "Nominated for N <award>"
    const wonMatch = awardsStr.match(new RegExp(`won\\s+(\\d+)\\s+${def.key === 'oscar' ? 'oscar' : def.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
    const nomMatch = awardsStr.match(new RegExp(`nominated for\\s+(\\d+)\\s+${def.key === 'oscar' ? 'oscar' : def.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));

    badges.push({
      ...def,
      won: wonMatch ? parseInt(wonMatch[1], 10) : null,
      nominated: nomMatch ? parseInt(nomMatch[1], 10) : null,
    });
  }

  // Also extract the grand total wins & nominations (e.g. "83 wins & 215 nominations total")
  const totalWonMatch = awardsStr.match(/(\d+)\s+win/i);
  const totalNomMatch = awardsStr.match(/(\d+)\s+nomination/i);

  return {
    badges,
    totalWins: totalWonMatch ? parseInt(totalWonMatch[1], 10) : null,
    totalNoms: totalNomMatch ? parseInt(totalNomMatch[1], 10) : null,
    raw: awardsStr,
  };
}

function formatRuntime(minutes, mediaType) {
  if (!minutes) return null;
  if (mediaType === 'tv') return `${minutes}m episodes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

const HERO_HEIGHT = 600;

function splitPeople(value) {
  if (!hasValue(value)) return [];
  return String(value)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
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

export function ResultView({ result, onBack, onToggleWatchlist, isInWatchlist, onSelectSimilar, onPersonPress }) {
  const { theme } = useTheme();
  const { typography, radii } = theme;
  const shareCardRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const meshShift = useRef(new Animated.Value(0)).current;
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareCountries, setShareCountries] = useState(null);
  const [showAllCast, setShowAllCast] = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(false);

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
  }, [result?.tmdbId]);

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

  const peopleSections = useMemo(() => {
    const current = result || {};
    const omdbWriterNames = splitPeople(current.omdbRatings?.writer);
    const tmdbWriterNames = splitPeople(current.writer);
    const writerNames = omdbWriterNames.length ? omdbWriterNames : tmdbWriterNames;
    const writerPersons = current.writerPersons || [];

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

    const writerPeople = writerNames.map((name) => {
      const match = writerPersons.find((person) => person.name === name);
      return {
        ...(match || {}),
        name,
        role: 'writer',
        roleLabel: match?.job || 'Writer',
      };
    });

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
  const episodeCount = result.numberOfEpisodes || 0;
  const hasSeasonDetails = isTv && (seasonCount > 0 || episodeCount > 0 || result.seasons?.length > 0);
  const runtimeLabel = formatRuntime(result.runtimeMinutes, result.mediaType);
  const hasRating = hasValue(result.rating);
  const hasGenres = hasValue(result.genres);
  const hasDirector = !isTv && hasValue(result.director);
  const hasCreatedBy = isTv && (hasValue(result.createdBy) || result.createdByPersons?.length > 0);
  const writerText = hasValue(result.omdbRatings?.writer) ? result.omdbRatings.writer : result.writer;
  const hasWriter = hasValue(writerText);
  const hasPeople = peopleSections.crewPeople.length > 0 || peopleSections.castPeople.length > 0;
  const visibleCastPeople = showAllCast ? peopleSections.castPeople : peopleSections.castPeople.slice(0, 10);
  const remainingCastCount = Math.max(peopleSections.castPeople.length - visibleCastPeople.length, 0);
  const providerSummary = result.providerSummary || [];
  const providerCount = providerSummary.reduce((sum, provider) => sum + (provider.count || 0), 0);
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
          outputRange: [1.2, 1.06, 1.12],
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
          <LinearGradient
            colors={['transparent', colors.background + 'B3', colors.background]}
            locations={[0, 0.5, 1]}
            style={styles.scrimBottom}
          />

          <Animated.View style={[styles.heroContent, heroContentMotion]}>
            <View style={styles.metaRow}>
              {hasGenres && (
                <View style={[styles.genreBadge, { backgroundColor: colors.primary + '55' }]}>
                  <Text style={[styles.genreText, { color: '#ffffff', ...typography.labelSm }]}>{result.genres}</Text>
                </View>
              )}
              {hasRating && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={colors.primary} />
                  <Text style={[styles.ratingText, { color: '#ffffff', ...typography.labelSm }]}>{result.rating}</Text>
                </View>
              )}
            </View>

            {/* Title stays white — it always sits on top of the backdrop image */}
            <Text style={[styles.title, { color: '#ffffff', ...typography.displayLg }]}>{result.title}</Text>

            <View style={styles.infoRow}>
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

          {(hasDirector || hasCreatedBy || hasWriter) && (
          <View style={styles.metaGrid}>
            {(hasDirector || hasCreatedBy) && (
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
            )}
            {hasWriter && (
            <View style={styles.metaItem}>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>WRITER</Text>
              {peopleSections.crewPeople.filter(p => p.role === 'writer').length > 0 ? (
                <View style={styles.personLinkRow}>
                  {peopleSections.crewPeople.filter(p => p.role === 'writer').map((person, idx, arr) => (
                    <React.Fragment key={person.id || person.name}>
                      {person.id ? (
                        <TouchableOpacity
                          onPress={() => onPersonPress?.(person.id, person.name, 'movie')}
                          accessibilityRole="button"
                          accessibilityLabel={`View work by ${person.name}`}
                        >
                          <Text style={[styles.metaText, styles.personLink, { color: colors.primary, ...typography.bodyMd }]}>
                            {person.name}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]}>{person.name}</Text>
                      )}
                      {idx < arr.length - 1 && (
                        <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]}>{', '}</Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={3}>
                  {writerText}
                </Text>
              )}
            </View>
            )}
          </View>
          )}

          {hasPeople && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm, marginBottom: 0 }]}>CAST & CREW</Text>
                {remainingCastCount > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowAllCast(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${remainingCastCount} more cast members`}
                    style={[styles.seeAllButton, { borderColor: colors.primary + '66', backgroundColor: colors.primaryContainer }]}
                  >
                    <Text style={[styles.seeAllText, { color: colors.primary, ...typography.labelSm }]}>SEE ALL</Text>
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
                    onPress={() => person.id ? onPersonPress?.(person.id, person.name, person.role === 'creator' ? 'tv' : 'movie') : null}
                    disabled={!person.id}
                    accessibilityRole={person.id ? 'button' : 'text'}
                    accessibilityLabel={person.id ? `View work by ${person.name}` : person.name}
                    activeOpacity={person.id ? 0.78 : 1}
                  >
                    <View style={[styles.avatarRing, { borderColor: colors.primary + '66', backgroundColor: colors.primaryContainer }]}>
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
                    onPress={() => person.id ? onPersonPress?.(person.id, person.name, 'cast') : null}
                    disabled={!person.id}
                    accessibilityRole={person.id ? 'button' : 'text'}
                    accessibilityLabel={person.id ? `View filmography for ${person.name}` : person.name}
                    activeOpacity={person.id ? 0.78 : 1}
                  >
                    <View style={[styles.avatarRing, { borderColor: colors.outlineVariant + '55', backgroundColor: colors.surfaceContainerHigh }]}>
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ratingsRow}
              >
                {result.omdbRatings.imdbRating && result.imdbId && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Linking.openURL(`https://www.imdb.com/title/${result.imdbId}/`);
                    }}
                    style={[styles.ratingBadge, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '26' }]}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${result.title} on IMDb`}
                  >
                    <Text style={styles.ratingBadgeIcon}>⭐</Text>
                    <View>
                      <View style={styles.ratingBadgeHeader}>
                        <Text style={[styles.ratingBadgeLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>IMDb</Text>
                        <Ionicons name="open-outline" size={10} color={colors.onSurfaceVariant} style={{ marginLeft: 4 }} />
                      </View>
                      <Text style={[styles.ratingBadgeValue, { color: colors.onSurface, ...typography.titleLg }]}>{result.omdbRatings.imdbRating}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {result.omdbRatings.rottenTomatoes && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Linking.openURL(`https://www.rottentomatoes.com/search?search=${encodeURIComponent(result.title || '')}`);
                    }}
                    style={[styles.ratingBadge, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '26' }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${result.title} on Rotten Tomatoes`}
                  >
                    <Text style={styles.ratingBadgeIcon}>🍅</Text>
                    <View>
                      <View style={styles.ratingBadgeHeader}>
                        <Text style={[styles.ratingBadgeLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Rotten Tomatoes</Text>
                        <Ionicons name="open-outline" size={10} color={colors.onSurfaceVariant} style={{ marginLeft: 4 }} />
                      </View>
                      <Text style={[styles.ratingBadgeValue, { color: colors.onSurface, ...typography.titleLg }]}>{result.omdbRatings.rottenTomatoes}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {result.omdbRatings.metascore && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Linking.openURL(`https://www.metacritic.com/search/all/${encodeURIComponent(result.title || '')}/results`);
                    }}
                    style={[styles.ratingBadge, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '26' }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${result.title} on Metacritic`}
                  >
                    <Text style={styles.ratingBadgeIcon}>🛡️</Text>
                    <View>
                      <View style={styles.ratingBadgeHeader}>
                        <Text style={[styles.ratingBadgeLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Metascore</Text>
                        <Ionicons name="open-outline" size={10} color={colors.onSurfaceVariant} style={{ marginLeft: 4 }} />
                      </View>
                      <Text style={[styles.ratingBadgeValue, { color: colors.onSurface, ...typography.titleLg }]}>{result.omdbRatings.metascore}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* ─── Awards ──────────────────────────────────────────────────── */}
          {result.omdbRatings?.awards && (() => {
            const parsed = parseAwards(result.omdbRatings.awards);
            const hasBadges = parsed.badges && parsed.badges.length > 0;
            return (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>AWARDS & RECOGNITION</Text>

                {/* Per-ceremony badge tiles */}
                {hasBadges && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.awardsScroll}
                  >
                    {parsed.badges.map((badge) => (
                      <View
                        key={badge.key}
                        style={[
                          styles.awardTile,
                          { backgroundColor: badge.bg, borderColor: badge.color + '55' },
                        ]}
                      >
                        <Text style={styles.awardTileIcon}>{badge.icon}</Text>
                        <Text style={[styles.awardTileLabel, { color: badge.color, ...typography.labelSm }]}>
                          {badge.label.toUpperCase()}
                        </Text>
                        {badge.won != null && (
                          <View style={[styles.awardWonPill, { backgroundColor: badge.color + '22', borderColor: badge.color + '66' }]}>
                            <Text style={[styles.awardWonText, { color: badge.color, ...typography.labelSm }]}>
                              🏅 {badge.won} {badge.won === 1 ? 'Win' : 'Wins'}
                            </Text>
                          </View>
                        )}
                        {badge.nominated != null && badge.won == null && (
                          <View style={[styles.awardWonPill, { backgroundColor: badge.color + '11', borderColor: badge.color + '44' }]}>
                            <Text style={[styles.awardWonText, { color: badge.color + 'CC', ...typography.labelSm }]}>
                              📋 Nominated
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}

                {/* Grand-total pill */}
                {(parsed.totalWins != null || parsed.totalNoms != null) && (
                  <View style={[styles.awardsSummary, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '33' }]}>
                    {parsed.totalWins != null && (
                      <View style={styles.awardsStat}>
                        <Text style={[styles.awardsStatValue, { color: colors.onSurface, ...typography.titleLg }]}>{parsed.totalWins}</Text>
                        <Text style={[styles.awardsStatLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>TOTAL WINS</Text>
                      </View>
                    )}
                    {parsed.totalWins != null && parsed.totalNoms != null && (
                      <View style={[styles.seriesDivider, { backgroundColor: colors.outlineVariant + '33' }]} />
                    )}
                    {parsed.totalNoms != null && (
                      <View style={styles.awardsStat}>
                        <Text style={[styles.awardsStatValue, { color: colors.onSurface, ...typography.titleLg }]}>{parsed.totalNoms}</Text>
                        <Text style={[styles.awardsStatLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>NOMINATIONS</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Raw awards text as a caption */}
                {!hasBadges && (
                  <Text style={[styles.awardsRaw, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                    {parsed.raw}
                  </Text>
                )}
              </View>
            );
          })()}

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
                {result.runtimeMinutes && (
                  <>
                    <View style={[styles.seriesDivider, { backgroundColor: colors.outlineVariant + '33' }]} />
                    <View style={styles.seriesStat}>
                      <Ionicons name="timer-outline" size={22} color={colors.primary} />
                      <Text style={[styles.seriesStatValue, { color: colors.onSurface, ...typography.titleLg }]}>
                        {`${result.runtimeMinutes}m`}
                      </Text>
                      <Text style={[styles.seriesStatLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>AVG LENGTH</Text>
                    </View>
                  </>
                )}
              </View>

              {result.seasons?.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonsScroll}
                >
                  {result.seasons.map((season) => (
                    <View key={season.id || season.seasonNumber} style={[styles.seasonCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '26', borderRadius: radii.md }]}>
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

          <View style={[styles.streamingCard, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl, borderColor: colors.outlineVariant + '26' }]}>
            <Text style={[styles.sectionLabel, { color: colors.onSurface, ...typography.labelSm, marginBottom: 24 }]}>WHERE TO STREAM</Text>
            {result.providerAvailabilityConfidence === 'show' && isTv && (
              <Text style={[styles.providerNote, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                TV availability is estimated from show-level provider data.
              </Text>
            )}

            {providerCount === 0 ? (
              <View style={[styles.providerEmpty, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant + '33', borderRadius: radii.md }]}>
                <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
                <Text style={[styles.providerEmptyText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                  Not currently available to stream in the tracked countries. Add it to Watchlist to check again later.
                </Text>
              </View>
            ) : providerSummary.map((provider) => (
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
                  style={[styles.watchButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTrailerVisible(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Watch trailer for ${result.title}`}
                >
                  <Ionicons name="play" size={16} color={colors.onPrimary} />
                  <Text style={[styles.watchButtonText, { color: colors.onPrimary, ...typography.labelSm }]}>WATCH TRAILER</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.bookmarkButton,
                  {
                    backgroundColor: isInWatchlist ? colors.primary : colors.primaryContainer,
                    borderColor: colors.primary + '66',
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onToggleWatchlist(result);
                }}
                accessibilityRole="button"
                accessibilityLabel={isInWatchlist ? `Remove ${result.title} from watchlist` : `Add ${result.title} to watchlist`}
                accessibilityState={{ selected: isInWatchlist }}
              >
                <Ionicons
                  name={isInWatchlist ? "bookmark" : "bookmark-outline"}
                  size={24}
                  color={isInWatchlist ? colors.onPrimary : colors.primary}
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
          {result.rows && result.rows.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>GLOBAL AVAILABILITY</Text>

              <View style={[styles.table, { borderColor: colors.outlineVariant + '26' }]}>
                {result.rows.map((row, index) => (
                  <View key={row.code} style={[styles.tableRow, index % 2 === 0 ? { backgroundColor: colors.surfaceContainerLow } : null]}>
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
            </View>
          )}

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
                      <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} title={item.title} />
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
  providerEmpty: {
    alignItems: 'flex-start',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    padding: 14,
  },
  providerEmptyText: {
    flex: 1,
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
  seeAllButton: {
    borderRadius: 999,
    borderWidth: 1,
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
    width: 92,
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: 38,
    borderWidth: 1.5,
    height: 76,
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
    width: 76,
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
    textTransform: 'uppercase',
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
    flexDirection: 'row',
    gap: 8,
    height: 56,
    borderRadius: 12,
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
  rtButton: {
    width: 64,
    height: 56,
    borderRadius: 12,
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
    gap: 12,
    paddingRight: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 140,
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
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
  },
  awardTileIcon: {
    fontSize: 32,
  },
  awardTileLabel: {
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  awardWonPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  awardWonText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  awardsSummary: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 18,
    marginTop: 4,
  },
  awardsStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  awardsStatValue: {
    fontWeight: '900',
  },
  awardsStatLabel: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  awardsRaw: {
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
