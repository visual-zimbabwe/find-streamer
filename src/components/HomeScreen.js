import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ProgressiveBlur } from './ProgressiveBlur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { HomeFilterBar } from './HomeFilterBar';
import { getUserWatchlistCollections, watchlistEntryKey } from '../lib/watchlistModel';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import {
  HOME_HERO_RESUME_DELAY_MS,
  HOME_HERO_ROTATION_MS,
} from '../lib/homeFeed';
import { useWhereToWatchFilter } from '../hooks/useWhereToWatchFilter';
import { getServiceLabel, isWhereFilterNarrowing } from '../lib/whereToWatch';
import { useBottomSheet } from './StackBottomSheet';
import { WhereToWatchCountrySheet, WhereToWatchServiceSheet } from './WhereToWatchSheets';
import { ContentRail } from './ContentRail';
import { scale, verticalScale } from '../utils/responsive';
import { resolveRatingValue } from '../lib/ratings';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD, FADE_MS } from '../theme/programme';
import { HomeFeedSkeleton } from './SkeletonLoaders';
import { useReduceMotion } from '../hooks/useReduceMotion';

const FEATURE_H = verticalScale(420);
const HEADER_BODY_H = scale(96);
// Under an active filter the hero features the matched titles themselves; cap
// the rotation pool so it stays a highlight, not a slideshow of the whole set.
const FILTERED_HERO_MAX = 12;

const FeaturedSpotlightCard = memo(function FeaturedSpotlightCard({
  item,
  colors,
  typography,
  radii,
  fadeAnim,
  onPress,
  onPressIn,
}) {
  if (!item) return null;
  const backdrop = item.backdropUrl || item.posterUrl;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
    >
      <Animated.View style={[styles.featureCard, { borderRadius: radii.xl, opacity: fadeAnim }]}>
        <View
          style={[
            styles.featureFrame,
            { borderRadius: radii.xl, backgroundColor: colors.surfaceContainerHighest },
          ]}
        >
          <MediaArtwork
            uri={backdrop}
            style={styles.featureImg}
            resizeMode="cover"
            accessibilityLabel={`Backdrop for ${item.title}`}
            title={item.title}
          />
          <ProgressiveBlur
            intensity={64}
            tint="dark"
            direction="bottom"
            locations={[0.22, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.42)', 'transparent']}
            style={styles.featureTopScrim}
          />
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, typography.headlineLg]} numberOfLines={3}>
              {item.title}
            </Text>
            <View style={styles.heroMetaRow}>
              <Text style={[styles.heroMeta, typography.bodyMd]}>{item.year}</Text>
              {item.ratingValue > 0 && (
                <View style={styles.heroRatingPill}>
                  <Text style={[styles.heroRatingText, typography.labelSm]}>
                    {item.ratingValue.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export { ContentRail } from './ContentRail';

const sortByRatingDesc = (arr) =>
  [...arr].sort((a, b) => resolveRatingValue(b) - resolveRatingValue(a));

export function HomeScreen({
  watchlist = [],
  spotlight = [],
  onSelectItem,
  onOpenCollections,
  mediaFilter = null,
  onMediaFilterChange,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const bottomSheet = useBottomSheet();
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const headerScrolledRef = useRef(false);
  const bottomNavScroll = useBottomNavScroll((event) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    const scrolled = y > 24;
    if (scrolled !== headerScrolledRef.current) {
      headerScrolledRef.current = scrolled;
      setHeaderScrolled(scrolled);
    }
  });
  const headerOffset = insets.top + HEADER_BODY_H;

  // ─── Where-to-watch filter (Home owns the facets; the shared engine does the
  // scan). Rests at All / All = off, so first paint shows the whole library and
  // nothing is fetched until the user narrows.
  const [homeCountry, setHomeCountry] = useState(null); // { code, label } | null = all
  const [homeServiceKey, setHomeServiceKey] = useState(null); // null = all services
  const whereActive = isWhereFilterNarrowing(homeCountry, homeServiceKey);

  const { matches: whereMatches, checking: whereChecking, progress: whereProgress, scopeCount } =
    useWhereToWatchFilter({
      items: watchlist,
      active: whereActive,
      country: homeCountry,
      serviceKey: homeServiceKey,
      collectionIds: null,
    });

  const [heroIndex, setHeroIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const reduceMotion = useReduceMotion();

  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const heroLengthRef = useRef(0);
  const skipHeroFadeRef = useRef(true);

  const watchlistRows = useMemo(() => {
    const matchedKeys = whereMatches?.keys || null;
    return getUserWatchlistCollections()
      .map((collection) => {
        const items = (watchlist || []).filter((w) => {
          if (mediaFilter && w.mediaType !== mediaFilter) return false;
          if (matchedKeys && !matchedKeys.has(watchlistEntryKey(w))) return false;
          return w.collectionIds?.includes(collection.id);
        });
        const sorted = [...items].sort((a, b) => resolveRatingValue(b) - resolveRatingValue(a));
        return {
          category: {
            id: collection.id,
            label: collection.name,
            icon: collection.icon,
          },
          items: sorted,
        };
      })
      .filter((row) => row.items.length > 0);
  }, [watchlist, mediaFilter, whereMatches]);

  // The hero pool: the curated rotating spotlight when unfiltered; the matched
  // library titles themselves when a filter is on (so the hero can never feature
  // something the rails below it just filtered out).
  const heroPool = useMemo(() => {
    if (!whereActive) return spotlight;
    const seen = new Set();
    const pool = [];
    watchlistRows.forEach((row) =>
      row.items.forEach((item) => {
        const key = watchlistEntryKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          pool.push(item);
        }
      }),
    );
    return sortByRatingDesc(pool).slice(0, FILTERED_HERO_MAX);
  }, [whereActive, spotlight, watchlistRows]);

  const featuredItem = heroPool[displayIndex] || heroPool[0] || null;

  useEffect(() => {
    heroLengthRef.current = heroPool.length || 1;
    setHeroIndex(0);
    setDisplayIndex(0);
    fadeAnim.setValue(1);
    skipHeroFadeRef.current = true;
  }, [heroPool, fadeAnim]);

  useEffect(() => {
    if (skipHeroFadeRef.current) {
      skipHeroFadeRef.current = false;
      setDisplayIndex(heroIndex);
      fadeAnim.setValue(1);
      return undefined;
    }
    if (reduceMotion) {
      setDisplayIndex(heroIndex);
      fadeAnim.setValue(1);
      return undefined;
    }
    let cancelled = false;
    Animated.timing(fadeAnim, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(
      ({ finished }) => {
        if (!finished || cancelled) return;
        setDisplayIndex(heroIndex);
        Animated.timing(fadeAnim, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      },
    );
    return () => {
      cancelled = true;
      fadeAnim.stopAnimation();
    };
  }, [heroIndex, fadeAnim, reduceMotion]);

  useEffect(() => {
    if (heroPool.length <= 1 || reduceMotion) return undefined;
    const tick = setInterval(() => {
      if (pausedRef.current) return;
      setHeroIndex((i) => {
        const len = heroLengthRef.current || 1;
        return (i + 1) % len;
      });
    }, HOME_HERO_ROTATION_MS);
    return () => clearInterval(tick);
  }, [heroPool.length, reduceMotion]);

  const pauseHero = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const scheduleResumeHero = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, HOME_HERO_RESUME_DELAY_MS);
  }, []);

  // Pause the auto-rotate while the user is pressing the hero so it can't swap
  // mid-tap, then resume shortly after — the "Also in Spotlight" strip used to
  // own the resume; now the hero press does.
  const handleHeroPressIn = useCallback(() => {
    pauseHero();
    scheduleResumeHero();
  }, [pauseHero, scheduleResumeHero]);

  useEffect(
    () => () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    },
    [],
  );

  // Android back: peel the filter off before leaving Home — first the
  // availability filter, then the media-type filter.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (whereActive) {
        setHomeCountry(null);
        setHomeServiceKey(null);
        return true;
      }
      if (mediaFilter) {
        onMediaFilterChange?.(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [whereActive, mediaFilter, onMediaFilterChange]);

  const openCountrySheet = useCallback(() => {
    Haptics.selectionAsync();
    bottomSheet.show(
      (sheetId) => (
        <WhereToWatchCountrySheet
          selectedCode={homeCountry?.code || null}
          allowAll
          onSelect={(region) => {
            setHomeCountry(region?.code ? { code: region.code, label: region.label } : null);
            bottomSheet.dismiss(sheetId);
          }}
        />
      ),
      {
        eyebrow: 'Where to Watch',
        title: 'Country',
        subtitle: 'Show titles you can stream in…',
        size: 'large',
        scrollable: true,
      },
    );
  }, [bottomSheet, homeCountry]);

  const openServiceSheet = useCallback(() => {
    Haptics.selectionAsync();
    bottomSheet.show(
      (sheetId) => (
        <WhereToWatchServiceSheet
          selectedKey={homeServiceKey}
          onSelect={(serviceKey) => {
            setHomeServiceKey(serviceKey);
            bottomSheet.dismiss(sheetId);
            // Nudge: a service without a country answers "on X somewhere", which
            // is rarely what's meant. Steer straight into picking a country.
            if (serviceKey && !homeCountry?.code) {
              setTimeout(openCountrySheet, 220);
            }
          }}
        />
      ),
      {
        eyebrow: 'Where to Watch',
        title: 'Streaming Service',
        subtitle: 'Narrow to one service',
        size: 'large',
        scrollable: true,
      },
    );
  }, [bottomSheet, homeServiceKey, homeCountry, openCountrySheet]);

  const atmosphereColors = useMemo(
    () => [colors.surfaceContainerHigh, colors.background],
    [colors.surfaceContainerHigh, colors.background],
  );

  const renderRail = useCallback(
    ({ item: { category, items } }) => (
      <ContentRail
        title={category.label}
        icon={category.icon}
        data={items}
        colors={colors}
        typography={typography}
        radii={radii}
        showMediaType={false}
        showCaption={false}
        onSelectItem={onSelectItem}
      />
    ),
    [colors, typography, radii, onSelectItem],
  );

  const railKeyExtractor = useCallback(({ category }) => category.id, []);

  const matchedCount = whereMatches ? whereMatches.keys.size : 0;
  const filterContext = homeServiceKey
    ? `on ${getServiceLabel(homeServiceKey)}${homeCountry?.code ? ` in ${homeCountry.label}` : ''}`
    : homeCountry?.code
      ? `in ${homeCountry.label}`
      : '';

  const listHeader = (
    <View style={styles.spotlightSection}>
      {!featuredItem && !whereActive ? (
        <HomeFeedSkeleton />
      ) : (
        <>
          {featuredItem ? (
            <FeaturedSpotlightCard
              item={featuredItem}
              colors={colors}
              typography={typography}
              radii={radii}
              fadeAnim={fadeAnim}
              onPress={() => onSelectItem?.(featuredItem)}
              onPressIn={handleHeroPressIn}
            />
          ) : null}

          {whereActive ? (
            <View
              style={[
                styles.filterStatus,
                { backgroundColor: colors.glass, borderColor: GOLD_DIM, borderRadius: radii.lg },
              ]}
            >
              {whereChecking ? (
                <>
                  <ActivityIndicator size="small" color={GOLD_ACCENT} />
                  <Text
                    style={[styles.filterStatusText, { color: colors.onSurface, ...typography.labelSm }]}
                    numberOfLines={1}
                  >
                    Checking {whereProgress?.checked ?? 0}/{whereProgress?.total ?? 0} {filterContext}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="funnel" size={13} color={GOLD_ACCENT} />
                  <Text
                    style={[styles.filterStatusText, { color: colors.onSurface, ...typography.labelSm }]}
                    numberOfLines={1}
                  >
                    {matchedCount} of {scopeCount} {scopeCount === 1 ? 'title' : 'titles'} {filterContext}
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  const renderWhereEmpty = () => {
    if (!whereActive || whereChecking || !whereMatches) return null;
    return (
      <View
        style={[
          styles.whereEmptyBox,
          { backgroundColor: colors.glass, borderColor: GOLD_DIM, borderRadius: radii.lg },
        ]}
      >
        <Ionicons name="eye-off-outline" size={22} color={GOLD_ACCENT} />
        <Text style={[styles.whereEmptyTitle, { color: colors.onSurface, ...typography.titleMd }]}>
          Nothing to stream yet
        </Text>
        <Text style={[styles.whereEmptyText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          None of your {scopeCount} saved {scopeCount === 1 ? 'title streams' : 'titles stream'}{' '}
          {filterContext || 'right now'}. Try another service or country.
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.rootWrap, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />

      <HomeFilterBar
        headerScrolled={headerScrolled}
        mediaFilter={mediaFilter}
        onMediaFilterChange={onMediaFilterChange}
        onOpenCollections={onOpenCollections}
        country={homeCountry}
        serviceKey={homeServiceKey}
        onOpenCountry={openCountrySheet}
        onOpenService={openServiceSheet}
      />

      <FlatList
        style={styles.scroll}
        data={watchlistRows}
        renderItem={renderRail}
        keyExtractor={railKeyExtractor}
        extraData={theme}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderWhereEmpty}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingTop: headerOffset, paddingBottom: insets.bottom + 112 },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        nestedScrollEnabled
        overScrollMode="never"
        decelerationRate="normal"
        {...bottomNavScroll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1 },
  atmosphereTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: verticalScale(320),
    opacity: 0.55,
  },
  scroll: { flex: 1 },
  scrollInner: {},

  spotlightSection: {
    paddingHorizontal: GRID_PAD,
  },
  featureCard: {
    height: FEATURE_H,
  },
  featureFrame: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  featureImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  featureTopScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 100,
  },
  featureContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scale(20),
    paddingBottom: scale(24),
  },
  featureTitle: {
    color: '#fff',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  heroMeta: { color: 'rgba(255,255,255,0.88)', fontWeight: '600' },
  heroRatingPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroRatingText: { color: '#FFD580', fontWeight: '800' },

  filterStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: scale(16),
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
  },
  filterStatusText: {
    flexShrink: 1,
    fontWeight: '700',
  },
  whereEmptyBox: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    marginHorizontal: GRID_PAD,
    marginTop: scale(24),
    padding: scale(20),
  },
  whereEmptyTitle: {
    fontWeight: '800',
  },
  whereEmptyText: {
    textAlign: 'center',
  },
});
