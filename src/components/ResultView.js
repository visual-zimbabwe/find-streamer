import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Image,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Image as ExpoImage } from 'expo-image';
import { useBottomNavScroll, useBottomNavVisibility, applyBottomNavScrollVisibility } from '../context/BottomNavVisibilityContext';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
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
import { SoundtrackPickerSheetContent } from './SoundtrackPickerSheet';
import { WhereToWatchSection } from './WhereToWatchSection';
import { searchPersonByName, fetchPersonFilmography } from '../lib/tmdb';
import { openSpotifyAlbum } from '../lib/spotify';
import { parseSoundtracksFromBindings } from '../lib/wikidataSoundtracks';
import {
  formatAwardCounts,
  fetchWikidataAwards,
  parseOmdbAwardsFallback,
} from '../lib/wikidataAwards';
import { scale, verticalScale, screenHeight } from '../utils/responsive';
import { useBottomSheet } from './StackBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonBlock, DetailSkeleton } from './SkeletonLoaders';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { GOLD_ACCENT, GOLD_DIM, FADE_MS, SCROLL_BOTTOM_PAD } from '../theme/programme';
import { ProgrammeEyebrowLabel } from './ProgrammeSectionHeader';

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

function formatRuntime(minutes, mediaType) {
  if (!minutes) return null;
  if (mediaType === 'tv') return `${minutes}m episodes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

const HERO_HEIGHT = verticalScale(480);

function AwardLogoImage({ uri, label, style, fallbackStyle, iconColor }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={fallbackStyle}>
        <Ionicons name="trophy-outline" size={28} color={iconColor} />
      </View>
    );
  }

  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit="contain"
      transition={150}
      onError={() => setFailed(true)}
      accessibilityLabel={`${label} logo`}
    />
  );
}

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

function filmographyRoleForPerson(person) {
  if (person.role === 'creator') return 'tv';
  if (person.role === 'writer') return 'writer';
  if (person.role === 'composer') return 'composer';
  return 'movie';
}

const isEntityUri = (val) =>
  typeof val === 'string' && val.startsWith('http://www.wikidata.org/entity/');

function wikidataIdFromUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const match = uri.match(/\/entity\/(Q\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

async function fetchWikidataDetails(imdbId, tmdbId, mediaType) {
  const clauses = [];
  if (imdbId) {
    clauses.push(`?item wdt:P345 "${imdbId}"`);
  }
  if (tmdbId) {
    if (mediaType === 'tv') {
      clauses.push(`?item wdt:P4985 "${tmdbId}"`);
    } else {
      clauses.push(`?item wdt:P9721 "${tmdbId}"`);
    }
  }

  if (clauses.length === 0)
    return { languages: [], countries: [], basedOn: [], soundtracks: [], awards: [] };

  const unionClause = clauses.map((c) => `{ ${c} }`).join(' UNION ');

  const sparql = `
    SELECT DISTINCT ?item ?languageLabel ?countryLabel ?basedOn ?basedOnLabel ?authorLabel ?typeLabel ?soundtrack ?soundtrackLabel ?spotifyAlbumId ?releaseDate ?cover WHERE {
      ${unionClause} .
      OPTIONAL { ?item wdt:P364 ?language . }
      OPTIONAL { ?item wdt:P495 ?country . }
      OPTIONAL {
        ?item wdt:P144 ?basedOn .
        OPTIONAL { ?basedOn wdt:P50 ?author . }
        OPTIONAL { ?basedOn wdt:P31 ?type . }
      }
      OPTIONAL {
        ?item wdt:P406 ?soundtrack .
        OPTIONAL { ?soundtrack wdt:P2205 ?spotifyAlbumId . }
        OPTIONAL { ?soundtrack wdt:P577 ?releaseDate . }
        OPTIONAL { ?soundtrack wdt:P18 ?cover . }
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }
  `;

  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;

  const [response, awards] = await Promise.all([
    fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Trova/1.0 (juwimana.database@gmail.com)',
        Accept: 'application/sparql-results+json',
      },
    }),
    fetchWikidataAwards(imdbId, tmdbId, mediaType),
  ]);

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL request failed with status ${response.status}`);
  }

  const json = await response.json();
  const bindings = json?.results?.bindings || [];

  const languagesSet = new Set();
  const countriesSet = new Set();
  const basedOnMap = new Map();

  for (const b of bindings) {
    if (b.languageLabel?.value && !isEntityUri(b.languageLabel.value)) {
      languagesSet.add(b.languageLabel.value);
    }
    if (b.countryLabel?.value && !isEntityUri(b.countryLabel.value)) {
      countriesSet.add(b.countryLabel.value);
    }
    const basedOnUri = b.basedOn?.value;
    if (isEntityUri(basedOnUri) && b.basedOnLabel?.value && !isEntityUri(b.basedOnLabel.value)) {
      const name = b.basedOnLabel.value;
      const id = wikidataIdFromUri(basedOnUri);
      const author =
        b.authorLabel?.value && !isEntityUri(b.authorLabel.value) ? b.authorLabel.value : null;
      const type = b.typeLabel?.value && !isEntityUri(b.typeLabel.value) ? b.typeLabel.value : null;

      if (!basedOnMap.has(basedOnUri)) {
        basedOnMap.set(basedOnUri, { id, name, authors: new Set(), types: new Set() });
      }
      if (author) {
        basedOnMap.get(basedOnUri).authors.add(author);
      }
      if (type) {
        basedOnMap.get(basedOnUri).types.add(type);
      }
    }
  }

  const basedOn = Array.from(basedOnMap.values()).map((data) => ({
    id: data.id,
    name: data.name,
    authors: Array.from(data.authors),
    types: Array.from(data.types),
  }));

  const soundtracks = parseSoundtracksFromBindings(bindings, wikidataIdFromUri);

  return {
    languages: Array.from(languagesSet),
    countries: Array.from(countriesSet),
    basedOn,
    soundtracks,
    awards,
  };
}

const GENERIC_TYPES = new Set([
  'literary work',
  'written work',
  'creative work',
  'work',
  'media franchise',
  'intellectual property',
]);

function getSpecificType(types) {
  if (!types || types.length === 0) return null;
  const specific = types.find((t) => !GENERIC_TYPES.has(t.toLowerCase()));
  return specific || types[0];
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Actor Sheet Content ─────────────────────────────────────────────────────
/**
 * Lightweight filmography peek sheet pushed onto the stack when an actor card
 * is long-pressed. Shows a loading state, then the first 8 credits.
 * "See full filmography" calls onPersonPress to navigate to the full screen.
 */
function ActorFilmographySheetContent({
  person,
  role,
  colors,
  typography,
  radii,
  onPersonPress,
  onDismiss,
}) {
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
    return () => {
      cancelled = true;
    };
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
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              marginRight: 12,
              backgroundColor: GOLD_ACCENT + '18',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: GOLD_ACCENT, fontWeight: '700' }}>
              {initialsForName(person.name)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
            {person.name}
          </Text>
          {person.roleLabel ? (
            <Text
              style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}
              numberOfLines={1}
            >
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
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
            backgroundColor: GOLD_ACCENT + '18',
            borderWidth: 1,
            borderColor: GOLD_DIM,
          }}
          accessibilityRole="button"
          accessibilityLabel={`See full filmography for ${person.name}`}
        >
          <Text style={{ color: GOLD_ACCENT, fontWeight: '800', fontSize: 12 }}>
            Full →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Credits list */}
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            Loading filmography…
          </Text>
        </View>
      ) : error ? (
        <Text style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</Text>
      ) : credits.length === 0 ? (
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center' }}>
          No credits found.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {credits.map((item, i) => (
            <View
              key={`${item.tmdbId}-${item.mediaType}-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 9,
                borderBottomWidth: i < credits.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <Image
                source={{ uri: item.posterUrl }}
                style={{
                  width: 36,
                  height: 54,
                  borderRadius: 6,
                  marginRight: 12,
                  backgroundColor: '#111',
                }}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
                  {[item.year, item.character && `as ${item.character}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Ionicons
                name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
                size={14}
                color="rgba(255,255,255,0.3)"
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function ResultView({
  result,
  loading = false,
  onBack,
  onToggleWatchlist,
  onEnrichWatchlistItem,
  isInWatchlist,
  onSelectSimilar,
  onPersonPress,
  onCompanyPress,
}) {
  const { theme } = useTheme();
  const { typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const { show: showSheet, dismiss: dismissSheet } = useBottomSheet();
  const shareCardRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { setVisible: setBottomNavVisible } = useBottomNavVisibility();
  const lastOffset = useRef(0);

  const scrollHandler = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
      listener: (event) => {
        if (!event || !event.nativeEvent || !event.nativeEvent.contentOffset) return;
        const currentOffset = event.nativeEvent.contentOffset.y;
        lastOffset.current = applyBottomNavScrollVisibility({
          currentOffset,
          lastOffset: lastOffset.current,
          contentSize: event.nativeEvent.contentSize,
          layoutMeasurement: event.nativeEvent.layoutMeasurement,
          setVisible: setBottomNavVisible,
        });
      },
    }),
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
  const reduceMotion = useReduceMotion();
  const shareSheetIdRef = useRef(null);

  // ── Wikidata enrichment state ────────────────────────────────────────────
  const [wikiData, setWikiData] = useState({
    languages: [],
    countries: [],
    basedOn: null,
    soundtracks: [],
    awards: [],
  });
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiError, setWikiError] = useState(false);
  const [wikiRetryToken, setWikiRetryToken] = useState(0);

  // ── Dynamic poster palette ───────────────────────────────────────────────
  const { palette } = usePosterTheme(result?.posterUrl);
  // Merge poster palette over base theme; fall back gracefully
  const colors = palette ?? theme.colors;

  // Fade in when palette arrives so the color shift feels smooth
  const paletteOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) {
      paletteOpacity.setValue(1);
      return;
    }
    paletteOpacity.setValue(0.3);
    Animated.timing(paletteOpacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [palette, paletteOpacity, reduceMotion]);

  useEffect(() => {
    setShowAllCast(false);
    setIsSynopsisExpanded(false);
    setWikiData({ languages: [], countries: [], basedOn: null, soundtracks: [], awards: [] });
    setWikiLoading(false);
    setWikiError(false);
  }, [result?.tmdbId]);

  // ── Wikidata SPARQL fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!result?.tmdbId) return;

    const hasCachedEnrichment = result.wikidataEnriched === true || result.basedOn !== undefined;
    const hasCachedSoundtracks = Array.isArray(result.soundtracks);
    const hasCachedAwards = Array.isArray(result.awards);
    if (hasCachedEnrichment && hasCachedSoundtracks && hasCachedAwards) {
      setWikiData({
        languages: Array.isArray(result.originalLanguage) ? result.originalLanguage : [],
        countries: Array.isArray(result.countryOfOrigin) ? result.countryOfOrigin : [],
        basedOn: Array.isArray(result.basedOn) ? result.basedOn : [],
        soundtracks: result.soundtracks,
        awards: result.awards,
      });
      setWikiLoading(false);
      setWikiError(false);
      return;
    }

    let cancelled = false;
    setWikiLoading(true);
    setWikiError(false);

    fetchWikidataDetails(result.imdbId, String(result.tmdbId), result.mediaType)
      .then((data) => {
        if (cancelled) return;
        setWikiData(data);
        setWikiLoading(false);

        if (onEnrichWatchlistItem && isInWatchlist) {
          onEnrichWatchlistItem(result.tmdbId, result.mediaType, {
            originalLanguage: data.languages,
            countryOfOrigin: data.countries,
            basedOn: data.basedOn,
            soundtracks: data.soundtracks,
            awards: data.awards,
            wikidataEnriched: true,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWikiLoading(false);
          setWikiError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    result?.tmdbId,
    result?.imdbId,
    result?.mediaType,
    result?.originalLanguage,
    result?.countryOfOrigin,
    result?.basedOn,
    result?.soundtracks,
    result?.awards,
    result?.wikidataEnriched,
    onEnrichWatchlistItem,
    isInWatchlist,
    wikiRetryToken,
  ]);

  const handleBasedOnPress = useCallback((work) => {
    if (!work?.id) return;
    Haptics.selectionAsync();
    Linking.openURL(`https://www.wikidata.org/wiki/${work.id}`);
  }, []);

  const handleAwardPress = useCallback((award) => {
    if (!award?.wikidataId) return;
    Haptics.selectionAsync();
    Linking.openURL(`https://www.wikidata.org/wiki/${award.wikidataId}`);
  }, []);

  const displayAwards = useMemo(() => {
    if (wikiData.awards?.length) {
      return wikiData.awards;
    }

    if (wikiLoading) {
      return [];
    }

    return parseOmdbAwardsFallback(result?.omdbRatings?.awards);
  }, [wikiData.awards, wikiLoading, result?.omdbRatings?.awards]);

  const handleWikiRetry = useCallback(() => {
    Haptics.selectionAsync();
    setWikiError(false);
    setWikiRetryToken((token) => token + 1);
  }, []);

  const playableSoundtracks = useMemo(
    () => (wikiData.soundtracks || []).filter((soundtrack) => soundtrack.spotifyAlbumId),
    [wikiData.soundtracks],
  );

  const handleSoundtrackPress = useCallback(() => {
    if (!playableSoundtracks.length) return;

    Haptics.selectionAsync();

    if (playableSoundtracks.length === 1) {
      openSpotifyAlbum(playableSoundtracks[0].spotifyAlbumId);
      return;
    }

    let sheetId;
    const content = (
      <SoundtrackPickerSheetContent
        soundtracks={playableSoundtracks}
        colors={colors}
        typography={typography}
        onSelect={(soundtrack) => openSpotifyAlbum(soundtrack.spotifyAlbumId)}
        onDismiss={() => dismissSheet(sheetId)}
      />
    );
    sheetId = showSheet(content, {
      title: 'Choose Soundtrack',
      size: 'large',
      scrollable: false,
      showCloseButton: true,
      dismissOnBackdrop: true,
    });
  }, [playableSoundtracks, colors, typography, showSheet, dismissSheet]);

  const handlePersonPressWithFallback = useCallback(
    async (person, role) => {
      if (!onPersonPress) return;

      if (person.id) {
        onPersonPress(person.id, person.name, role);
        return;
      }

      // Fallback: search for the person by name to get their TMDB ID
      try {
        Haptics.selectionAsync();
        const found = await searchPersonByName(person.name);
        if (found && found.id) {
          onPersonPress(found.id, person.name, role);
        } else {
          Alert.alert(
            'Person Not Found',
            `We couldn't find a filmography for "${person.name}" on TMDb.`,
          );
        }
      } catch (err) {
        Alert.alert(
          'Search Failed',
          'Unable to search for this person. Please check your connection.',
        );
      }
    },
    [onPersonPress],
  );

  /** Long-press an actor card → push a filmography peek sheet */
  const handleActorLongPress = useCallback(
    (person, role) => {
      if (!person.id) return; // need an ID to fetch filmography
      Haptics.selectionAsync();
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
    },
    [colors, typography, radii, onPersonPress, showSheet, dismissSheet],
  );

  useEffect(() => {
    if (reduceMotion) return undefined;
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
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [meshShift, reduceMotion]);

  useEffect(() => {
    const heroUri = result?.backdropUrl || result?.posterUrl;
    if (heroUri) {
      Image.prefetch(heroUri).catch(() => {});
    }
  }, [result?.backdropUrl, result?.posterUrl]);

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
        toastiva.success('Shared successfully');
      } else {
        await Share.share({
          message: `Check out "${result?.title}" (${result?.year}) – ${result?.genres || 'Unknown Genre'}`,
        });
        toastiva.success('Shared successfully');
      }
    } catch (err) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Share failed', 'Unable to generate the share card. Please try again.');
      }
    }
  }, [result]);

  const handleShareConfirm = useCallback(
    async (selectedCountries) => {
      // Dismiss the share options sheet
      if (shareSheetIdRef.current) {
        dismissSheet(shareSheetIdRef.current);
        shareSheetIdRef.current = null;
      }
      setShareCountries(selectedCountries);
      // Wait for ShareCard to re-render and images to load from local cache.
      await new Promise((resolve) => setTimeout(resolve, 400));
      await doCapture();
    },
    [doCapture, dismissSheet],
  );

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
        scrollable: false,
        showCloseButton: true,
        dismissOnBackdrop: true,
      },
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

    const directorPeople =
      current.mediaType === 'tv'
        ? (current.createdByPersons || []).map((person) => ({
            ...person,
            role: 'creator',
            roleLabel: 'Creator',
          }))
        : (current.directorPersons?.length
            ? current.directorPersons
            : current.directorId && hasValue(current.director)
              ? [{ id: current.directorId, name: current.director }]
              : []
          ).map((person) => ({
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

    const composerPeople = (current.composerPersons || []).map((person) => ({
      ...person,
      role: 'composer',
      roleLabel: 'Composer',
    }));

    return {
      crewPeople: [...directorPeople, ...writerPeople, ...composerPeople],
      castPeople,
    };
  }, [result]);

  if (loading || !result) {
    return <DetailSkeleton />;
  }

  const isTv = result.mediaType === 'tv';
  const seasonCount = result.numberOfSeasons || result.seasons?.length || 0;
  const hasSeasonDetails =
    isTv && ((result.seasons?.length ?? 0) > 0 || Boolean(result.runtimeMinutes));
  const runtimeLabel = formatRuntime(result.runtimeMinutes, result.mediaType);
  const hasRating = hasValue(result.rating);
  const hasGenres = hasValue(result.genres);
  const hasPeople = peopleSections.crewPeople.length > 0 || peopleSections.castPeople.length > 0;
  const visibleCastPeople = showAllCast
    ? peopleSections.castPeople
    : peopleSections.castPeople.slice(0, 10);
  const remainingCastCount = Math.max(
    peopleSections.castPeople.length - visibleCastPeople.length,
    0,
  );
  const hasAvailabilityData = Array.isArray(result.rows);
  const franchiseParts =
    result.isFranchise && result.collection?.parts?.length ? result.collection.parts : [];
  const displaySynopsis =
    result.synopsis && result.synopsis !== 'No synopsis available.'
      ? result.synopsis
      : result.omdbRatings?.plot || result.synopsis || 'No synopsis available.';
  const meshColors = colors.meshColors || [
    GOLD_ACCENT,
    colors.surfaceContainerHighest,
    colors.surfaceContainer,
    colors.background,
  ];
  const heroArtUri = result.backdropUrl || result.posterUrl;
  const heroTransform = reduceMotion
    ? {}
    : {
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
  const heroContentMotion = reduceMotion
    ? {}
    : {
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
      <View
        style={{ position: 'absolute', left: 5000, width: 450, height: 800, overflow: 'hidden' }}
        pointerEvents="none"
      >
        <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }} style={{ width: 420 }}>
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
            borderBottomColor: GOLD_DIM,
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
        removeClippedSubviews={Platform.OS === 'android'}
      >
        <View style={styles.heroSection}>
          <Animated.View style={[styles.parallaxArtwork, heroTransform]}>
            <MediaArtwork
              uri={heroArtUri}
              style={[styles.backdrop, StyleSheet.absoluteFill]}
              resizeMode={result.backdropUrl ? 'cover' : 'contain'}
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
                  <Text
                    style={[styles.genreText, { color: '#ffffff', ...typography.labelSm }]}
                    numberOfLines={1}
                  >
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
                      Haptics.selectionAsync();
                      Linking.openURL(
                        `https://www.themoviedb.org/${result.mediaType === 'tv' ? 'tv' : 'movie'}/${result.tmdbId}`,
                      );
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
                      Haptics.selectionAsync();
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
                      Haptics.selectionAsync();
                      Linking.openURL(
                        `https://www.rottentomatoes.com/search?search=${encodeURIComponent(result.title || '')}`,
                      );
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
                      Haptics.selectionAsync();
                      Linking.openURL(
                        `https://www.metacritic.com/search/all/${encodeURIComponent(result.title || '')}/results`,
                      );
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
            <Text style={[styles.title, { color: '#ffffff', ...typography.displayLg }]}>
              {result.title}
            </Text>

            {/* Watch Trailer full-width button */}
            {result.trailer && result.trailer !== 'N/A' && (
              <TouchableOpacity
                style={[styles.trailerButton, { backgroundColor: GOLD_ACCENT }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTrailerVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Watch trailer for ${result.title}`}
              >
                <Ionicons name="play" size={18} color="#141414" style={{ marginRight: 6 }} />
                <Text
                  style={[styles.trailerButtonText, { color: '#141414', ...typography.labelLg }]}
                >
                  Watch Trailer
                </Text>
              </TouchableOpacity>
            )}

            {wikiLoading ? (
              <View
                style={[
                  styles.trailerButton,
                  styles.soundtrackSkeleton,
                  { backgroundColor: 'rgba(255,255,255,0.12)' },
                ]}
              >
                <SkeletonBlock width="62%" height={16} borderRadius={8} />
              </View>
            ) : playableSoundtracks.length === 1 ? (
              <TouchableOpacity
                style={[styles.trailerButton, { backgroundColor: GOLD_ACCENT }]}
                onPress={handleSoundtrackPress}
                accessibilityRole="button"
                accessibilityLabel={`Play ${playableSoundtracks[0].title} on Spotify`}
              >
                <FontAwesome5 name="spotify" size={18} color="#141414" style={{ marginRight: 6 }} />
                <Text
                  style={[styles.trailerButtonText, { color: '#141414', ...typography.labelLg }]}
                  numberOfLines={1}
                >
                  {playableSoundtracks[0].title}
                </Text>
              </TouchableOpacity>
            ) : playableSoundtracks.length > 1 ? (
              <TouchableOpacity
                style={[styles.trailerButton, { backgroundColor: GOLD_ACCENT }]}
                onPress={handleSoundtrackPress}
                accessibilityRole="button"
                accessibilityLabel={`Choose soundtrack for ${result.title}`}
              >
                <FontAwesome5 name="spotify" size={18} color="#141414" style={{ marginRight: 6 }} />
                <Text
                  style={[styles.trailerButtonText, { color: '#141414', ...typography.labelLg }]}
                >
                  {`Choose Soundtrack (${playableSoundtracks.length})`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Info Row ScrollView with Gradient Fade */}
            <View style={styles.infoRowContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.infoRowScroll}
              >
                <View style={styles.infoPill}>
                  <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.75)" />
                  <Text
                    style={[
                      styles.infoText,
                      { color: 'rgba(255,255,255,0.75)', ...typography.labelSm },
                    ]}
                  >
                    {result.year}
                  </Text>
                </View>
                {isTv && seasonCount > 0 && (
                  <View style={styles.infoPill}>
                    <Ionicons name="tv-outline" size={14} color="rgba(255,255,255,0.75)" />
                    <Text
                      style={[
                        styles.infoText,
                        { color: 'rgba(255,255,255,0.75)', ...typography.labelSm },
                      ]}
                    >
                      {pluralize(seasonCount, 'season')}
                    </Text>
                  </View>
                )}
                {!isTv && runtimeLabel && (
                  <View style={styles.infoPill}>
                    <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.75)" />
                    <Text
                      style={[
                        styles.infoText,
                        { color: 'rgba(255,255,255,0.75)', ...typography.labelSm },
                      ]}
                    >
                      {runtimeLabel}
                    </Text>
                  </View>
                )}
                {result.omdbRatings?.rated && (
                  <View style={[styles.infoPill, styles.ratedBadge]}>
                    <Text
                      style={[
                        styles.infoText,
                        { color: 'rgba(255,255,255,0.85)', ...typography.labelSm },
                      ]}
                    >
                      {result.omdbRatings.rated}
                    </Text>
                  </View>
                )}
                {result.isFranchise && (
                  <View style={[styles.infoPill, styles.ratedBadge]}>
                    <Ionicons name="albums-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text
                      style={[
                        styles.infoText,
                        { color: 'rgba(255,255,255,0.85)', ...typography.labelSm },
                      ]}
                    >
                      {result.franchiseLabel}
                    </Text>
                  </View>
                )}

                {/* Wikidata Language and Country pills */}
                {wikiLoading ? (
                  <>
                    <View style={[styles.infoPill, styles.skeletonPill]}>
                      <SkeletonBlock width={50} height={12} borderRadius={6} />
                    </View>
                    <View style={[styles.infoPill, styles.skeletonPill]}>
                      <SkeletonBlock width={60} height={12} borderRadius={6} />
                    </View>
                  </>
                ) : (
                  <>
                    {wikiData.languages && wikiData.languages.length > 0 && (
                      <View style={styles.infoPill}>
                        <Ionicons
                          name="language-outline"
                          size={14}
                          color="rgba(255,255,255,0.75)"
                        />
                        <Text
                          style={[
                            styles.infoText,
                            { color: 'rgba(255,255,255,0.75)', ...typography.labelSm },
                          ]}
                        >
                          {wikiData.languages.join(', ')}
                        </Text>
                      </View>
                    )}
                    {wikiData.countries && wikiData.countries.length > 0 && (
                      <View style={styles.infoPill}>
                        <Ionicons name="globe-outline" size={14} color="rgba(255,255,255,0.75)" />
                        <Text
                          style={[
                            styles.infoText,
                            { color: 'rgba(255,255,255,0.75)', ...typography.labelSm },
                          ]}
                        >
                          {wikiData.countries.join(', ')}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>

              <LinearGradient
                colors={['transparent', colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.infoFadeOverlay}
                pointerEvents="none"
              />
            </View>
          </Animated.View>
        </View>

        <View
          style={[
            styles.detailsContent,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + SCROLL_BOTTOM_PAD },
          ]}
        >
          <View pointerEvents="none" style={styles.meshBackdrop}>
            <LinearGradient
              colors={[
                colors.background,
                meshColors[3] || colors.surfaceContainer,
                colors.background,
              ]}
              locations={[0, 0.48, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[styles.meshOrb, styles.meshOrbA, meshA]} />
            <Animated.View style={[styles.meshOrb, styles.meshOrbB, meshB]} />
            <Animated.View style={[styles.meshOrb, styles.meshOrbC, meshC]} />
            <View style={[styles.meshVeil, { backgroundColor: colors.background + 'D9' }]} />
          </View>

          <View style={styles.section}>
            <ProgrammeEyebrowLabel eyebrow="Synopsis" />
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
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

          {/* Availability leads the detail stack — it is the question the app exists to answer */}
          {hasAvailabilityData && (
            <WhereToWatchSection
              key={`where-to-watch-${result.tmdbId}`}
              rows={result.rows}
              providerSummary={result.providerSummary}
              confidence={result.providerAvailabilityConfidence}
              isTv={isTv}
              colors={colors}
              typography={typography}
            />
          )}

          {/* Based On Section */}
          {wikiLoading ? (
            <View style={styles.section}>
              <ProgrammeEyebrowLabel eyebrow="Based On" />
              <View style={styles.basedOnContainer}>
                <View
                  style={[
                    styles.basedOnCard,
                    {
                      backgroundColor: colors.surfaceContainer,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <SkeletonBlock style={{ width: 140, height: 16, borderRadius: 4 }} />
                </View>
              </View>
            </View>
          ) : wikiError ? (
            <View style={styles.section}>
              <ProgrammeEyebrowLabel eyebrow="Based On" />
              <TouchableOpacity
                onPress={handleWikiRetry}
                style={[styles.basedOnRetry, { borderColor: colors.outlineVariant }]}
                accessibilityRole="button"
                accessibilityLabel="Retry loading source material"
              >
                <Ionicons name="refresh-outline" size={16} color={colors.onSurfaceVariant} />
                <Text
                  style={[
                    styles.basedOnRetryText,
                    { color: colors.onSurfaceVariant, ...typography.bodyMd },
                  ]}
                >
                  Couldn&apos;t load source material. Tap to retry.
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            wikiData.basedOn &&
            wikiData.basedOn.length > 0 && (
              <View style={styles.section}>
                <ProgrammeEyebrowLabel eyebrow="Based On" />
                <View style={styles.basedOnContainer}>
                  {wikiData.basedOn.map((work, idx) => {
                    const authorText =
                      work.authors && work.authors.length > 0
                        ? ` by ${work.authors.join(', ')}`
                        : '';
                    const specificType = getSpecificType(work.types);
                    const typeLabel = specificType ? capitalize(specificType) : '';
                    const cardContent = (
                      <>
                        <Text
                          style={[
                            styles.basedOnText,
                            { color: colors.onSurface, ...typography.bodyMd },
                          ]}
                          numberOfLines={2}
                        >
                          {typeLabel ? (
                            <Text style={{ color: GOLD_ACCENT, fontWeight: '700' }}>
                              {typeLabel}:{' '}
                            </Text>
                          ) : null}
                          <Text style={{ fontWeight: 'bold' }}>{work.name}</Text>
                          {authorText}
                        </Text>
                        {work.id ? (
                          <Ionicons name="open-outline" size={16} color={colors.onSurfaceVariant} />
                        ) : null}
                      </>
                    );
                    const cardStyle = [
                      styles.basedOnCard,
                      {
                        backgroundColor: colors.surfaceContainer,
                        borderColor: colors.outlineVariant,
                      },
                    ];
                    return work.id ? (
                      <TouchableOpacity
                        key={work.id}
                        style={cardStyle}
                        onPress={() => handleBasedOnPress(work)}
                        activeOpacity={0.78}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${work.name} on Wikidata`}
                      >
                        {cardContent}
                      </TouchableOpacity>
                    ) : (
                      <View key={`based-on-${idx}`} style={cardStyle}>
                        {cardContent}
                      </View>
                    );
                  })}
                </View>
              </View>
            )
          )}

          {franchiseParts.length > 1 && (
            <View key={`franchise-${result.tmdbId}`} style={styles.section}>
              <View style={styles.franchiseHeader}>
                <View style={[styles.franchiseIcon, { backgroundColor: GOLD_ACCENT + '18' }]}>
                  <Ionicons name="albums-outline" size={20} color={GOLD_ACCENT} />
                </View>
                <View style={styles.franchiseHeaderText}>
                  <Text
                    style={[
                      styles.sectionLabel,
                      { color: colors.onSurfaceVariant, ...typography.labelSm, marginBottom: 4 },
                    ]}
                  >
                    Franchise
                  </Text>
                  <Text
                    style={[
                      styles.franchiseTitle,
                      { color: colors.onSurface, ...typography.titleMd },
                    ]}
                    numberOfLines={2}
                  >
                    {result.collection?.name || `${result.title} ${result.franchiseLabel}`}
                  </Text>
                </View>
                <View style={[styles.franchiseCountBadge, { borderColor: colors.outlineVariant }]}>
                  <Text
                    style={[
                      styles.franchiseCountText,
                      { color: colors.onSurfaceVariant, ...typography.labelSm },
                    ]}
                  >
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
                      accessibilityLabel={
                        isCurrentMovie
                          ? `${item.title}, current movie`
                          : `Open details for ${item.title}`
                      }
                      accessibilityState={{ selected: isCurrentMovie }}
                      activeOpacity={0.78}
                    >
                      <View
                        style={[
                          styles.similarPoster,
                          styles.franchisePoster,
                          { borderRadius: radii.md },
                          isCurrentMovie && { borderColor: GOLD_ACCENT, borderWidth: 2 },
                        ]}
                      >
                        <MediaArtwork
                          uri={item.posterUrl}
                          style={styles.poster}
                          accessibilityLabel={`${item.title} poster`}
                          title={item.title}
                          instant
                        />
                        <View
                          style={[styles.franchiseOrderBadge, { backgroundColor: GOLD_ACCENT }]}
                        >
                          <Text style={[styles.franchiseOrderText, { color: '#141414' }]}>
                            {index + 1}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.similarTitle,
                          { color: colors.onSurface, ...typography.bodyMd },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.franchiseYear,
                          { color: colors.onSurfaceVariant, ...typography.labelSm },
                        ]}
                      >
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
                    <Ionicons name="timer-outline" size={22} color={GOLD_ACCENT} />
                    <Text
                      style={[
                        styles.seriesStatValue,
                        { color: colors.onSurface, ...typography.titleLg },
                      ]}
                    >
                      {`${result.runtimeMinutes}m`}
                    </Text>
                    <Text
                      style={[
                        styles.seriesStatLabel,
                        { color: colors.onSurfaceVariant, ...typography.labelSm },
                      ]}
                    >
                      Avg Length
                    </Text>
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
                      <MediaArtwork
                        uri={season.posterUrl}
                        style={styles.seasonPoster}
                        accessibilityLabel={`${season.name} poster`}
                        title={season.name}
                        icon="tv-outline"
                        instant
                      />
                      <View style={styles.seasonBody}>
                        <Text
                          style={[
                            styles.seasonName,
                            { color: colors.onSurface, ...typography.bodyMd },
                          ]}
                          numberOfLines={2}
                        >
                          {season.name}
                        </Text>
                        <Text
                          style={[
                            styles.seasonMeta,
                            { color: colors.onSurfaceVariant, ...typography.labelSm },
                          ]}
                        >
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
                <ProgrammeEyebrowLabel eyebrow="Cast & Crew" />
                {remainingCastCount > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowAllCast(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${remainingCastCount} more cast members`}
                    style={styles.seeAllButton}
                  >
                    <Text
                      style={[styles.seeAllText, { color: GOLD_ACCENT, ...typography.labelSm }]}
                    >
                      See All
                    </Text>
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
                    onPress={() =>
                      handlePersonPressWithFallback(person, filmographyRoleForPerson(person))
                    }
                    onLongPress={
                      person.role === 'composer' && person.id
                        ? () => handleActorLongPress(person, 'composer')
                        : undefined
                    }
                    delayLongPress={person.role === 'composer' ? 400 : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={
                      person.role === 'composer' && person.id
                        ? `View filmography for ${person.name}. Long press for a quick preview.`
                        : `View work by ${person.name}`
                    }
                    activeOpacity={0.78}
                  >
                    <View
                      style={[
                        styles.avatarRing,
                        !person.profileUrl && { backgroundColor: GOLD_ACCENT + '18' },
                      ]}
                    >
                      {person.profileUrl ? (
                        <MediaArtwork
                          uri={person.profileUrl}
                          style={styles.personAvatar}
                          accessibilityLabel={`${person.name} profile photo`}
                          title={person.name}
                          icon="person-outline"
                          compactFallback
                          instant
                        />
                      ) : (
                        <Text
                          style={[
                            styles.avatarInitials,
                            { color: GOLD_ACCENT, ...typography.labelSm },
                          ]}
                        >
                          {initialsForName(person.name)}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[styles.personName, { color: colors.onSurface, ...typography.bodyMd }]}
                      numberOfLines={2}
                    >
                      {person.name}
                    </Text>
                    <Text
                      style={[
                        styles.personRole,
                        { color: colors.onSurfaceVariant, ...typography.labelSm },
                      ]}
                      numberOfLines={2}
                    >
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
                    <View
                      style={[
                        styles.avatarRing,
                        !person.profileUrl && { backgroundColor: colors.surfaceContainerHigh },
                      ]}
                    >
                      {person.profileUrl ? (
                        <MediaArtwork
                          uri={person.profileUrl}
                          style={styles.personAvatar}
                          accessibilityLabel={`${person.name} profile photo`}
                          title={person.name}
                          icon="person-outline"
                          compactFallback
                          instant
                        />
                      ) : (
                        <Text
                          style={[
                            styles.avatarInitials,
                            { color: colors.onSurface, ...typography.labelSm },
                          ]}
                        >
                          {initialsForName(person.name)}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[styles.personName, { color: colors.onSurface, ...typography.bodyMd }]}
                      numberOfLines={2}
                    >
                      {person.name}
                    </Text>
                    <Text
                      style={[
                        styles.personRole,
                        { color: colors.onSurfaceVariant, ...typography.labelSm },
                      ]}
                      numberOfLines={2}
                    >
                      {person.roleLabel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ─── Awards ──────────────────────────────────────────────────── */}
          {(wikiLoading || displayAwards.length > 0) && (
            <View style={styles.section}>
              <ProgrammeEyebrowLabel eyebrow="Awards & Recognition" />

              {wikiLoading && displayAwards.length === 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.awardsScroll}
                >
                  {[0, 1, 2].map((index) => (
                    <View key={`award-skeleton-${index}`} style={styles.awardTile}>
                      <SkeletonBlock width={86} height={54} borderRadius={8} />
                      <SkeletonBlock width={72} height={12} borderRadius={6} />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.awardsScroll}
                >
                  {displayAwards.map((award) => {
                    const awardKey = award.wikidataId || award.key || award.label;
                    const tile = (
                      <>
                        <AwardLogoImage
                          uri={award.logoUrl}
                          label={award.label}
                          style={styles.awardLogo}
                          fallbackStyle={[
                            styles.awardLogoFallback,
                            { backgroundColor: colors.surfaceContainerHigh },
                          ]}
                          iconColor={GOLD_ACCENT}
                        />
                        <Text
                          style={[
                            styles.awardCountText,
                            { color: colors.onSurface, ...typography.labelSm },
                          ]}
                        >
                          {formatAwardCounts(award)}
                        </Text>
                        <Text
                          style={[
                            styles.awardLabelText,
                            { color: colors.onSurfaceVariant, ...typography.labelSm },
                          ]}
                          numberOfLines={2}
                        >
                          {award.label}
                        </Text>
                      </>
                    );

                    if (award.wikidataId) {
                      return (
                        <TouchableOpacity
                          key={awardKey}
                          style={styles.awardTile}
                          onPress={() => handleAwardPress(award)}
                          activeOpacity={0.78}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${award.label} on Wikidata`}
                        >
                          {tile}
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <View key={awardKey} style={styles.awardTile}>
                        {tile}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {result.productionCompanies && result.productionCompanies.length > 0 && (
            <View style={styles.section}>
              <ProgrammeEyebrowLabel eyebrow="Production Companies" />
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
                      Haptics.selectionAsync();
                      onCompanyPress(company.id, company.name, company.logoUrl);
                    }}
                    disabled={!onCompanyPress}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel={
                      onCompanyPress ? `View titles from ${company.name}` : undefined
                    }
                    accessibilityState={{ disabled: !onCompanyPress }}
                  >
                    <View
                      style={[
                        styles.productionLogoHaloBase,
                        Platform.OS === 'ios'
                          ? styles.productionLogoHaloOuterIos
                          : styles.productionLogoHaloOuterAndroid,
                      ]}
                    >
                      {Platform.OS === 'ios' ? (
                        <View
                          style={[styles.productionLogoHaloBase, styles.productionLogoHaloInnerIos]}
                        >
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

          {/* More From This Cast & Crew */}
          {result.moreFromCastAndCrew && result.moreFromCastAndCrew.length > 0 && (
            <View style={styles.section}>
              <ProgrammeEyebrowLabel eyebrow="More From Cast & Crew" />
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
                      <MediaArtwork
                        uri={item.posterUrl}
                        style={styles.poster}
                        accessibilityLabel={`${item.title} poster`}
                        title={item.title}
                        instant
                      />
                      {item.omdbRatings?.imdbRating && (
                        <View style={[styles.similarRating, { backgroundColor: '#F5C518' }]}>
                          <Text style={{ color: '#000000', fontSize: 10, fontWeight: '800' }}>
                            IMDb {ratingForCard(item.omdbRatings.imdbRating)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.similarTitle,
                        { color: colors.onSurface, ...typography.bodyMd },
                      ]}
                      numberOfLines={1}
                    >
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
              <ProgrammeEyebrowLabel eyebrow="More Like This" />
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
                      <MediaArtwork
                        uri={item.posterUrl}
                        style={styles.poster}
                        accessibilityLabel={`${item.title} poster`}
                        title={item.title}
                        instant
                      />
                      <View style={styles.similarRating}>
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>
                          {ratingForCard(item.rating)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.similarTitle,
                        { color: colors.onSurface, ...typography.bodyMd },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Floating Header Actions */}
      <View
        style={[styles.floatingHeader, { top: (insets.top || 0) + 12 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[
            styles.floatingButton,
            { backgroundColor: colors.surfaceContainerHighest + 'E6' },
          ]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.floatingRightActions}>
          <TouchableOpacity
            style={[
              styles.floatingButton,
              { backgroundColor: colors.surfaceContainerHighest + 'E6' },
            ]}
            onPress={handleOpenShareSheet}
            accessibilityRole="button"
            accessibilityLabel={`Share ${result.title}`}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.onSurface} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.floatingButton,
              { backgroundColor: colors.surfaceContainerHighest + 'E6' },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              if (isInWatchlist) {
                toastiva.info('Already saved — tap to manage');
              } else {
                toastiva.success('Adding to Watchlist…');
              }
              onToggleWatchlist(result);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              isInWatchlist
                ? `Remove ${result.title} from watchlist`
                : `Add ${result.title} to watchlist`
            }
            accessibilityState={{ selected: isInWatchlist }}
          >
            <Ionicons
              name={isInWatchlist ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isInWatchlist ? GOLD_ACCENT : colors.onSurface}
            />
          </TouchableOpacity>
        </View>
      </View>
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
    paddingLeft: 72,
    paddingRight: 120,
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  infoText: {
    fontWeight: '600',
  },
  ratedBadge: {
    borderColor: 'rgba(255,255,255,0.35)',
  },
  detailsContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    position: 'relative',
    overflow: 'hidden',
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
  awardCountText: {
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  awardLabelText: {
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 32,
  },
  awardLogoFallback: {
    width: 86,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  floatingHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    alignItems: 'center',
  },
  floatingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  floatingRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  trailerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: verticalScale(48),
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  trailerButtonText: {
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  soundtrackSkeleton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowContainer: {
    position: 'relative',
    width: '100%',
  },
  infoRowScroll: {
    paddingRight: 32,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoFadeOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 32,
  },
  skeletonPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  basedOnContainer: {
    marginTop: 8,
    gap: 8,
  },
  basedOnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  basedOnText: {
    flex: 1,
    lineHeight: 20,
  },
  basedOnRetry: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  basedOnRetryText: {
    flex: 1,
    lineHeight: 20,
  },
});
