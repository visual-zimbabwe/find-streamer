import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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

function isWatchlisted(watchlist, item) {
  return (watchlist || []).some(
    (w) => w.tmdbId === item.tmdbId && w.mediaType === (item.mediaType || 'movie')
  );
}

function HomePosterCard({ item, colors, typography, radii, onPress, onToggleSave, saved }) {
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
        {saved && (
          <View style={[styles.savedDot, { backgroundColor: colors.primary }]}>
            <Ionicons name="bookmark" size={11} color={colors.onPrimary} />
          </View>
        )}
        <TouchableOpacity
          style={[styles.quickSave, { backgroundColor: colors.surface + 'E6', borderRadius: radii.md }]}
          onPress={(e) => {
            e?.stopPropagation?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleSave?.();
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${item.title} from watchlist` : `Quick save ${item.title} to watchlist`}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.primary} />
        </TouchableOpacity>
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

function ContentRail({ title, data, watchlist, colors, typography, radii, onSelectItem, onToggleWatchlist }) {
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
            saved={isWatchlisted(watchlist, item)}
            onToggleSave={() => onToggleWatchlist?.(item)}
          />
        )}
      />
    </View>
  );
}

export function HomeScreen({ watchlist = [], onSelectItem, onToggleWatchlist }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();

  const [spotlight, setSpotlight] = useState([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroFade = useRef(new Animated.Value(1)).current;
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
      setHeroIndex((i) => (i + 1) % spotlight.length);
    }, HOME_HERO_ROTATION_MS);
    return () => clearInterval(tick);
  }, [spotlight.length]);

  useEffect(() => {
    heroFade.setValue(0.65);
    Animated.timing(heroFade, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [heroIndex, heroFade]);

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

  const heroBackdrop = heroItem?.backdropUrl || heroItem?.posterUrl;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 112 }]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[styles.heroShell, { height: verticalScale(400) }]}
        onTouchStart={pauseHero}
        onTouchEnd={scheduleResumeHero}
        onTouchCancel={scheduleResumeHero}
        accessible
        accessibilityLabel={
          heroItem
            ? `Spotlight: ${heroItem.title}. Auto-rotates. Use dot controls to change slide.`
            : 'Spotlight loading'
        }
      >
        {heroLoading ? (
          <View style={[styles.heroLoading, { backgroundColor: colors.surfaceContainerHighest }]}>
            <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading spotlight" />
          </View>
        ) : heroItem ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: heroFade }]}>
              <MediaArtwork
                uri={heroBackdrop}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                accessibilityLabel={`Backdrop for ${heroItem.title}`}
                title={heroItem.title}
              />
            </Animated.View>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
              locations={[0.2, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.55)', 'transparent']}
              style={styles.heroTopScrim}
            />
            <View style={[styles.heroContent, { paddingBottom: 16 + insets.bottom * 0.15 }]}>
              <Text style={[styles.heroTitle, { color: '#fff', ...typography.headlineLg }]} numberOfLines={2}>
                {heroItem.title}
              </Text>
              <View style={styles.heroMetaRow}>
                <Text style={[styles.heroMeta, { ...typography.bodyMd }]}>{heroItem.year}</Text>
                {heroItem.ratingValue > 0 && (
                  <View style={styles.heroRatingPill}>
                    <Text style={[styles.heroRatingText, { ...typography.labelSm }]}>TMDB {heroItem.ratingValue.toFixed(1)}</Text>
                  </View>
                )}
                <View style={styles.heroTypePill}>
                  <Ionicons name={heroItem.mediaType === 'tv' ? 'tv-outline' : 'film-outline'} size={14} color="#fff" />
                  <Text style={[styles.heroTypeText, { ...typography.labelSm }]}>
                    {heroItem.mediaType === 'tv' ? 'Series' : 'Movie'}
                  </Text>
                </View>
              </View>
              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={[styles.heroBtnPrimary, { backgroundColor: colors.primary, borderRadius: radii.lg }]}
                  onPress={() => onSelectItem?.(heroItem)}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={`More about ${heroItem.title}`}
                >
                  <Ionicons name="information-circle-outline" size={20} color={colors.onPrimary} />
                  <Text style={[styles.heroBtnPrimaryText, { color: colors.onPrimary, ...typography.labelSm }]}>
                    More info
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.heroBtnGhost, { borderColor: '#ffffff66', borderRadius: radii.lg }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onToggleWatchlist?.(heroItem);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isWatchlisted(watchlist, heroItem)
                      ? `Remove ${heroItem.title} from watchlist`
                      : `Save ${heroItem.title} to watchlist`
                  }
                >
                  <Ionicons
                    name={isWatchlisted(watchlist, heroItem) ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
              {spotlight.length > 1 && (
                <View style={styles.dotsRow} accessibilityLabel="Spotlight pages">
                  {spotlight.map((_, i) => (
                    <TouchableOpacity
                      key={`dot-${i}`}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setHeroIndex(i);
                        pauseHero();
                        scheduleResumeHero();
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
              )}
            </View>
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
          watchlist={watchlist}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
          onToggleWatchlist={onToggleWatchlist}
        />
      ))}

      {!railsLoading && nowPlayingRail?.length ? (
        <ContentRail
          title="Now playing in theaters"
          data={nowPlayingRail}
          watchlist={watchlist}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
          onToggleWatchlist={onToggleWatchlist}
        />
      ) : null}

      {!railsLoading && traktRail?.length ? (
        <ContentRail
          title="Trending on Trakt"
          data={traktRail}
          watchlist={watchlist}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
          onToggleWatchlist={onToggleWatchlist}
        />
      ) : null}

      {HOME_TMDB_RAILS.map((def) => (
        <ContentRail
          key={def.id}
          title={def.title}
          data={tmdbRails[def.id] || []}
          watchlist={watchlist}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
          onToggleWatchlist={onToggleWatchlist}
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
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  heroBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  heroBtnPrimaryText: { fontWeight: '800' },
  heroBtnGhost: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
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
  savedDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSave: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { marginTop: 8, fontWeight: '700', minHeight: 34 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardYear: { fontSize: 11, fontWeight: '600' },
  railsLoading: { paddingVertical: 28, alignItems: 'center' },
});
