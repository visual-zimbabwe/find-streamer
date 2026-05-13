import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { WATCHLIST_CATEGORIES, getWatchlistCategory } from '../lib/watchlistCategories';
import {
  HOME_HERO_RESUME_DELAY_MS,
  HOME_HERO_ROTATION_MS,
  HOME_SPOTLIGHT_MAX,
  HOME_TMDB_RAILS,
  buildHomeSpotlight,
  fetchHomeNowPlayingRail,
  fetchHomeTraktTrendingRail,
  fetchHomeTmdbRail,
} from '../lib/homeFeed';
import { scale, verticalScale } from '../utils/responsive';

const WINDOW_W = Dimensions.get('window').width;
const POSTER_W = scale(118);
const POSTER_H = POSTER_W * 1.5;

function HomePosterCard({ item, colors, typography, radii, onPress }) {
  return (
    <TouchableOpacity
      style={styles.posterCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
    >
      <View style={[styles.posterWrap, { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.xl }]}>
        <MediaArtwork
          uri={item.posterUrl}
          style={styles.posterImg}
          resizeMode="cover"
          accessibilityLabel={`${item.title} poster`}
          title={item.title}
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
}

function ContentRail({ title, data, colors, typography, radii, onSelectItem }) {
  if (!data?.length) return null;
  return (
    <View style={styles.railBlock}>
      <Text style={[styles.railTitle, { color: colors.onSurface, ...typography.titleMd }]} accessibilityRole="header">
        {title}
      </Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => `${item.mediaType || 'movie'}-${item.tmdbId}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railList}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => (
          <HomePosterCard
            item={item}
            colors={colors}
            typography={typography}
            radii={radii}
            onPress={() => onSelectItem(item)}
          />
        )}
      />
    </View>
  );
}

export function HomeScreen({ watchlist = [], onSelectItem }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const heroH = verticalScale(400);

  const [spotlight, setSpotlight] = useState([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroListRef = useRef(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);

  const [traktRail, setTraktRail] = useState(null);
  const [nowPlayingRail, setNowPlayingRail] = useState(null);
  const [tmdbRails, setTmdbRails] = useState({});
  const [railsLoading, setRailsLoading] = useState(true);

  const heroItem = spotlight[heroIndex] || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHeroLoading(true);
      try {
        const items = await buildHomeSpotlight(watchlist);
        if (!cancelled) {
          setSpotlight(items.slice(0, HOME_SPOTLIGHT_MAX));
          setHeroIndex(0);
          requestAnimationFrame(() => {
            heroListRef.current?.scrollToOffset({ offset: 0, animated: false });
          });
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
  }, [watchlist]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRailsLoading(true);
      try {
        const [trakt, nowPlaying, ...tmdbResults] = await Promise.all([
          fetchHomeTraktTrendingRail().catch(() => []),
          fetchHomeNowPlayingRail().catch(() => []),
          ...HOME_TMDB_RAILS.map((def) =>
            fetchHomeTmdbRail(def).then((rows) => ({ id: def.id, rows })).catch(() => ({ id: def.id, rows: [] }))
          ),
        ]);
        if (cancelled) return;
        setTraktRail(trakt);
        setNowPlayingRail(nowPlaying);
        const map = {};
        tmdbResults.forEach((pack) => {
          map[pack.id] = pack.rows;
        });
        setTmdbRails(map);
      } finally {
        if (!cancelled) setRailsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (spotlight.length <= 1) return undefined;
    const tick = setInterval(() => {
      if (pausedRef.current) return;
      setHeroIndex((i) => {
        const next = (i + 1) % spotlight.length;
        heroListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, HOME_HERO_ROTATION_MS);
    return () => clearInterval(tick);
  }, [spotlight.length]);

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

  const watchlistRows = useMemo(() => {
    return WATCHLIST_CATEGORIES.map((category) => {
      const items = (watchlist || []).filter(
        (w) => getWatchlistCategory(w.watchlistCategoryId).id === category.id
      );
      const sorted = [...items].sort((a, b) => (b.ratingValue || 0) - (a.ratingValue || 0));
      return { category, items: sorted };
    }).filter((row) => row.items.length > 0);
  }, [watchlist]);

  const onHeroMomentumEnd = useCallback(
    (e) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.min(spotlight.length - 1, Math.max(0, Math.round(x / WINDOW_W)));
      setHeroIndex(i);
      scheduleResumeHero();
    },
    [spotlight.length, scheduleResumeHero]
  );

  const renderHeroPage = useCallback(
    ({ item }) => {
      const backdrop = item.backdropUrl || item.posterUrl;
      return (
        <TouchableOpacity
          style={[styles.heroPage, { width: WINDOW_W, height: heroH }]}
          activeOpacity={0.92}
          onPress={() => onSelectItem?.(item)}
          accessibilityRole="button"
          accessibilityLabel={`Open details for ${item.title}`}
        >
          <MediaArtwork
            uri={backdrop}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={`Backdrop for ${item.title}`}
            title={item.title}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
            locations={[0.2, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={styles.heroTopScrim} />
          <View style={[styles.heroContent, { paddingBottom: 52 + insets.bottom * 0.2 }]}>
            <Text style={[styles.heroTitle, { color: '#fff', ...typography.headlineLg }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.heroMetaRow}>
              <Text style={[styles.heroMeta, { ...typography.bodyMd }]}>{item.year}</Text>
              {item.ratingValue > 0 && (
                <View style={styles.heroRatingPill}>
                  <Text style={[styles.heroRatingText, { ...typography.labelSm }]}>
                    TMDB {item.ratingValue.toFixed(1)}
                  </Text>
                </View>
              )}
              <View style={styles.heroTypePill}>
                <Ionicons name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'} size={14} color="#fff" />
                <Text style={[styles.heroTypeText, { ...typography.labelSm }]}>
                  {item.mediaType === 'tv' ? 'Series' : 'Movie'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [heroH, insets.bottom, onSelectItem, typography]
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 112 }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <View
        style={[styles.heroShell, { height: heroH }]}
        accessible
        accessibilityLabel={
          heroItem
            ? `Spotlight: ${heroItem.title}. Swipe sideways for more, or tap to open details.`
            : 'Spotlight loading'
        }
      >
        {heroLoading ? (
          <View style={[styles.heroLoading, { backgroundColor: colors.surfaceContainerHighest }]}>
            <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading spotlight" />
          </View>
        ) : spotlight.length ? (
          <>
            <FlatList
              ref={heroListRef}
              style={styles.heroList}
              data={spotlight}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              keyExtractor={(it) => `${it.mediaType || 'movie'}-${it.tmdbId}`}
              renderItem={renderHeroPage}
              getItemLayout={(_, index) => ({
                length: WINDOW_W,
                offset: WINDOW_W * index,
                index,
              })}
              onScrollBeginDrag={pauseHero}
              onMomentumScrollEnd={onHeroMomentumEnd}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  heroListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                  });
                }, 350);
              }}
            />
            {spotlight.length > 1 ? (
              <View
                style={[styles.heroDotsOverlay, { paddingBottom: 10 + insets.bottom * 0.25 }]}
                pointerEvents="box-none"
                accessibilityLabel="Spotlight pages"
              >
                <View style={styles.dotsRow}>
                  {spotlight.map((_, i) => (
                    <TouchableOpacity
                      key={`dot-${i}`}
                      style={styles.heroDotHit}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setHeroIndex(i);
                        pauseHero();
                        scheduleResumeHero();
                        heroListRef.current?.scrollToIndex({ index: i, animated: true });
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Show spotlight item ${i + 1} of ${spotlight.length}`}
                    >
                      <View
                        style={[
                          styles.dot,
                          i === heroIndex ? styles.dotActive : styles.dotIdle,
                          i === heroIndex && { backgroundColor: colors.primary },
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.heroEmpty, { backgroundColor: colors.surfaceContainerHighest }]}>
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
          data={items}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
        />
      ))}

      {!railsLoading && nowPlayingRail?.length ? (
        <ContentRail
          title="Now playing in theaters"
          data={nowPlayingRail}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
        />
      ) : null}

      {!railsLoading && traktRail?.length ? (
        <ContentRail
          title="Trending on Trakt"
          data={traktRail}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
        />
      ) : null}

      {HOME_TMDB_RAILS.map((def) => (
        <ContentRail
          key={def.id}
          title={def.title}
          data={tmdbRails[def.id] || []}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
        />
      ))}

      {railsLoading && (
        <View style={styles.railsLoading} accessibilityLabel="Loading rows">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollInner: { paddingTop: 0 },
  heroShell: {
    width: WINDOW_W,
    position: 'relative',
    overflow: 'hidden',
  },
  heroList: { flexGrow: 0, flexShrink: 0, flex: 1 },
  heroPage: { position: 'relative', overflow: 'hidden' },
  heroDotsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  heroTopScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 120,
  },
  heroLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  heroContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
  },
  heroTitle: {
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
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
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotIdle: { backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 20, borderRadius: 5 },
  heroDotHit: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railBlock: { marginTop: 22 },
  railTitle: {
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  railList: { paddingHorizontal: 16 },
  posterCard: { width: POSTER_W },
  posterWrap: {
    width: POSTER_W,
    height: POSTER_H,
    overflow: 'hidden',
    position: 'relative',
  },
  posterImg: { width: '100%', height: '100%' },
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
  railsLoading: { paddingVertical: 28, alignItems: 'center' },
});
