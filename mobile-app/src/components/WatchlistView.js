import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { StatePanel } from './StatePanel';
import { MediaArtwork } from './MediaArtwork';
import { WATCHLIST_CATEGORIES, getWatchlistCategory } from '../lib/watchlistCategories';
import { fetchNowPlayingMovies } from '../lib/tmdb';
import { classifyAppError } from '../lib/errors';
import { scale, verticalScale } from '../utils/responsive';

function WatchlistItem({ item, onSelect, onRemove, onMarkWatched, colors, typography, radii }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_THRESHOLD = 88;

  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  };

  const completeSwipe = (direction) => {
    Animated.timing(translateX, {
      toValue: direction === 'left' ? -420 : 420,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      if (direction === 'left') {
        onMarkWatched(item.tmdbId);
      } else {
        onRemove(item.tmdbId);
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderMove: (_, gesture) => {
        const clamped = Math.max(-128, Math.min(128, gesture.dx));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx <= -SWIPE_THRESHOLD) {
          completeSwipe('left');
        } else if (gesture.dx >= SWIPE_THRESHOLD) {
          completeSwipe('right');
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: resetPosition,
    })
  ).current;

  const removeOpacity = translateX.interpolate({
    inputRange: [0, 90],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const watchedOpacity = translateX.interpolate({
    inputRange: [-90, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeShell}>
      <Animated.View
        style={[
          styles.swipeAction,
          styles.swipeRemoveAction,
          { opacity: removeOpacity, backgroundColor: colors.error + '18', borderRadius: radii.xl },
        ]}
      >
        <Ionicons name="trash-outline" size={22} color={colors.error} />
        <Text style={[styles.swipeActionText, { color: colors.error, ...typography.labelSm }]}>Remove</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.swipeAction,
          styles.swipeWatchedAction,
          { opacity: watchedOpacity, backgroundColor: colors.primary + '18', borderRadius: radii.xl },
        ]}
      >
        <Text style={[styles.swipeActionText, { color: colors.primary, ...typography.labelSm }]}>Watched</Text>
        <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
      </Animated.View>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface }]}
          activeOpacity={0.8}
          onPress={() => onSelect(item)}
          accessibilityRole="button"
          accessibilityLabel={`Open details for ${item.title}. Swipe left to mark as watched, or swipe right to remove.`}
        >
          <View style={[styles.posterWrapper, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
            <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} title={item.title} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.itemTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.meta}>
              <Ionicons name="star" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary }}>{item.rating}</Text>
              <Text style={{ color: colors.onSurfaceVariant }}>• {item.year}</Text>
            </View>
            <Text style={[styles.synopsis, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
              {item.synopsis}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export function WatchlistView({ items, onRemove, onMarkWatched, onSelect }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const [randomPick, setRandomPick] = useState(null);
  const pickScale = useRef(new Animated.Value(0.96)).current;
  const pickOpacity = useRef(new Animated.Value(0)).current;
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState(
    () => Object.fromEntries([...WATCHLIST_CATEGORIES.map((c) => [c.id, true]), ['now_playing', true]])
  );
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState({});

  const [nowPlaying, setNowPlaying] = useState([]);
  const [nowPlayingLoading, setNowPlayingLoading] = useState(true);
  const [nowPlayingError, setNowPlayingError] = useState(null);

  const pickableItems = useMemo(
    () => (items || []).filter((item) => getWatchlistCategory(item.watchlistCategoryId).id !== 'watched'),
    [items]
  );

  const chooseRandomPick = () => {
    const source = pickableItems.length ? pickableItems : items;
    if (!source?.length) return;
    const nextPick = source[Math.floor(Math.random() * source.length)];
    setRandomPick(nextPick);
    pickScale.setValue(0.94);
    pickOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(pickScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(pickOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    let cancelled = false;
    setNowPlayingLoading(true);
    setNowPlayingError(null);
    fetchNowPlayingMovies()
      .then((results) => { if (!cancelled) setNowPlaying(results); })
      .catch((err) => { if (!cancelled) setNowPlayingError(classifyAppError(err).message || 'Could not load Now Playing.'); })
      .finally(() => { if (!cancelled) setNowPlayingLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!items || items.length === 0) {
    return (
      <StatePanel 
        type="empty" 
        title="Your Watchlist" 
        description="You have no titles saved yet. Explore movies and add them to your collection."
      />
    );
  }

  const sortByRatingDesc = (arr) =>
    [...arr].sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));

  const groupedItems = WATCHLIST_CATEGORIES
    .map((category) => {
      const all = items.filter((item) => getWatchlistCategory(item.watchlistCategoryId).id === category.id);
      const movies = sortByRatingDesc(all.filter((item) => item.mediaType === 'movie'));
      const tvShows = sortByRatingDesc(all.filter((item) => item.mediaType !== 'movie'));
      return { ...category, movies, tvShows, totalCount: all.length };
    })
    .filter((category) => category.totalCount > 0);

  const toggleCategory = (categoryId) => {
    setCollapsedCategoryIds((current) => ({
      ...current,
      [categoryId]: !current[categoryId],
    }));
  };

  const groupKey = (categoryId, groupLabel) => `${categoryId}::${groupLabel}`;

  const toggleGroup = (categoryId, groupLabel) => {
    const key = groupKey(categoryId, groupLabel);
    setCollapsedGroupKeys((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const isGroupCollapsed = (categoryId, groupLabel) =>
    !!collapsedGroupKeys[groupKey(categoryId, groupLabel)];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface, ...typography.headlineLg }]}>My Watchlist</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          You have {items.length} titles saved to watch later.
        </Text>
      </View>

      <View style={[styles.randomPanel, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '55', borderRadius: radii.xl }]}>
        <View style={styles.randomCopy}>
          <Text style={[styles.randomEyebrow, { color: colors.primary, ...typography.labelSm }]}>Random Pick</Text>
          <Text style={[styles.randomTitle, { color: colors.onSurface, ...typography.titleLg }]}>What should I watch?</Text>
          <Text style={[styles.randomSubtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
            Shuffle your saved titles when decision fatigue hits.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.randomButton, { backgroundColor: colors.primary, borderRadius: radii.full }]}
          onPress={chooseRandomPick}
          accessibilityRole="button"
          accessibilityLabel="Pick a random title from your watchlist"
        >
          <Ionicons name="shuffle" size={18} color={colors.onPrimary} />
          <Text style={[styles.randomButtonText, { color: colors.onPrimary, ...typography.labelSm }]}>Pick</Text>
        </TouchableOpacity>
        {randomPick && (
          <Animated.View
            style={[
              styles.randomResult,
              {
                opacity: pickOpacity,
                transform: [{ scale: pickScale }],
                backgroundColor: colors.primary + '14',
                borderColor: colors.primary + '33',
                borderRadius: radii.lg,
              },
            ]}
          >
            <MediaArtwork uri={randomPick.posterUrl} style={[styles.randomPoster, { borderRadius: radii.md }]} accessibilityLabel={`${randomPick.title} poster`} title={randomPick.title} />
            <View style={styles.randomResultCopy}>
              <Text style={[styles.randomResultLabel, { color: colors.primary, ...typography.labelSm }]}>Tonight's Pick</Text>
              <Text style={[styles.randomResultTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>{randomPick.title}</Text>
              <Text style={[styles.randomResultMeta, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={1}>
                {randomPick.year} • {getWatchlistCategory(randomPick.watchlistCategoryId).label}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.randomOpenButton, { borderColor: colors.primary + '66', borderRadius: radii.full }]}
              onPress={() => onSelect(randomPick)}
              accessibilityRole="button"
              accessibilityLabel={`Open details for ${randomPick.title}`}
            >
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <View style={styles.categoryStack}>
        {/* ── Now Playing ── */}
        <View style={styles.categorySection}>
          <TouchableOpacity
            style={styles.categoryHeading}
            activeOpacity={0.75}
            onPress={() => toggleCategory('now_playing')}
            accessibilityRole="button"
            accessibilityLabel={`${collapsedCategoryIds['now_playing'] ? 'Expand' : 'Collapse'} Now Playing`}
            accessibilityState={{ expanded: !collapsedCategoryIds['now_playing'] }}
          >
            <View style={[styles.categoryIcon, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name="film-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.categoryHeadingText}>
              <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]}>Now Playing</Text>
              <Text style={[styles.categoryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                {nowPlayingLoading ? 'Loading…' : nowPlayingError ? 'Unavailable' : `${nowPlaying.length} ${nowPlaying.length === 1 ? 'Title' : 'Titles'}`}
              </Text>
            </View>
            <View style={[styles.categoryToggle, { borderColor: colors.outlineVariant }]}>
              <Ionicons
                name={collapsedCategoryIds['now_playing'] ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={colors.onSurfaceVariant}
              />
            </View>
          </TouchableOpacity>

          {!collapsedCategoryIds['now_playing'] && (
            <View style={styles.list}>
              {nowPlayingLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
              )}
              {!nowPlayingLoading && nowPlayingError && (
                <TouchableOpacity
                  style={[styles.inlineRetry, { backgroundColor: colors.error + '12', borderColor: colors.error + '33', borderRadius: radii.md }]}
                  onPress={() => {
                    setNowPlayingLoading(true);
                    setNowPlayingError(null);
                    fetchNowPlayingMovies()
                      .then(setNowPlaying)
                      .catch((err) => setNowPlayingError(classifyAppError(err).message || 'Could not load Now Playing.'))
                      .finally(() => setNowPlayingLoading(false));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading Now Playing"
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.error} />
                  <Text style={[styles.inlineRetryText, { color: colors.error, ...typography.bodyMd }]}>
                    Could not load this section. Tap to retry.
                  </Text>
                </TouchableOpacity>
              )}
              {!nowPlayingLoading && !nowPlayingError && nowPlaying.map((item) => (
                <TouchableOpacity
                  key={item.tmdbId}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => onSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open details for ${item.title}`}
                >
                  <View style={[styles.posterWrapper, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
                    <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} title={item.title} />
                  </View>
                  <View style={styles.info}>
                    <View style={styles.badgeRow}>
                      <Text style={[styles.mediaType, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Movie</Text>
                    </View>
                    <Text style={[styles.itemTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.meta}>
                      <Ionicons name="star" size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary }}>{item.rating}</Text>
                      <Text style={{ color: colors.onSurfaceVariant }}>• {item.year}</Text>
                    </View>
                    <Text style={[styles.synopsis, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
                      {item.synopsis}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── User watchlist categories ── */}
        {groupedItems.map((category) => {
          const isCollapsed = collapsedCategoryIds[category.id];

          return (
            <View key={category.id} style={styles.categorySection}>
              <TouchableOpacity
                style={styles.categoryHeading}
                activeOpacity={0.75}
                onPress={() => toggleCategory(category.id)}
                accessibilityRole="button"
                accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${category.label}`}
                accessibilityState={{ expanded: !isCollapsed }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: colors.primary + '22' }]}>
                  <Ionicons name={category.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.categoryHeadingText}>
                  <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]}>{category.label}</Text>
                  <Text style={[styles.categoryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                    {category.totalCount} {category.totalCount === 1 ? 'Title' : 'Titles'}
                  </Text>
                </View>
                <View style={[styles.categoryToggle, { borderColor: colors.outlineVariant }]}>
                  <Ionicons
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color={colors.onSurfaceVariant}
                  />
                </View>
              </TouchableOpacity>

              {!isCollapsed && (
                <View style={styles.groupStack}>
                  {[{ label: 'Movies', icon: 'film-outline', data: category.movies }, { label: 'TV Shows', icon: 'tv-outline', data: category.tvShows }]
                    .filter((g) => g.data.length > 0)
                    .map((group) => {
                      const groupCollapsed = isGroupCollapsed(category.id, group.label);
                      return (
                        <View key={group.label} style={styles.mediaGroup}>
                          <TouchableOpacity
                            style={styles.mediaGroupHeader}
                            activeOpacity={0.75}
                            onPress={() => toggleGroup(category.id, group.label)}
                            accessibilityRole="button"
                            accessibilityLabel={`${groupCollapsed ? 'Expand' : 'Collapse'} ${group.label}`}
                            accessibilityState={{ expanded: !groupCollapsed }}
                          >
                            <Ionicons name={group.icon} size={14} color={colors.onSurfaceVariant} />
                            <Text style={[styles.mediaGroupLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                              {group.label}
                            </Text>
                            <Text style={[styles.mediaGroupCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                              {group.data.length}
                            </Text>
                            <View style={[styles.mediaGroupDivider, { backgroundColor: colors.outlineVariant }]} />
                            <Ionicons
                              name={groupCollapsed ? 'chevron-down' : 'chevron-up'}
                              size={14}
                              color={colors.onSurfaceVariant}
                            />
                          </TouchableOpacity>

                          {!groupCollapsed && (
                            <View style={styles.list}>
                              {group.data.map((item) => (
                                <WatchlistItem
                                  key={item.tmdbId}
                                  item={item}
                                  onSelect={onSelect}
                                  onRemove={onRemove}
                                  onMarkWatched={onMarkWatched}
                                  colors={colors}
                                  typography={typography}
                                  radii={radii}
                                />
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })
                  }
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 22,
  },
  title: {
    fontWeight: '900',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  subtitle: {
    fontWeight: '500',
  },
  randomPanel: {
    borderWidth: 1,
    gap: 16,
    marginBottom: 38,
    padding: 18,
  },
  randomCopy: {
    gap: 4,
  },
  randomEyebrow: {
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  randomTitle: {
    fontWeight: '900',
  },
  randomSubtitle: {
    fontWeight: '500',
  },
  randomButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  randomButtonText: {
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  randomResult: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  randomPoster: {
    height: verticalScale(82),
    overflow: 'hidden',
    width: scale(56),
  },
  randomResultCopy: {
    flex: 1,
    gap: 3,
  },
  randomResultLabel: {
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  randomResultTitle: {
    fontWeight: '900',
    lineHeight: 26,
  },
  randomResultMeta: {
    fontWeight: '600',
  },
  randomOpenButton: {
    alignItems: 'center',
    borderWidth: 1,
    height: verticalScale(48),
    justifyContent: 'center',
    width: scale(48),
  },
  categoryStack: {
    gap: 36,
  },
  categorySection: {
    gap: 18,
  },
  categoryHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: scale(20),
    height: scale(40),
    justifyContent: 'center',
    width: scale(40),
  },
  categoryHeadingText: {
    flex: 1,
  },
  categoryTitle: {
    fontWeight: '900',
  },
  categoryCount: {
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  categoryToggle: {
    alignItems: 'center',
    borderRadius: scale(18),
    borderWidth: 1,
    height: scale(36),
    justifyContent: 'center',
    width: scale(36),
  },
  groupStack: {
    gap: 28,
  },
  mediaGroup: {
    gap: 16,
  },
  mediaGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  mediaGroupLabel: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  mediaGroupCount: {
    fontWeight: '700',
    opacity: 0.6,
  },
  mediaGroupDivider: {
    flex: 1,
    height: 1,
  },
  list: {
    gap: 32,
  },
  swipeShell: {
    overflow: 'hidden',
    position: 'relative',
  },
  swipeAction: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: scale(18),
    position: 'absolute',
    top: 0,
    width: scale(132),
  },
  swipeRemoveAction: {
    left: 0,
  },
  swipeWatchedAction: {
    right: 0,
  },
  swipeActionText: {
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  card: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  posterWrapper: {
    width: scale(120),
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },

  info: {
    flex: 1,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  mediaType: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  itemTitle: {
    fontWeight: '800',
    lineHeight: 28,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  synopsis: {
    lineHeight: 22,
    marginTop: 4,
  },
  inlineRetry: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  inlineRetryText: {
    flex: 1,
    fontWeight: '700',
  },
});
