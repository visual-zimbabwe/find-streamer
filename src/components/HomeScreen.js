import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProgressiveBlur } from './ProgressiveBlur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { HomeTopNav } from './HomeTopNav';
import { getUserWatchlistCollections } from '../lib/watchlistModel';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import {
  HOME_HERO_RESUME_DELAY_MS,
  HOME_HERO_ROTATION_MS,
  HOME_SPOTLIGHT_MAX,
  buildHomeSpotlight,
} from '../lib/homeFeed';
import { scale, verticalScale } from '../utils/responsive';

const WINDOW_W = Dimensions.get('window').width;
const GRID_PAD = scale(22);
const GRID_GAP = scale(14);
const GRID_COL_W = (WINDOW_W - GRID_PAD * 2 - GRID_GAP) / 2;
const GRID_POSTER_H = GRID_COL_W * 1.5;
const FEATURE_H = verticalScale(420);
const CHIP_W = scale(248);
const CHIP_H = CHIP_W * (9 / 16);
const HEADER_BODY_H = scale(78);
const GOLD_ACCENT = '#D4A853';
const FADE_MS = 360;

const GridPosterCard = memo(function GridPosterCard({ item, colors, typography, radii, onPress }) {
  return (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
    >
      <View style={[styles.gridPosterWrap, { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.xl }]}>
        <MediaArtwork
          uri={item.posterUrl}
          style={styles.gridPosterImg}
          resizeMode="cover"
          accessibilityLabel={`${item.title} poster`}
          title={item.title}
          instant
        />
        {item.ratingValue > 0 && (
          <View style={[styles.ratingBadge, { borderRadius: radii.sm }]}>
            <Text style={styles.ratingBadgeText}>★ {item.ratingValue.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, { color: colors.onSurface, ...typography.labelSm }]} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.cardMeta}>
        <Ionicons name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'} size={11} color={colors.onSurfaceVariant} />
        <Text style={[styles.cardYear, { color: colors.onSurfaceVariant }]}>{item.year}</Text>
      </View>
    </TouchableOpacity>
  );
});

const SpotlightChip = memo(function SpotlightChip({ item, colors, typography, radii, selected, onPress }) {
  const imageUri = item.backdropUrl || item.posterUrl;
  return (
    <TouchableOpacity
      style={styles.spotlightChip}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Feature ${item.title} in spotlight`}
      accessibilityState={{ selected }}
    >
      <View
        style={[
          styles.spotlightChipFrame,
          {
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: selected ? GOLD_ACCENT : 'transparent',
          },
        ]}
      >
        <MediaArtwork
          uri={imageUri}
          style={styles.spotlightChipImg}
          resizeMode="cover"
          accessibilityLabel={`${item.title} still`}
          title={item.title}
          instant
        />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={styles.spotlightChipScrim} />
        <Text style={[styles.spotlightChipTitle, typography.labelSm]} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

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
        <View style={[styles.featureFrame, { borderRadius: radii.xl, backgroundColor: colors.surfaceContainerHighest }]}>
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
          <LinearGradient colors={['rgba(0,0,0,0.42)', 'transparent']} style={styles.featureTopScrim} />
          <View style={styles.featureContent}>
            <Text style={[styles.featureEyebrow, typography.labelSm]}>Spotlight</Text>
            <Text style={[styles.featureTitle, typography.headlineLg]} numberOfLines={3}>
              {item.title}
            </Text>
            <View style={styles.heroMetaRow}>
              <Text style={[styles.heroMeta, typography.bodyMd]}>{item.year}</Text>
              {item.ratingValue > 0 && (
                <View style={styles.heroRatingPill}>
                  <Text style={[styles.heroRatingText, typography.labelSm]}>
                    TMDB {item.ratingValue.toFixed(1)}
                  </Text>
                </View>
              )}
              <View style={styles.heroTypePill}>
                <Ionicons name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'} size={14} color="#fff" />
                <Text style={[styles.heroTypeText, typography.labelSm]}>
                  {item.mediaType === 'tv' ? 'Series' : 'Movie'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export function ContentRail({
  title,
  icon = null,
  data,
  colors,
  typography,
  radii,
  onSelectItem,
  headerRight = null,
}) {
  if (!data?.length) return null;

  const rows = [];
  for (let i = 0; i < data.length; i += 2) {
    rows.push(data.slice(i, i + 2));
  }

  return (
    <View style={styles.railBlock}>
      <View style={[styles.sectionDivider, { backgroundColor: colors.outlineVariant }]} />
      <View style={styles.railHeaderRow}>
        <View style={styles.railHeaderLeft}>
          {icon ? (
            <Ionicons name={icon} size={16} color={GOLD_ACCENT} style={styles.railIcon} />
          ) : null}
          <Text
            style={[styles.railTitle, { color: colors.onSurface, ...typography.titleMd }]}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        {headerRight}
      </View>
      <View style={styles.gridBody}>
        {rows.map((pair, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            {pair.map((item) => (
              <GridPosterCard
                key={`${item.mediaType || 'movie'}-${item.tmdbId}`}
                item={item}
                colors={colors}
                typography={typography}
                radii={radii}
                onPress={() => onSelectItem(item)}
              />
            ))}
            {pair.length === 1 ? <View style={styles.gridCardSpacer} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function HomeScreen({
  watchlist = [],
  onSelectItem,
  onOpenCollections,
  mediaFilter = null,
  onMediaFilterChange,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
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

  const [spotlight, setSpotlight] = useState([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const filteredLengthRef = useRef(0);
  const skipHeroFadeRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHeroLoading(true);
      try {
        const items = await buildHomeSpotlight(watchlist);
        if (!cancelled) {
          setSpotlight(items.slice(0, HOME_SPOTLIGHT_MAX));
          setHeroIndex(0);
          setDisplayIndex(0);
          fadeAnim.setValue(1);
        }
      } catch {
        if (!cancelled) setSpotlight([]);
      } finally {
        if (!cancelled) setHeroLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [watchlist, fadeAnim]);

  const filteredSpotlight = useMemo(() => {
    if (!mediaFilter) return spotlight;
    return spotlight.filter((it) => it.mediaType === mediaFilter);
  }, [spotlight, mediaFilter]);

  const featuredItem = filteredSpotlight[displayIndex] || null;

  useEffect(() => {
    filteredLengthRef.current = filteredSpotlight.length;
    setHeroIndex(0);
    setDisplayIndex(0);
    fadeAnim.setValue(1);
    skipHeroFadeRef.current = true;
  }, [filteredSpotlight.length, mediaFilter, fadeAnim]);

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
    Animated.timing(fadeAnim, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(({ finished }) => {
      if (!finished || cancelled) return;
      setDisplayIndex(heroIndex);
      Animated.timing(fadeAnim, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
      fadeAnim.stopAnimation();
    };
  }, [heroIndex, fadeAnim, reduceMotion]);

  useEffect(() => {
    if (spotlight.length <= 1 || reduceMotion) return undefined;
    const tick = setInterval(() => {
      if (pausedRef.current) return;
      setHeroIndex((i) => {
        const len = filteredLengthRef.current || 1;
        return (i + 1) % len;
      });
    }, HOME_HERO_ROTATION_MS);
    return () => clearInterval(tick);
  }, [spotlight.length, reduceMotion]);

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

  useEffect(
    () => () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mediaFilter) {
        onMediaFilterChange?.(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [mediaFilter, onMediaFilterChange]);

  const watchlistRows = useMemo(() => {
    return getUserWatchlistCollections().map((collection) => {
      const items = (watchlist || []).filter((w) => {
        if (mediaFilter && w.mediaType !== mediaFilter) return false;
        return w.collectionIds?.includes(collection.id);
      });
      const sorted = [...items].sort((a, b) => (b.ratingValue || 0) - (a.ratingValue || 0));
      return {
        category: {
          id: collection.id,
          label: collection.name,
          icon: collection.icon,
        },
        items: sorted,
      };
    }).filter((row) => row.items.length > 0);
  }, [watchlist, mediaFilter]);

  const selectSpotlightIndex = useCallback((index) => {
    Haptics.selectionAsync();
    pauseHero();
    scheduleResumeHero();
    setHeroIndex(index);
  }, [pauseHero, scheduleResumeHero]);

  const atmosphereColors = useMemo(
    () => [colors.surfaceContainerHigh, colors.background],
    [colors.surfaceContainerHigh, colors.background]
  );

  return (
    <View style={[styles.rootWrap, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={atmosphereColors}
        style={styles.atmosphereTop}
        pointerEvents="none"
      />

      <HomeTopNav
        variant="programme"
        headerScrolled={headerScrolled}
        selectedKey={mediaFilter}
        onSelect={(key, selected) => {
          if (key === 'collections') {
            onOpenCollections?.();
            return;
          }
          onMediaFilterChange?.(selected ? null : key);
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingTop: headerOffset, paddingBottom: insets.bottom + 112 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        nestedScrollEnabled
        overScrollMode="never"
        decelerationRate="normal"
        {...bottomNavScroll}
      >
        <View style={styles.spotlightSection}>
          {heroLoading ? (
            <View style={[styles.featureLoading, { height: FEATURE_H, backgroundColor: colors.surfaceContainerHighest, borderRadius: radii.xl }]}>
              <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading spotlight" />
            </View>
          ) : filteredSpotlight.length ? (
            <>
              <FeaturedSpotlightCard
                item={featuredItem}
                colors={colors}
                typography={typography}
                radii={radii}
                fadeAnim={fadeAnim}
                onPress={() => onSelectItem?.(featuredItem)}
                onPressIn={pauseHero}
              />
              {filteredSpotlight.length > 1 ? (
                <View style={styles.secondarySpotlightBlock}>
                  <View style={styles.secondaryHeaderRow}>
                    <Text style={[styles.secondaryTitle, { color: colors.onSurface, ...typography.labelSm }]}>
                      Also in Spotlight
                    </Text>
                    <Text style={[styles.secondaryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                      {displayIndex + 1} / {filteredSpotlight.length}
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipList}
                    nestedScrollEnabled
                    overScrollMode="never"
                    decelerationRate="fast"
                  >
                    {filteredSpotlight.map((item, index) => (
                      <View key={`${item.mediaType || 'movie'}-${item.tmdbId}-${index}`} style={index > 0 ? styles.chipGap : null}>
                        <SpotlightChip
                          item={item}
                          colors={colors}
                          typography={typography}
                          radii={radii}
                          selected={index === displayIndex}
                          onPress={() => selectSpotlightIndex(index)}
                        />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.featureEmpty, { height: FEATURE_H, backgroundColor: colors.surfaceContainerHighest, borderRadius: radii.xl }]}>
              <Ionicons name="planet-outline" size={40} color={colors.onSurfaceVariant} />
              <Text style={[{ color: colors.onSurfaceVariant, ...typography.bodyLg, marginTop: 12, textAlign: 'center' }]}>
                Pulling fresh picks… check back in a moment.
              </Text>
            </View>
          )}
        </View>

        {watchlistRows.map(({ category, items }) => (
          <ContentRail
            key={category.id}
            title={category.label}
            icon={category.icon}
            data={items}
            colors={colors}
            typography={typography}
            radii={radii}
            onSelectItem={onSelectItem}
          />
        ))}
      </ScrollView>
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
  featureEyebrow: {
    color: GOLD_ACCENT,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  featureTitle: {
    color: '#fff',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  featureLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
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
  heroTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroTypeText: { color: '#fff', fontWeight: '700' },

  secondarySpotlightBlock: {
    marginTop: scale(22),
  },
  secondaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
  },
  secondaryTitle: {
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  secondaryCount: {
    fontWeight: '600',
  },
  chipList: {
    paddingRight: GRID_PAD,
  },
  chipGap: {
    marginLeft: scale(12),
  },
  spotlightChip: {
    width: CHIP_W,
    minHeight: 48,
  },
  spotlightChipFrame: {
    width: CHIP_W,
    height: CHIP_H,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  spotlightChipImg: {
    width: '100%',
    height: '100%',
  },
  spotlightChipScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  spotlightChipTitle: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    color: '#fff',
    fontWeight: '700',
  },

  railBlock: {
    marginTop: scale(28),
    paddingHorizontal: GRID_PAD,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: scale(18),
    opacity: 0.65,
  },
  railHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(14),
    gap: 8,
  },
  railHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  railIcon: {
    marginTop: 1,
  },
  railTitle: {
    flex: 1,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: scale(13),
  },
  gridBody: {
    gap: GRID_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  gridCard: {
    width: GRID_COL_W,
  },
  gridCardSpacer: {
    width: GRID_COL_W,
  },
  gridPosterWrap: {
    width: GRID_COL_W,
    height: GRID_POSTER_H,
    overflow: 'hidden',
    position: 'relative',
  },
  gridPosterImg: { width: '100%', height: '100%' },
  ratingBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  ratingBadgeText: { color: '#FFD700', fontSize: 10, fontWeight: '800' },
  cardTitle: { marginTop: 8, fontWeight: '700', minHeight: 34 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardYear: { fontSize: 11, fontWeight: '600' },
});
