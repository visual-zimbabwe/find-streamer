import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  FlatList,
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
import MorphingText from '../lib/expo-morphing-text/components/morphing-text';
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

export function ContentRail({ title, data, colors, typography, radii, onSelectItem, headerRight = null }) {
  if (!data?.length) return null;
  return (
    <View style={styles.railBlock}>
      <View style={styles.railHeaderRow}>
        <Text
          style={[styles.railTitle, { color: colors.onSurface, ...typography.titleMd }]}
          accessibilityRole="header"
          numberOfLines={2}
        >
          {title}
        </Text>
        {headerRight}
      </View>
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
  const heroH = verticalScale(400);
  const bottomNavScroll = useBottomNavScroll();

  const [spotlight, setSpotlight] = useState([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroListRef = useRef(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);

  // heroItem is derived after filteredSpotlight is computed (below); placeholder null until then
  // (computed further down once filteredSpotlight is available)

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

  const filteredLengthRef = useRef(0);

  useEffect(() => {
    if (spotlight.length <= 1) return undefined;
    const tick = setInterval(() => {
      if (pausedRef.current) return;
      setHeroIndex((i) => {
        const len = filteredLengthRef.current || 1;
        const next = (i + 1) % len;
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

  // Android back handler: return the home filter to its default state first.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mediaFilter) {
        onMediaFilterChange?.(null);
        return true; // consume the event
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

  const filteredSpotlight = useMemo(() => {
    if (!mediaFilter) return spotlight;
    return spotlight.filter((it) => it.mediaType === mediaFilter);
  }, [spotlight, mediaFilter]);

  const heroItem = filteredSpotlight[heroIndex] || null;

  const onHeroMomentumEnd = useCallback(
    (e) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.min(filteredSpotlight.length - 1, Math.max(0, Math.round(x / WINDOW_W)));
      setHeroIndex(i);
      scheduleResumeHero();
    },
    [filteredSpotlight.length, scheduleResumeHero]
  );

  // Sync heroIndex when filteredSpotlight changes (filter switch or spotlight load)
  useEffect(() => {
    filteredLengthRef.current = filteredSpotlight.length;
    setHeroIndex(0);
    requestAnimationFrame(() => {
      heroListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [filteredSpotlight.length, mediaFilter]);

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
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: WINDOW_W, height: heroH }}
            resizeMode="cover"
            accessibilityLabel={`Backdrop for ${item.title}`}
            title={item.title}
          />
          <ProgressiveBlur
            intensity={72}
            tint="dark"
            direction="bottom"
            locations={[0.18, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={styles.heroTopScrim} />
          <View style={[styles.heroContent, { paddingBottom: 52 + insets.bottom * 0.2 }]}>
            <MorphingText
              text={item.title}
              fontSize={typography.headlineLg.fontSize || 32}
              color="#fff"
              fontStyle={{
                fontWeight: '800',
                textShadowColor: 'rgba(0,0,0,0.45)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
                letterSpacing: typography.headlineLg.letterSpacing,
              }}
              style={{ flexWrap: 'wrap' }}
              animationDuration={300}
            />
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
    <View style={styles.rootWrap}>
      {/* ── Paramount-style home top navigation ───────────────────────── */}
      <HomeTopNav
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
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 112 }]}
        showsVerticalScrollIndicator={false}
        {...bottomNavScroll}
      >
      <View style={[styles.heroShell, { height: heroH }]}>
        {heroLoading ? (
          <View style={[styles.heroLoading, { backgroundColor: colors.surfaceContainerHighest }]}>
            <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading spotlight" />
          </View>
        ) : filteredSpotlight.length ? (
          <>
            <FlatList
              ref={heroListRef}
              style={styles.heroList}
              data={filteredSpotlight}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
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
            {filteredSpotlight.length > 1 ? (
              <View
                style={[styles.heroDotsOverlay, { paddingBottom: 10 + insets.bottom * 0.25 }]}
                pointerEvents="box-none"
                accessibilityLabel="Spotlight pages"
              >
                <View style={styles.dotsRow}>
                  {filteredSpotlight.map((_, i) => (
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
                      accessibilityLabel={`Show spotlight item ${i + 1} of ${filteredSpotlight.length}`}
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

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollInner: { paddingTop: 0 },

  heroShell: {
    width: WINDOW_W,
    position: 'relative',
    overflow: 'hidden',
  },
  heroList: { width: WINDOW_W, flexGrow: 0, flexShrink: 0 },
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
  railHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
    marginBottom: 12,
    gap: 8,
  },
  railTitle: {
    flex: 1,
    fontWeight: '800',
    paddingHorizontal: 20,
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
});
