import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, Image, Share, Alert, Platform } from 'react-native';
import { useBottomNavScroll, useBottomNavVisibility } from '../context/BottomNavVisibilityContext';
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
import { ShareOptionsSheetContent } from './ShareOptionsSheet';
import { TrailerModal } from './TrailerModal';
import { searchPersonByName, fetchPersonFilmography } from '../lib/tmdb';
import { scale, verticalScale, screenHeight } from '../utils/responsive';
import { useBottomSheet } from './StackBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const HERO_HEIGHT = verticalScale(480);

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


// ─── Actor Sheet Content ─────────────────────────────────────────────────────
/**
 * Lightweight filmography peek sheet pushed onto the stack when an actor card
 * is long-pressed. Shows a loading state, then the first 8 credits.
 * "See full filmography" calls onPersonPress to navigate to the full screen.
 */
function ActorFilmographySheetContent({ person, role, colors, typography, radii, onPersonPress, onDismiss }) {
  const [credits, setCredits] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { results } = await fetchPersonFilmography(person.id, person.name, role);
        if (!cancelled) setCredits(results.slice(0, 10));
      } catch {
        if (!cancelled) setError('Could not load filmography.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [person.id, person.name, role]);

  return (
    <View style={{ flex: 1 }}>
      {/* Actor identity row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        {person.profileUrl ? (
          <Image
            source={{ uri: person.profileUrl }}
            style={{ width: 52, height: 52, borderRadius: 26, marginRight: 12 }}
          />
        ) : (
          <View style={{
            width: 52, height: 52, borderRadius: 26, marginRight: 12,
            backgroundColor: (colors?.primaryContainer ?? '#2a2a4a'),
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: colors?.primary ?? '#8888ff', fontWeight: '700' }}>
              {initialsForName(person.name)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
            {person.name}
          </Text>
          {person.roleLabel ? (
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {person.roleLabel}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => {
            onDismiss();
            if (onPersonPress) onPersonPress(person.id, person.name, role);
          }}
          style={{
            paddingHorizontal: 14, paddingVertical: 7,
            borderRadius: 20,
            backgroundColor: (colors?.primary ?? '#6060e0') + '28',
            borderWidth: 1,
            borderColor: (colors?.primary ?? '#6060e0') + '55',
          }}
          accessibilityRole="button"
          accessibilityLabel={`See full filmography for ${person.name}`}
        >
          <Text style={{ color: colors?.primary ?? '#6060e0', fontWeight: '800', fontSize: 12 }}>
            Full →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Credits list */}
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Loading filmography…</Text>
        </View>
      ) : error ? (
        <Text style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</Text>
      ) : credits.length === 0 ? (
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center' }}>No credits found.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {credits.map((item, i) => (
            <View
              key={`${item.tmdbId}-${item.mediaType}-${i}`}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 9,
                borderBottomWidth: i < credits.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <Image
                source={{ uri: item.posterUrl }}
                style={{ width: 36, height: 54, borderRadius: 6, marginRight: 12, backgroundColor: '#111' }}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
                  {[item.year, item.character && `as ${item.character}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Ionicons name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'} size={14} color="rgba(255,255,255,0.3)" />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function ResultView({ result, onBack, onToggleWatchlist, isInWatchlist, onSelectSimilar, onPersonPress, onCompanyPress }) {
  const { theme } = useTheme();
  const { typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const { show: showSheet, dismiss: dismissSheet } = useBottomSheet();
  const shareCardRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { setVisible: setBottomNavVisible } = useBottomNavVisibility();
  const lastOffset = useRef(0);

  const scrollHandler = useRef(
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      {
        useNativeDriver: true,
        listener: (event) => {
          if (!event || !event.nativeEvent || !event.nativeEvent.contentOffset) return;
          const currentOffset = event.nativeEvent.contentOffset.y;
          const diff = currentOffset - lastOffset.current;
          
          const contentSize = event.nativeEvent.contentSize;
          const layoutMeasurement = event.nativeEvent.layoutMeasurement;

          if (contentSize && layoutMeasurement) {
            const contentHeight = contentSize.height;
            const layoutHeight = layoutMeasurement.height;
            const maxOffset = contentHeight - layoutHeight;

            if (currentOffset <= 50) {
              setBottomNavVisible(true);
            } else if (!isNaN(maxOffset) && currentOffset >= maxOffset - 50) {
              setBottomNavVisible(true);
            } else if (Math.abs(diff) > 12) {
              if (diff > 0) {
                setBottomNavVisible(false);
              } else {
                setBottomNavVisible(true);
              }
            }
          } else {
            if (currentOffset <= 50) {
              setBottomNavVisible(true);
            } else if (Math.abs(diff) > 12) {
              if (diff > 0) {
                setBottomNavVisible(false);
              } else {
                setBottomNavVisible(true);
              }
            }
          }
          lastOffset.current = currentOffset;
        }
      }
    )
  ).current;
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
  const [shareCountries, setShareCountries] = useState(null);
  const [showAllCast, setShowAllCast] = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const shareSheetIdRef = useRef(null);

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

  /** Long-press an actor card → push a filmography peek sheet */
  const handleActorLongPress = useCallback((person, role) => {
    if (!person.id) return; // need an ID to fetch filmography
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let sheetId;
    const content = (
      <ActorFilmographySheetContent
        person={person}
        role={role}
        colors={colors}
        typography={typography}
        radii={radii}
        onPersonPress={onPersonPress}
        onDismiss={() => dismissSheet(sheetId)}
      />
    );
    sheetId = showSheet(content, {
      title: `⭐ ${person.name}`,
      size: 'large',
      scrollable: false,
      showCloseButton: true,
      dismissOnBackdrop: true,
    });
  }, [colors, typography, radii, onPersonPress, showSheet, dismissSheet]);

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

  useEffect(() => {
    if (result?.posterUrl) {
      Image.prefetch(result.posterUrl).catch(() => {});
    }
  }, [result?.posterUrl]);

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
    // Dismiss the share options sheet
    if (shareSheetIdRef.current) {
      dismissSheet(shareSheetIdRef.current);
      shareSheetIdRef.current = null;
    }
    setShareCountries(selectedCountries);
    // Wait for ShareCard to re-render and images to load from local cache.
    await new Promise(resolve => setTimeout(resolve, 400));
    await doCapture();
  }, [doCapture, dismissSheet]);

  const handleOpenShareSheet = useCallback(() => {
    const sheetId = showSheet(
      <ShareOptionsSheetContent
        result={result}
        onClose={() => {
          dismissSheet(sheetId);
          shareSheetIdRef.current = null;
        }}
        onShare={handleShareConfirm}
      />,
      {
        title: '🎴 Share Card',
        size: 'large',
        scrollable: true,
        showCloseButton: true,
        dismissOnBackdrop: true,
      }
    );
    shareSheetIdRef.current = sheetId;
  }, [result, showSheet, dismissSheet, handleShareConfirm]);

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
  const franchiseParts = result.isFranchise && result.collection?.parts?.length
    ? result.collection.parts
    : [];
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
          inputRange: [-HERO_HEIGHT, 0, HERO_HEIGHT],
          outputRange: [HERO_HEIGHT, 0, HERO_HEIGHT * 0.22],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: scrollY.interpolate({
          inputRange: [-HERO_HEIGHT, 0, HERO_HEIGHT],
          outputRange: [2.0, 1, 1.05],
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
      <View style={{ position: 'absolute', left: 5000, width: 450, height: 800, overflow: 'hidden' }} pointerEvents="none">
        <ViewShot
          ref={shareCardRef}
          options={{ format: 'png', quality: 1 }}
          style={{ width: 420 }}
        >
          <ShareCard result={result} selectedCountries={shareCountries} themeColors={colors} />
        </ViewShot>
      </View>


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
            backgroundColor: colors.background,
            borderBottomColor: colors.outlineVariant + '33',
            height: 64 + (insets.top || 0),
            paddingTop: insets.top || 0,
          },
        ]}
      >
        {Platform.OS === 'android' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
        ) : (
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
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
        contentInsetAdjustmentBehavior="never"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={styles.heroSection}>
          <Animated.View style={[styles.parallaxArtwork, heroTransform]}>
            <MediaArtwork
              uri={result.posterUrl}
              style={[styles.backdrop, StyleSheet.absoluteFill]}
              resizeMode="contain"
              accessibilityLabel={`${result.title} artwork`}
              title={result.title}
            />
          </Animated.View>
          {/* Gradient scrim — fades smoothly so the image doesn't look cut in two */}
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.scrimTop]}
          />
          {/* Strong bottom gradient to completely obscure the poster's native text and hard lines */}
          <LinearGradient
            colors={['transparent', colors.background + 'B3', colors.background]}
            locations={[0, 0.4, 0.8]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
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
              {result.isFranchise && (
                <View style={[styles.infoPill, styles.ratedBadge]}>
                  <Ionicons name="albums-outline" size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.85)', ...typography.labelSm }]}>
                    {result.franchiseLabel}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.infoPill}
                onPress={handleOpenShareSheet}
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

          {franchiseParts.length > 1 && (
            <View key={`franchise-${result.tmdbId}`} style={styles.section}>
              <View style={styles.franchiseHeader}>
                <View style={[styles.franchiseIcon, { backgroundColor: colors.primaryContainer }]}>
                  <Ionicons name="albums-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.franchiseHeaderText}>
                  <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm, marginBottom: 4 }]}>
                    Franchise
                  </Text>
                  <Text style={[styles.franchiseTitle, { color: colors.onSurface, ...typography.titleMd }]} numberOfLines={2}>
                    {result.collection?.name || `${result.title} ${result.franchiseLabel}`}
                  </Text>
                </View>
                <View style={[styles.franchiseCountBadge, { borderColor: colors.outlineVariant }]}>
                  <Text style={[styles.franchiseCountText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                    {pluralize(franchiseParts.length, 'film')}
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.franchiseScroll}
              >
                {franchiseParts.map((item, index) => {
                  const isCurrentMovie = item.tmdbId === result.tmdbId;
                  return (
                    <TouchableOpacity
                      key={`${result.tmdbId}-${item.tmdbId}`}
                      style={styles.franchiseItem}
                      onPress={() => !isCurrentMovie && onSelectSimilar(item)}
                      disabled={isCurrentMovie}
                      accessibilityRole="button"
                      accessibilityLabel={isCurrentMovie ? `${item.title}, current movie` : `Open details for ${item.title}`}
                      accessibilityState={{ selected: isCurrentMovie }}
                      activeOpacity={0.78}
                    >
                      <View style={[
                        styles.similarPoster,
                        styles.franchisePoster,
                        { borderRadius: radii.md },
                        isCurrentMovie && { borderColor: colors.primary, borderWidth: 2 },
                      ]}>
                        <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} title={item.title} />
                        <View style={[styles.franchiseOrderBadge, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.franchiseOrderText, { color: colors.onPrimary }]}>
                            {index + 1}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.similarTitle, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.franchiseYear, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                        {isCurrentMovie ? `${item.year} · Current` : item.year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

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
                    onLongPress={() => handleActorLongPress(person, 'cast')}
                    delayLongPress={400}
                    accessibilityRole="button"
                    accessibilityLabel={`View filmography for ${person.name}. Long press for a quick preview.`}
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
                    Not listed on Netflix, Prime Video, Max, CBC Gem, BBC iPlayer, Channel 4, ITVX, SBS On Demand, or ABC iview in any supported country right now.
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
    height: 64,
    zIndex: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stickyTitleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 80,
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
  },
  parallaxArtwork: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    height: HERO_HEIGHT + 120,
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
  franchiseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  franchiseIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  franchiseHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  franchiseTitle: {
    fontWeight: '900',
  },
  franchiseCountBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  franchiseCountText: {
    fontWeight: '800',
  },
  franchiseScroll: {
    gap: 12,
    paddingRight: 40,
  },
  franchiseItem: {
    width: scale(120),
  },
  franchisePoster: {
    marginBottom: 8,
  },
  franchiseOrderBadge: {
    alignItems: 'center',
    borderRadius: 4,
    height: 22,
    justifyContent: 'center',
    left: 8,
    position: 'absolute',
    top: 8,
    width: 22,
  },
  franchiseOrderText: {
    fontSize: 12,
    fontWeight: '900',
  },
  franchiseYear: {
    fontWeight: '700',
    marginTop: 2,
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
