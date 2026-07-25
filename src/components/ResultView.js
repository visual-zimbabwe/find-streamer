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
import { ShareCard, CARD_FORMATS } from './ShareCard';
import { ShareOptionsSheetContent } from './ShareOptionsSheet';
import { TrailerModal } from './TrailerModal';
import { SoundtrackPickerSheetContent } from './SoundtrackPickerSheet';
import { WhereToWatchSection } from './WhereToWatchSection';
import { SeasonDetailSheetContent } from './SeasonDetailSheet';
import { ActorFilmographySheetContent } from './ActorFilmographySheet';
import { PersonCard } from './PersonCard';
import { searchPersonByName } from '../lib/tmdb';
import {
  rottenTomatoesEmoji,
  rottenTomatoesFresh,
  metacriticBadge,
  rottenTomatoesUrl,
  metacriticUrl,
} from '../lib/ratingBadges';
import { openSpotifyAlbum } from '../lib/spotify';
import { parseSoundtracksFromBindings } from '../lib/wikidataSoundtracks';
import {
  formatAwardCounts,
  fetchWikidataAwards,
  parseOmdbAwardsFallback,
} from '../lib/wikidataAwards';
import { scale, verticalScale, screenHeight, screenWidth, scaleFont } from '../utils/responsive';
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

/**
 * "Is it over?" in one phrase. A dated next episode beats the status string —
 * "Returning Series" is true of a show whose next episode is 18 months out and
 * of one airing on Thursday, and only the second is worth acting on.
 */
function formatSeriesStatus(status, nextEpisodeAirDate) {
  if (nextEpisodeAirDate) {
    const parsed = new Date(`${nextEpisodeAirDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return `Next ${parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
  }
  if (!hasValue(status)) return null;
  if (status === 'Returning Series') return 'Returning';
  if (status === 'In Production' || status === 'Planned') return 'In production';
  return status; // Ended, Canceled, Pilot
}

const HERO_HEIGHT = verticalScale(480);
/** Cast/crew rails never render more than this; the rest lives on the full screen. */
const RAIL_PERSON_CAP = 10;
/**
 * Collapsed synopsis clamps to this many rendered lines (not characters, so the
 * break never lands mid-word). A measured overflow past this count is what
 * arms the Read more / Read less toggle.
 */
const SYNOPSIS_COLLAPSED_LINES = 4;

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

function personKey(person, index) {
  return `${person.role || 'person'}-${person.id || person.name}-${index}`;
}

function filmographyRoleForPerson(person) {
  if (person.role === 'creator') return 'tv';
  if (person.role === 'writer') return 'writer';
  if (person.role === 'composer') return 'composer';
  return 'movie';
}

/**
 * TMDb dedupes crew per job, not per person, so a director-writer arrives as two
 * separate entries. Collapse them into one card whose label joins the jobs
 * ("Director · Writer"); the first role wins for filmography routing.
 */
function mergeCrewByPerson(people) {
  const merged = [];
  const indexByKey = new Map();

  for (const person of people) {
    const key = person.id ? `id:${person.id}` : `name:${normalizePersonName(person.name)}`;
    if (!key) continue;

    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, merged.length);
      merged.push({ ...person, roleLabels: [person.roleLabel] });
      continue;
    }

    const existing = merged[existingIndex];
    if (!existing.roleLabels.includes(person.roleLabel)) {
      existing.roleLabels.push(person.roleLabel);
    }
    // Prefer any entry that carries a profile photo.
    if (!existing.profileUrl && person.profileUrl) {
      existing.profileUrl = person.profileUrl;
    }
  }

  return merged.map((person) => ({
    ...person,
    roleLabel: person.roleLabels.join(' · '),
  }));
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

/**
 * A critic score with its scale kept visible ("7.6" + a dimmed "/10"). Four
 * scores on three scales (/10, %, /100) sat unit-less in one row, so a 74
 * Metascore read as if it were comparable to a 7.6. The unit is dimmed, not
 * hidden, so the number still leads.
 */
function ScoreValue({ value, unit, typography }) {
  return (
    <Text style={[styles.heroRatingText, { ...typography.labelSm }]} numberOfLines={1}>
      {value}
      {unit ? <Text style={styles.heroRatingUnit}>{unit}</Text> : null}
    </Text>
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
  onSeeAllPeople,
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
  /** `{ selected, format }` while the share sheet is open; null keeps the capture host unmounted. */
  const [shareDraft, setShareDraft] = useState(null);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  /** True once the synopsis is longer than the collapsed clamp — gates the toggle. */
  const [synopsisOverflows, setSynopsisOverflows] = useState(false);
  /** The first (unclamped) layout pass sets this; later passes are ignored. */
  const [synopsisMeasured, setSynopsisMeasured] = useState(false);
  /** Title-treatment logo failed to load (or none exists) → fall back to text title. */
  const [logoFailed, setLogoFailed] = useState(false);
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
    setIsSynopsisExpanded(false);
    // Re-measure the new title's synopsis from scratch — line counts don't carry over.
    setSynopsisOverflows(false);
    setSynopsisMeasured(false);
    setLogoFailed(false);
    setWikiData({ languages: [], countries: [], basedOn: null, soundtracks: [], awards: [] });
    setWikiLoading(false);
    setWikiError(false);
    // Unmounting the capture host is enough: on the next open, ShareCard's own
    // image-set effect re-reports readiness for the new title.
    setShareDraft(null);
  }, [result?.tmdbId]);

  // ── Hero title-treatment logo (Apple TV / Netflix-style) ─────────────────
  // Size the logo into a fixed vertical band, width-capped to the hero content
  // box. Falls back to the (now line-capped, auto-shrinking) text title below.
  const heroLogo = useMemo(() => {
    const logo = result?.titleLogo;
    if (!logo?.url) return null;
    const maxWidth = screenWidth - 48; // heroContent left+right padding (24 each)
    const maxHeight = verticalScale(84);
    const ar = logo.aspectRatio && logo.aspectRatio > 0 ? logo.aspectRatio : null;
    let width;
    let height;
    if (ar) {
      height = maxHeight;
      width = height * ar;
      if (width > maxWidth) {
        width = maxWidth;
        height = width / ar;
      }
    } else {
      // Unknown ratio — cap the height, let the box width bound it.
      height = maxHeight;
      width = maxWidth;
    }
    return { url: logo.url, width, height };
  }, [result?.titleLogo]);

  // Text-title size, tiered by length. `numberOfLines={3}` caps a title at three
  // lines, but three lines at the full 56px display size (~192dp) is too tall to
  // coexist with the meta stack (genre + ratings strip) in the hero — it gets
  // clipped. Deterministic tiers shrink long titles enough to keep everything on
  // screen, and stay predictable on RN-Android where adjustsFontSizeToFit is
  // flaky with custom fonts. Short titles keep the full editorial 56px.
  const titleFont = useMemo(() => {
    const len = (result?.title || '').length;
    if (len <= 16) return typography.displayLg; // e.g. "Oppenheimer" — full 56px
    if (len <= 40) return { fontSize: scaleFont(34), lineHeight: scaleFont(40) }; // e.g. D&D (39)
    return { fontSize: scaleFont(28), lineHeight: scaleFont(34) };
  }, [result?.title, typography]);

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

  /**
   * The first paint renders the synopsis unclamped, so this layout pass sees the
   * true line count and can decide whether the toggle is warranted. Once measured
   * we stop listening — later passes report the clamped count and would lie.
   */
  const handleSynopsisTextLayout = useCallback(
    (event) => {
      if (synopsisMeasured) return;
      const lineCount = event?.nativeEvent?.lines?.length ?? 0;
      setSynopsisOverflows(lineCount > SYNOPSIS_COLLAPSED_LINES);
      setSynopsisMeasured(true);
    },
    [synopsisMeasured],
  );

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

  /** Tap a season card → peek sheet with that season's own availability */
  const handleSeasonPress = useCallback(
    (season) => {
      Haptics.selectionAsync();
      showSheet(
        <SeasonDetailSheetContent
          season={season}
          seriesTitle={result?.title}
          colors={colors}
          typography={typography}
        />,
        {
          title: season.name,
          size: 'large',
          scrollable: false,
          showCloseButton: true,
          dismissOnBackdrop: true,
        },
      );
    },
    [result?.title, colors, typography, showSheet],
  );

  /** Long-press a cast or crew card → push a filmography peek sheet */
  const handleActorLongPress = useCallback(
    (person, role) => {
      if (!person.id) return; // need an ID to fetch filmography
      Haptics.selectionAsync();
      let sheetId;
      const content = (
        <ActorFilmographySheetContent
          person={person}
          role={role}
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
    [onPersonPress, showSheet, dismissSheet],
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
    const heroUri = result?.heroBackdropUrl || result?.backdropUrl || result?.posterUrl;
    if (heroUri) {
      Image.prefetch(heroUri).catch(() => {});
    }
  }, [result?.heroBackdropUrl, result?.backdropUrl, result?.posterUrl]);

  /**
   * The card reports when its images have settled. Capture used to fire on a
   * fixed 400ms timer, which shot half-painted cards on a cold poster cache and
   * still reported success.
   */
  const cardReadyRef = useRef(false);
  const readyWaitersRef = useRef([]);

  const handleCardReadyChange = useCallback((ready) => {
    cardReadyRef.current = ready;
    if (ready) {
      readyWaitersRef.current.splice(0).forEach((resolve) => resolve(true));
    }
  }, []);

  /** Resolves true when the card is painted, false if we gave up waiting. */
  const waitForCardReady = useCallback((timeoutMs = 4000) => {
    if (cardReadyRef.current) return Promise.resolve(true);
    return new Promise((resolve) => {
      const waiter = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        readyWaitersRef.current = readyWaitersRef.current.filter((w) => w !== waiter);
        resolve(false);
      }, timeoutMs);
      readyWaitersRef.current.push(waiter);
    });
  }, []);

  const handleShareDraftChange = useCallback((draft) => {
    setShareDraft(draft);
  }, []);

  const captureOptions = useMemo(() => {
    const spec = CARD_FORMATS[shareDraft?.format] || CARD_FORMATS.card;
    return { format: 'png', quality: 1, ...(spec.capture || {}) };
  }, [shareDraft?.format]);

  /**
   * @returns {Promise<boolean>} true only when the OS actually told us the
   * share completed. `shareAsync` resolves whether the user sent the card or
   * dismissed the picker, so on that path we know nothing and say nothing —
   * the old unconditional "Shared successfully" was a claim we couldn't make.
   */
  const deliverShare = useCallback(
    async (uri) => {
      const canShare = await ExpoSharing.isAvailableAsync();
      if (canShare) {
        await ExpoSharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Check out ${result?.title}`,
          UTI: 'public.png',
        });
        return false;
      }
      const outcome = await Share.share({
        message: `Check out "${result?.title}" (${result?.year}) – ${result?.genres || 'Unknown Genre'}`,
      });
      return outcome?.action === Share.sharedAction;
    },
    [result],
  );

  const handleShareConfirm = useCallback(async () => {
    if (!shareCardRef.current) {
      Alert.alert('Share failed', 'The share card is not ready yet. Please try again.');
      return;
    }

    const painted = await waitForCardReady();
    if (!painted) {
      // Better to say so than to ship a PNG with holes in it.
      Alert.alert(
        'Share failed',
        'Artwork for the card is still loading. Check your connection and try again.',
      );
      return;
    }
    // Let the committed tree paint before asking the native view to draw itself.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    let uri;
    try {
      uri = await shareCardRef.current.capture();
    } catch {
      Alert.alert('Share failed', 'Unable to generate the share card. Please try again.');
      return;
    }

    // Hand off only once there is something real to hand off.
    if (shareSheetIdRef.current) {
      dismissSheet(shareSheetIdRef.current);
      shareSheetIdRef.current = null;
    }

    try {
      const confirmed = await deliverShare(uri);
      if (confirmed) toastiva.success('Shared successfully');
    } catch (err) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Share failed', 'Unable to share the card. Please try again.');
      }
    }
  }, [waitForCardReady, deliverShare, dismissSheet]);

  const handleOpenShareSheet = useCallback(() => {
    const sheetId = showSheet(
      <ShareOptionsSheetContent
        result={result}
        cardColors={colors}
        onShare={handleShareConfirm}
        onDraftChange={handleShareDraftChange}
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
  }, [result, colors, showSheet, handleShareConfirm, handleShareDraftChange]);

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
      crewPeople: mergeCrewByPerson([...directorPeople, ...writerPeople, ...composerPeople]),
      castPeople,
    };
  }, [result]);

  /** Hand the full credit list to the dedicated screen — never expand in place. */
  const handleSeeAllPeople = useCallback(() => {
    if (!onSeeAllPeople) return;
    Haptics.selectionAsync();
    onSeeAllPeople({
      title: result?.title,
      cast: peopleSections.castPeople.map((person) => ({
        ...person,
        filmographyRole: 'cast',
      })),
      crew: peopleSections.crewPeople.map((person) => ({
        ...person,
        filmographyRole: filmographyRoleForPerson(person),
      })),
    });
  }, [onSeeAllPeople, result?.title, peopleSections]);

  if (loading || !result) {
    return <DetailSkeleton />;
  }

  const isTv = result.mediaType === 'tv';
  const seasonCount = result.numberOfSeasons || result.seasons?.length || 0;
  /** Seasons is a rail, not a stats card — without seasons it has nothing to say. */
  const hasSeasonDetails = isTv && (result.seasons?.length ?? 0) > 0;
  const runtimeLabel = formatRuntime(result.runtimeMinutes, result.mediaType);
  // Only worth marking when there's something to distinguish it from.
  const latestSeasonNumber =
    hasSeasonDetails && result.seasons.length > 1
      ? Math.max(...result.seasons.map((season) => season.seasonNumber || 0))
      : null;
  const seasonSummaryLine = hasSeasonDetails
    ? [
        pluralize(seasonCount, 'season'),
        result.numberOfEpisodes ? pluralize(result.numberOfEpisodes, 'episode') : null,
        runtimeLabel,
        formatSeriesStatus(result.seriesStatus, result.nextEpisodeAirDate),
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  const hasRating = hasValue(result.rating);
  const hasGenres = hasValue(result.genres);
  /** Metacritic tile colored by its own thresholds (green/yellow/red), not fixed green. */
  const metaBadge = result.omdbRatings?.metascore
    ? metacriticBadge(result.omdbRatings.metascore)
    : null;
  const totalPeopleCount = peopleSections.crewPeople.length + peopleSections.castPeople.length;
  /** Rails stay capped; the full list is a destination, not an expansion. */
  const visibleCastPeople = peopleSections.castPeople.slice(0, RAIL_PERSON_CAP);
  const visibleCrewPeople = peopleSections.crewPeople.slice(0, RAIL_PERSON_CAP);
  const hasMorePeople =
    Boolean(onSeeAllPeople) &&
    (peopleSections.castPeople.length > visibleCastPeople.length ||
      peopleSections.crewPeople.length > visibleCrewPeople.length);
  const seeAllPeopleButton = hasMorePeople ? (
    <TouchableOpacity
      onPress={handleSeeAllPeople}
      accessibilityRole="button"
      accessibilityLabel={`See all ${totalPeopleCount} cast and crew`}
      style={styles.seeAllButton}
    >
      <Text style={[styles.seeAllText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
        {`See All ${totalPeopleCount}`}
      </Text>
    </TouchableOpacity>
  ) : null;
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
  // Prefer the curated textless still (pickHeroBackdrop), then TMDb's default
  // backdrop, then the poster. `usingPoster` = no backdrop of any kind, so the
  // poster (which always carries the title) is the hero — in which case we suppress
  // our own title overlay below to avoid double-titling.
  const heroBackdrop = result.heroBackdropUrl || result.backdropUrl;
  const heroArtUri = heroBackdrop || result.posterUrl;
  const usingPoster = !heroBackdrop && !!result.posterUrl;
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
      {/* Off-screen capture host — mounted only while the share sheet is open.
          Deliberately unsized: the old 450×800 clipping box silently guillotined
          the footer (QR included) off provider-heavy cards. */}
      {shareDraft ? (
        <View style={styles.shareCaptureHost} pointerEvents="none">
          <ViewShot ref={shareCardRef} options={captureOptions}>
            {/* Keyed by format: the two layouts are different trees, but React
                reconciles them positionally and reuses the already-loaded
                provider <Image>s, which then never re-fire onLoadEnd and leave
                readiness stuck. A real remount makes the load events honest. */}
            <ShareCard
              key={shareDraft.format}
              result={result}
              selectedCountries={shareDraft.selected}
              format={shareDraft.format}
              themeColors={colors}
              onReadyChange={handleCardReadyChange}
            />
          </ViewShot>
        </View>
      ) : null}

      <TrailerModal
        visible={trailerVisible}
        trailerUrl={result?.trailer}
        candidates={result?.trailerCandidates}
        trailerType={result?.trailerType}
        posterUrl={result?.heroBackdropUrl || result?.backdropUrl || result?.posterUrl}
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
              resizeMode={heroBackdrop ? 'cover' : 'contain'}
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

          <Animated.View
            style={[styles.heroContent, { top: (insets.top || 0) + 52 }, heroContentMotion]}
          >
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
                    accessibilityLabel={`${result.title}, TMDb ${ratingForCard(result.rating)} out of 10. Opens TMDb.`}
                  >
                    <View style={styles.badgeTmdb}>
                      <Text style={styles.badgeTmdbText}>TMDb</Text>
                    </View>
                    <ScoreValue value={ratingForCard(result.rating)} unit="/10" typography={typography} />
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
                    accessibilityLabel={`${result.title}, IMDb ${result.omdbRatings.imdbRating.split('/')[0]} out of 10. Opens IMDb.`}
                  >
                    <View style={styles.badgeImdb}>
                      <Text style={styles.badgeImdbText}>IMDb</Text>
                    </View>
                    <ScoreValue
                      value={result.omdbRatings.imdbRating.split('/')[0]}
                      unit="/10"
                      typography={typography}
                    />
                  </TouchableOpacity>
                )}

                {result.omdbRatings?.rottenTomatoes && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      Linking.openURL(
                        rottenTomatoesUrl({ title: result.title, mediaType: result.mediaType }),
                      );
                    }}
                    style={styles.heroRatingItem}
                    accessibilityRole="button"
                    accessibilityLabel={`${result.title}, Rotten Tomatoes ${result.omdbRatings.rottenTomatoes.replace(
                      '%',
                      '',
                    )} percent, ${
                      rottenTomatoesFresh(result.omdbRatings.rottenTomatoes) ? 'Fresh' : 'Rotten'
                    }. Opens Rotten Tomatoes.`}
                  >
                    <View style={styles.badgeRt}>
                      <Text style={styles.badgeRtText}>
                        {rottenTomatoesEmoji(result.omdbRatings.rottenTomatoes)}
                      </Text>
                    </View>
                    <ScoreValue
                      value={result.omdbRatings.rottenTomatoes.replace('%', '')}
                      unit="%"
                      typography={typography}
                    />
                  </TouchableOpacity>
                )}

                {result.omdbRatings?.metascore && metaBadge && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      Linking.openURL(
                        metacriticUrl({ title: result.title, mediaType: result.mediaType }),
                      );
                    }}
                    style={styles.heroRatingItem}
                    accessibilityRole="button"
                    accessibilityLabel={`${result.title}, Metacritic ${result.omdbRatings.metascore} out of 100. Opens Metacritic.`}
                  >
                    <View style={[styles.badgeMeta, { backgroundColor: metaBadge.bg }]}>
                      <Text style={[styles.badgeMetaText, { color: metaBadge.fg }]}>M</Text>
                    </View>
                    <ScoreValue
                      value={result.omdbRatings.metascore}
                      unit="/100"
                      typography={typography}
                    />
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {/* Title stays white — it always sits on top of the backdrop image.
                Logo-first (title-treatment art), falling back to typeset text that
                caps at 3 lines and auto-shrinks so long titles never blow out the
                hero or push the ratings strip into the floating buttons.
                Suppressed entirely on the poster fallback: a poster already carries
                the title, so overlaying ours would double it (the poster's own title
                remains the visible one; MediaArtwork's a11y label still names it). */}
            {usingPoster ? null : heroLogo && !logoFailed ? (
              <ExpoImage
                source={{ uri: heroLogo.url }}
                style={[styles.titleLogo, { width: heroLogo.width, height: heroLogo.height }]}
                contentFit="contain"
                contentPosition="left"
                transition={180}
                onError={() => setLogoFailed(true)}
                accessible
                accessibilityRole="image"
                accessibilityLabel={result.title}
              />
            ) : (
              <Text
                style={[styles.title, { color: '#ffffff', ...typography.displayLg, ...titleFont }]}
                numberOfLines={3}
                accessibilityRole="header"
              >
                {result.title}
              </Text>
            )}

            {/* Watch Trailer full-width button */}
            {result.trailer && result.trailer !== 'N/A' && (
              <TouchableOpacity
                style={[styles.trailerButton, { backgroundColor: GOLD_ACCENT }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTrailerVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Watch ${
                  result.trailerType === 'Teaser' ? 'teaser' : 'trailer'
                } for ${result.title}`}
              >
                <Ionicons name="play" size={18} color="#141414" style={{ marginRight: 6 }} />
                <Text
                  style={[styles.trailerButtonText, { color: '#141414', ...typography.labelLg }]}
                >
                  {result.trailerType === 'Teaser' ? 'Watch Teaser' : 'Watch Trailer'}
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
                <SkeletonBlock style={{ width: '62%', height: 16, borderRadius: 8 }} />
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
                      <SkeletonBlock style={{ width: 50, height: 12, borderRadius: 6 }} />
                    </View>
                    <View style={[styles.infoPill, styles.skeletonPill]}>
                      <SkeletonBlock style={{ width: 60, height: 12, borderRadius: 6 }} />
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
            {/* Overflowing synopses become a labelled button carrying the full text
                as its accessible name; short ones stay plain, un-clamped text.
                Either way the first paint measures unclamped so the toggle only
                appears when there's genuinely more to read. */}
            {synopsisOverflows ? (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsSynopsisExpanded(!isSynopsisExpanded);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={displaySynopsis}
                accessibilityHint={
                  isSynopsisExpanded ? 'Collapses the synopsis' : 'Expands the full synopsis'
                }
                accessibilityState={{ expanded: isSynopsisExpanded }}
              >
                <Text
                  style={[styles.synopsis, { color: colors.onSurface, ...typography.bodyLg }]}
                  numberOfLines={isSynopsisExpanded ? undefined : SYNOPSIS_COLLAPSED_LINES}
                  onTextLayout={handleSynopsisTextLayout}
                >
                  {displaySynopsis}
                </Text>
                <Text style={[styles.synopsisToggle, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                  {isSynopsisExpanded ? 'Read less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                style={[styles.synopsis, { color: colors.onSurface, ...typography.bodyLg }]}
                numberOfLines={
                  synopsisMeasured && !isSynopsisExpanded ? SYNOPSIS_COLLAPSED_LINES : undefined
                }
                onTextLayout={handleSynopsisTextLayout}
              >
                {displaySynopsis}
              </Text>
            )}
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
              <ProgrammeEyebrowLabel eyebrow="Seasons" />
              {seasonSummaryLine ? (
                <Text
                  style={[
                    styles.seasonSummary,
                    { color: colors.onSurfaceVariant, ...typography.bodyMd },
                  ]}
                >
                  {seasonSummaryLine}
                </Text>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.seasonsScroll}
              >
                {result.seasons.map((season, index) => {
                  const isLatest = season.seasonNumber === latestSeasonNumber;
                  return (
                    <TouchableOpacity
                      key={season.id || season.seasonNumber}
                      style={styles.seasonCard}
                      onPress={() => handleSeasonPress(season)}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel={`${season.name}, ${season.year}, ${pluralize(
                        season.episodeCount,
                        'episode',
                      )}${isLatest ? ', latest season' : ''}`}
                    >
                      <View
                        style={[
                          styles.seasonPosterFrame,
                          { borderRadius: radii.md },
                          isLatest && { borderColor: GOLD_ACCENT, borderWidth: 2 },
                        ]}
                      >
                        <MediaArtwork
                          uri={season.posterUrl}
                          style={styles.seasonPoster}
                          accessibilityLabel={`${season.name} poster`}
                          title={season.name}
                          icon="tv-outline"
                          instant
                        />
                        <View
                          style={[styles.seasonOrderBadge, { backgroundColor: GOLD_ACCENT }]}
                        >
                          <Text style={[styles.seasonOrderText, { color: '#141414' }]}>
                            {season.seasonNumber || index + 1}
                          </Text>
                        </View>
                        {season.ratingValue ? (
                          <View style={styles.seasonRatingBadge}>
                            <Ionicons name="star" size={9} color={GOLD_ACCENT} />
                            <Text style={styles.seasonRatingText}>
                              {season.ratingValue.toFixed(1)}
                            </Text>
                          </View>
                        ) : null}
                        {isLatest ? (
                          <View
                            style={[styles.seasonLatestPill, { backgroundColor: GOLD_ACCENT }]}
                          >
                            <Text style={[styles.seasonLatestText, { color: '#141414' }]}>
                              LATEST
                            </Text>
                          </View>
                        ) : null}
                      </View>
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
                          {`${season.year} • ${pluralize(season.episodeCount, 'episode')}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ─── Cast ────────────────────────────────────────────────────── */}
          {visibleCastPeople.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <ProgrammeEyebrowLabel eyebrow="Cast" />
                {seeAllPeopleButton}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.peopleScroll}
                decelerationRate="fast"
              >
                {visibleCastPeople.map((person, index) => (
                  <PersonCard
                    key={personKey(person, index)}
                    person={person}
                    colors={colors}
                    typography={typography}
                    canPeek={Boolean(person.id)}
                    onPress={() => handlePersonPressWithFallback(person, 'cast')}
                    onLongPress={() => handleActorLongPress(person, 'cast')}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ─── Crew ────────────────────────────────────────────────────── */}
          {visibleCrewPeople.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <ProgrammeEyebrowLabel eyebrow="Crew" />
                {/* Falls to the crew header only when there's no cast rail above. */}
                {visibleCastPeople.length === 0 ? seeAllPeopleButton : null}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.peopleScroll}
                decelerationRate="fast"
              >
                {visibleCrewPeople.map((person, index) => (
                  <PersonCard
                    key={personKey(person, index)}
                    person={person}
                    colors={colors}
                    typography={typography}
                    accent
                    canPeek={Boolean(person.id)}
                    onPress={() =>
                      handlePersonPressWithFallback(person, filmographyRoleForPerson(person))
                    }
                    onLongPress={() =>
                      handleActorLongPress(person, filmographyRoleForPerson(person))
                    }
                  />
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
                      <SkeletonBlock style={{ width: 86, height: 54, borderRadius: 8 }} />
                      <SkeletonBlock style={{ width: 72, height: 12, borderRadius: 6 }} />
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
              onToggleWatchlist(result);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              isInWatchlist
                ? `Manage ${result.title} in your library`
                : `Save ${result.title} to your library`
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
  shareCaptureHost: {
    position: 'absolute',
    left: 5000,
    top: 0,
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
    // `top` is applied inline (needs safe-area insets) so the bottom-anchored stack
    // has a floor below the floating header; flex-end keeps content bottom-aligned
    // and overflow:hidden clips the least-important top (genre badge) instead of
    // letting a tall title/meta stack draw over the share & bookmark buttons.
    bottom: 40,
    left: 24,
    right: 24,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroMetaStack: {
    gap: 10,
    marginBottom: 12,
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
  heroRatingUnit: {
    fontWeight: '700',
    // Dimmed so the score still leads, but the scale stays legible.
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0,
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
    // -1 (was -2): tighter tracking on the custom display font under-measures the
    // Text width on RN-Android and clips the last glyph; alignSelf:'stretch' +
    // textAlign gives the last wrapped line a definite width to clip against.
    letterSpacing: -1,
    marginBottom: 12,
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  titleLogo: {
    alignSelf: 'flex-start',
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
  synopsisToggle: {
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.3,
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
    width: scale(150),
  },
  seasonPosterFrame: {
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  seasonPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  seasonOrderBadge: {
    alignItems: 'center',
    borderRadius: 4,
    height: 22,
    justifyContent: 'center',
    left: 8,
    position: 'absolute',
    top: 8,
    width: 22,
  },
  seasonOrderText: {
    fontSize: 12,
    fontWeight: '900',
  },
  seasonRatingBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  seasonRatingText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  seasonLatestPill: {
    borderRadius: 8,
    bottom: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
  },
  seasonLatestText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  seasonSummary: {
    fontWeight: '600',
    marginBottom: 18,
    marginTop: -6,
  },
  seasonBody: {
    gap: 2,
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
