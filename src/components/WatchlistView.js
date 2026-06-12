import React, { memo, useMemo, useRef, useState, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { StatePanel } from './StatePanel';
import { MediaArtwork } from './MediaArtwork';
import {
  getUserWatchlistCollections,
  getStatusLabel,
  isInUserLibrary,
  watchlistEntryKey,
} from '../lib/watchlistModel';
import { fetchNowPlayingMovies } from '../lib/tmdb';
import { classifyAppError } from '../lib/errors';
import { scale, verticalScale } from '../utils/responsive';
import * as Haptics from 'expo-haptics';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WINDOW_W = Dimensions.get('window').width;
const GRID_PAD = scale(22);
const GRID_GAP = scale(14);
const GRID_COL_W = (WINDOW_W - GRID_PAD * 2 - GRID_GAP) / 2;
const GRID_POSTER_H = GRID_COL_W * 1.5;
const GOLD_ACCENT = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';

function parseRatingValue(rating) {
  if (rating == null || rating === '') return 0;
  const n = parseFloat(String(rating).split('/')[0]);
  return Number.isFinite(n) ? n : 0;
}

function ProgrammeSectionHeader({ eyebrow, title, subtitle, colors, typography }) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? (
        <Text style={[styles.sectionEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>{eyebrow}</Text>
      ) : null}
      <Text
        style={[styles.sectionTitle, { color: colors.onSurface, ...typography.titleMd }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function SectionHairline({ color }) {
  return <View style={[styles.sectionDivider, { backgroundColor: color || GOLD_DIM }]} />;
}

const NowPlayingGridCard = memo(function NowPlayingGridCard({ item, colors, typography, radii, onSelect }) {
  const ratingValue = parseRatingValue(item.rating);

  return (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={() => onSelect(item)}
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
        {ratingValue > 0 && (
          <View style={[styles.ratingBadge, { borderRadius: radii.sm }]}>
            <Text style={styles.ratingBadgeText}>★ {ratingValue.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, { color: colors.onSurface, ...typography.labelSm }]} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.cardMeta}>
        <Ionicons name="film-outline" size={11} color={colors.onSurfaceVariant} />
        <Text style={[styles.cardYear, { color: colors.onSurfaceVariant }]}>Movie · {item.year}</Text>
      </View>
    </TouchableOpacity>
  );
});

function WatchlistGridCard({ item, colors, typography, radii, onSelect, onRemove, onMarkWatched }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_THRESHOLD = 72;
  const ratingValue = parseRatingValue(item.rating);

  const resetPosition = () => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const completeSwipe = (direction) => {
    Haptics.selectionAsync();
    Animated.timing(translateX, {
      toValue: direction === 'left' ? -GRID_COL_W : GRID_COL_W,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      if (direction === 'left') {
        onMarkWatched(item);
      } else {
        onRemove(item);
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderMove: (_, gesture) => {
        const clamped = Math.max(-96, Math.min(96, gesture.dx));
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
    inputRange: [0, 72],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const watchedOpacity = translateX.interpolate({
    inputRange: [-72, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.swipeShell, { width: GRID_COL_W }]}>
      <Animated.View style={[styles.swipeAction, styles.swipeRemoveAction, { opacity: removeOpacity }]}>
        <Ionicons name="trash-outline" size={18} color={colors.error} />
        <Text style={[styles.swipeActionText, { color: colors.error, ...typography.labelSm }]}>Remove</Text>
      </Animated.View>
      <Animated.View style={[styles.swipeAction, styles.swipeWatchedAction, { opacity: watchedOpacity }]}>
        <Text style={[styles.swipeActionText, { color: GOLD_ACCENT, ...typography.labelSm }]}>Watched</Text>
        <Ionicons name="checkmark-circle-outline" size={18} color={GOLD_ACCENT} />
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.85}
          onPress={() => onSelect(item)}
          accessibilityRole="button"
          accessibilityLabel={`Open details for ${item.title}. Swipe left to mark as watched, or swipe right to remove.`}
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
            {ratingValue > 0 && (
              <View style={[styles.ratingBadge, { borderRadius: radii.sm }]}>
                <Text style={styles.ratingBadgeText}>★ {ratingValue.toFixed(1)}</Text>
              </View>
            )}
            {item.status && item.status !== 'saved' && (
              <View style={[styles.statusPill, { backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: radii.sm }]}>
                <Ionicons
                  name={item.status === 'watched' ? 'checkmark-circle-outline' : item.status === 'watching' ? 'play-circle-outline' : 'archive-outline'}
                  size={11}
                  color={item.status === 'watched' ? GOLD_ACCENT : '#fff'}
                />
                <Text style={[styles.statusPillText, typography.labelSm]}>{getStatusLabel(item.status)}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardTitle, { color: colors.onSurface, ...typography.labelSm }]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.cardMeta}>
            <Ionicons
              name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
              size={11}
              color={colors.onSurfaceVariant}
            />
            <Text style={[styles.cardYear, { color: colors.onSurfaceVariant }]}>
              {item.mediaType === 'tv' ? 'Series' : 'Movie'} · {item.year}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function buildGridRows(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function PosterGrid({ items, renderItem }) {
  const rows = buildGridRows(items);
  return (
    <View style={styles.gridBody}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.gridRow}>
          {row.map((item) => (
            <View key={watchlistEntryKey(item)}>{renderItem(item)}</View>
          ))}
          {row.length === 1 ? <View style={styles.gridCardSpacer} /> : null}
        </View>
      ))}
    </View>
  );
}

export function WatchlistView({ items, collections = [], onRemove, onMarkWatched, onSelect, onBrowseMovies, onBrowseTV }) {
  const { theme, resolvedMode } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const bottomNavScroll = useBottomNavScroll();

  const [randomPick, setRandomPick] = useState(null);
  const pickOpacity = useRef(new Animated.Value(0)).current;
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState({});
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState({});

  const [nowPlaying, setNowPlaying] = useState([]);
  const [nowPlayingLoading, setNowPlayingLoading] = useState(true);
  const [nowPlayingError, setNowPlayingError] = useState(null);

  const glassSurface = resolvedMode === 'dark' ? 'rgba(12, 12, 14, 0.96)' : 'rgba(247, 247, 242, 0.96)';
  const atmosphereColors = [
    resolvedMode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
    colors.background,
  ];

  const libraryItems = useMemo(
    () => (items || []).filter(isInUserLibrary),
    [items]
  );

  const pickableItems = useMemo(
    () => libraryItems.filter((item) => item.status !== 'watched'),
    [libraryItems]
  );

  const chooseRandomPick = () => {
    const source = pickableItems.length ? pickableItems : libraryItems.length ? libraryItems : items;
    if (!source?.length) return;
    const nextPick = source[Math.floor(Math.random() * source.length)];
    setRandomPick(nextPick);
    pickOpacity.setValue(0);
    Haptics.selectionAsync();
    Animated.timing(pickOpacity, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
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

  if (!libraryItems.length) {
    return (
      <StatePanel
        type="empty"
        title="Your Watchlist"
        description="You have no titles saved yet. Explore movies and add them to your collection."
      />
    );
  }

  const sortByRatingDesc = (arr) =>
    [...arr].sort((a, b) => parseRatingValue(b.rating) - parseRatingValue(a.rating));

  const availableCollections = collections.length ? collections : getUserWatchlistCollections();
  const groupedItems = availableCollections
    .map((collection) => {
      const all = libraryItems.filter((item) => item.collectionIds?.includes(collection.id));
      const movies = sortByRatingDesc(all.filter((item) => item.mediaType === 'movie'));
      const tvShows = sortByRatingDesc(all.filter((item) => item.mediaType !== 'movie'));
      return {
        id: collection.id,
        label: collection.name,
        icon: collection.icon,
        movies,
        tvShows,
        totalCount: all.length,
      };
    })
    .filter((category) => category.totalCount > 0);

  const isCategoryCollapsed = (categoryId) => collapsedCategoryIds[categoryId] ?? true;

  const toggleCategory = (categoryId) => {
    Haptics.selectionAsync();
    setCollapsedCategoryIds((current) => {
      const collapsed = current[categoryId] ?? true;
      return { ...current, [categoryId]: !collapsed };
    });
  };

  const groupKey = (categoryId, groupLabel) => `${categoryId}::${groupLabel}`;

  const toggleGroup = (categoryId, groupLabel) => {
    Haptics.selectionAsync();
    setCollapsedGroupKeys((current) => {
      const key = groupKey(categoryId, groupLabel);
      const collapsed = current[key] ?? true;
      return { ...current, [key]: !collapsed };
    });
  };

  const isGroupCollapsed = (categoryId, groupLabel) =>
    collapsedGroupKeys[groupKey(categoryId, groupLabel)] ?? true;

  const retryNowPlaying = () => {
    setNowPlayingLoading(true);
    setNowPlayingError(null);
    fetchNowPlayingMovies()
      .then(setNowPlaying)
      .catch((err) => setNowPlayingError(classifyAppError(err).message || 'Could not load Now Playing.'))
      .finally(() => setNowPlayingLoading(false));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        {...bottomNavScroll}
      >
        <ProgrammeSectionHeader
          eyebrow="Personal Ledger"
          title="My Watchlist"
          subtitle={`${libraryItems.length} ${libraryItems.length === 1 ? 'Title' : 'Titles'} Saved`}
          colors={colors}
          typography={typography}
        />

        <View
          style={[
            styles.randomPanel,
            {
              backgroundColor: glassSurface,
              borderColor: GOLD_DIM,
              borderRadius: radii.xl,
            },
          ]}
        >
          <View style={styles.randomCopy}>
            <Text style={[styles.randomEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>Random Pick</Text>
            <Text style={[styles.randomTitle, { color: colors.onSurface, ...typography.titleLg }]}>What should I watch?</Text>
            <Text style={[styles.randomSubtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
              Shuffle your saved titles when decision fatigue hits.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.randomButton, { borderColor: GOLD_ACCENT, borderRadius: radii.full }]}
            onPress={chooseRandomPick}
            accessibilityRole="button"
            accessibilityLabel="Pick a random title from your watchlist"
          >
            <Ionicons name="shuffle" size={18} color={GOLD_ACCENT} />
            <Text style={[styles.randomButtonText, { color: GOLD_ACCENT, ...typography.labelSm }]}>Pick</Text>
          </TouchableOpacity>
          {randomPick && (
            <Animated.View
              style={[
                styles.randomResult,
                {
                  opacity: pickOpacity,
                  backgroundColor: resolvedMode === 'dark' ? 'rgba(212,168,83,0.08)' : 'rgba(212,168,83,0.12)',
                  borderColor: GOLD_DIM,
                  borderRadius: radii.lg,
                },
              ]}
            >
              <MediaArtwork
                uri={randomPick.posterUrl}
                style={[styles.randomPoster, { borderRadius: radii.md }]}
                accessibilityLabel={`${randomPick.title} poster`}
                title={randomPick.title}
                instant
              />
              <View style={styles.randomResultCopy}>
                <Text style={[styles.randomResultLabel, { color: GOLD_ACCENT, ...typography.labelSm }]}>Tonight's Pick</Text>
                <Text style={[styles.randomResultTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
                  {randomPick.title}
                </Text>
                <Text style={[styles.randomResultMeta, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={1}>
                  {randomPick.year} · {getStatusLabel(randomPick.status)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.randomOpenButton, { borderColor: GOLD_DIM, borderRadius: radii.full }]}
                onPress={() => onSelect(randomPick)}
                accessibilityRole="button"
                accessibilityLabel={`Open details for ${randomPick.title}`}
              >
                <Ionicons name="chevron-forward" size={18} color={GOLD_ACCENT} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        <SectionHairline />

        <View style={styles.categoryStack}>
          <View style={styles.categorySection}>
            <TouchableOpacity
              style={styles.categoryHeading}
              activeOpacity={0.75}
              onPress={() => toggleCategory('now_playing')}
              accessibilityRole="button"
              accessibilityLabel={`${isCategoryCollapsed('now_playing') ? 'Expand' : 'Collapse'} Now Playing`}
              accessibilityState={{ expanded: !isCategoryCollapsed('now_playing') }}
            >
              <View style={[styles.categoryIcon, { backgroundColor: GOLD_ACCENT + '18', borderColor: GOLD_DIM }]}>
                <Ionicons name="film-outline" size={18} color={GOLD_ACCENT} />
              </View>
              <View style={styles.categoryHeadingText}>
                <Text style={[styles.categoryEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>In Theatres</Text>
                <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleMd }]}>Now Playing</Text>
                <Text style={[styles.categoryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                  {nowPlayingLoading ? 'Loading…' : nowPlayingError ? 'Unavailable' : `${nowPlaying.length} ${nowPlaying.length === 1 ? 'Title' : 'Titles'}`}
                </Text>
              </View>
              <View style={[styles.categoryToggle, { borderColor: GOLD_DIM }]}>
                <Ionicons
                  name={isCategoryCollapsed('now_playing') ? 'chevron-down' : 'chevron-up'}
                  size={16}
                  color={colors.onSurfaceVariant}
                />
              </View>
            </TouchableOpacity>

            {!isCategoryCollapsed('now_playing') && (
              <View style={styles.sectionBody}>
                {nowPlayingLoading && (
                  <ActivityIndicator size="small" color={GOLD_ACCENT} style={styles.sectionLoader} accessibilityLabel="Loading Now Playing" />
                )}
                {!nowPlayingLoading && nowPlayingError && (
                  <TouchableOpacity
                    style={[styles.inlineRetry, { backgroundColor: colors.error + '12', borderColor: colors.error + '33', borderRadius: radii.md }]}
                    onPress={retryNowPlaying}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading Now Playing"
                  >
                    <Ionicons name="refresh-outline" size={16} color={colors.error} />
                    <Text style={[styles.inlineRetryText, { color: colors.error, ...typography.bodyMd }]}>
                      Could not load this section. Tap to retry.
                    </Text>
                  </TouchableOpacity>
                )}
                {!nowPlayingLoading && !nowPlayingError && nowPlaying.length > 0 && (
                  <PosterGrid
                    items={nowPlaying}
                    renderItem={(item) => (
                      <NowPlayingGridCard
                        item={item}
                        colors={colors}
                        typography={typography}
                        radii={radii}
                        onSelect={onSelect}
                      />
                    )}
                  />
                )}
              </View>
            )}
          </View>

          {groupedItems.map((category, categoryIndex) => {
            const isCollapsed = isCategoryCollapsed(category.id);

            return (
              <View key={category.id}>
                {categoryIndex > 0 || !isCategoryCollapsed('now_playing') ? <SectionHairline /> : null}
                <View style={styles.categorySection}>
                  <TouchableOpacity
                    style={styles.categoryHeading}
                    activeOpacity={0.75}
                    onPress={() => toggleCategory(category.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${category.label}`}
                    accessibilityState={{ expanded: !isCollapsed }}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: GOLD_ACCENT + '18', borderColor: GOLD_DIM }]}>
                      <Ionicons name={category.icon} size={18} color={GOLD_ACCENT} />
                    </View>
                    <View style={styles.categoryHeadingText}>
                      <Text style={[styles.categoryEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>Collection</Text>
                      <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleMd }]}>{category.label}</Text>
                      <Text style={[styles.categoryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                        {category.totalCount} {category.totalCount === 1 ? 'Title' : 'Titles'}
                      </Text>
                    </View>
                    <View style={[styles.categoryToggle, { borderColor: GOLD_DIM }]}>
                      <Ionicons
                        name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                        size={16}
                        color={colors.onSurfaceVariant}
                      />
                    </View>
                  </TouchableOpacity>

                  {!isCollapsed && (
                    <View style={styles.groupStack}>
                      {[
                        { label: 'Movies', icon: 'film-outline', data: category.movies },
                        { label: 'TV Shows', icon: 'tv-outline', data: category.tvShows },
                      ]
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
                                <Ionicons name={group.icon} size={13} color={GOLD_ACCENT} />
                                <Text style={[styles.mediaGroupLabel, { color: colors.onSurface, ...typography.labelSm }]}>
                                  {group.label}
                                </Text>
                                <Text style={[styles.mediaGroupCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                                  {group.data.length}
                                </Text>
                                <View style={[styles.mediaGroupDivider, { backgroundColor: GOLD_DIM }]} />
                                <Ionicons
                                  name={groupCollapsed ? 'chevron-down' : 'chevron-up'}
                                  size={13}
                                  color={colors.onSurfaceVariant}
                                />
                              </TouchableOpacity>

                              {!groupCollapsed && (
                                <PosterGrid
                                  items={group.data}
                                  renderItem={(item) => (
                                    <WatchlistGridCard
                                      item={item}
                                      colors={colors}
                                      typography={typography}
                                      radii={radii}
                                      onSelect={onSelect}
                                      onRemove={onRemove}
                                      onMarkWatched={onMarkWatched}
                                    />
                                  )}
                                />
                              )}
                            </View>
                          );
                        })}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.browseDock, { bottom: insets.bottom + 88, paddingHorizontal: GRID_PAD }]}>
        <View style={[styles.browseDockInner, { backgroundColor: glassSurface, borderColor: GOLD_DIM, borderRadius: radii.xl }]}>
          <TouchableOpacity
            style={styles.browseDockAction}
            onPress={() => {
              Haptics.selectionAsync();
              onBrowseMovies?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="Browse movies"
          >
            <Ionicons name="film-outline" size={18} color={GOLD_ACCENT} />
            <Text style={[styles.browseDockLabel, { color: colors.onSurface, ...typography.labelSm }]}>Movies</Text>
          </TouchableOpacity>
          <View style={[styles.browseDockDivider, { backgroundColor: GOLD_DIM }]} />
          <TouchableOpacity
            style={styles.browseDockAction}
            onPress={() => {
              Haptics.selectionAsync();
              onBrowseTV?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="Browse TV shows"
          >
            <Ionicons name="tv-outline" size={18} color={GOLD_ACCENT} />
            <Text style={[styles.browseDockLabel, { color: colors.onSurface, ...typography.labelSm }]}>TV Shows</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  atmosphereTop: {
    height: verticalScale(220),
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: GRID_PAD,
    paddingTop: scale(28),
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: scale(22),
  },
  sectionEyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: scale(22),
    opacity: 0.65,
  },
  randomPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: scale(16),
    marginBottom: scale(8),
    padding: scale(18),
  },
  randomCopy: {
    gap: 4,
  },
  randomEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  randomTitle: {
    fontWeight: '800',
  },
  randomSubtitle: {
    fontWeight: '500',
  },
  randomButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: scale(18),
  },
  randomButtonText: {
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  randomResult: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
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
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  randomResultTitle: {
    fontWeight: '800',
    lineHeight: 26,
  },
  randomResultMeta: {
    fontWeight: '600',
  },
  randomOpenButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: verticalScale(48),
    justifyContent: 'center',
    width: scale(48),
  },
  categoryStack: {
    gap: scale(8),
  },
  categorySection: {
    gap: scale(16),
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
    borderWidth: StyleSheet.hairlineWidth,
    height: scale(40),
    justifyContent: 'center',
    width: scale(40),
  },
  categoryHeadingText: {
    flex: 1,
  },
  categoryEyebrow: {
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  categoryTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  categoryCount: {
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  categoryToggle: {
    alignItems: 'center',
    borderRadius: scale(18),
    borderWidth: StyleSheet.hairlineWidth,
    height: scale(36),
    justifyContent: 'center',
    width: scale(36),
  },
  sectionBody: {
    gap: scale(12),
  },
  sectionLoader: {
    marginVertical: scale(16),
  },
  groupStack: {
    gap: scale(24),
  },
  mediaGroup: {
    gap: scale(14),
  },
  mediaGroupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingVertical: 4,
  },
  mediaGroupLabel: {
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mediaGroupCount: {
    fontWeight: '700',
  },
  mediaGroupDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
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
    height: GRID_POSTER_H,
    overflow: 'hidden',
    position: 'relative',
    width: GRID_COL_W,
  },
  gridPosterImg: {
    height: '100%',
    width: '100%',
  },
  ratingBadge: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: 'absolute',
    top: 8,
  },
  ratingBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
  },
  statusPill: {
    alignItems: 'center',
    bottom: 8,
    flexDirection: 'row',
    gap: 4,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
  },
  statusPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontWeight: '700',
    marginTop: 8,
    minHeight: 34,
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  cardYear: {
    fontSize: 11,
    fontWeight: '600',
  },
  swipeShell: {
    overflow: 'hidden',
    position: 'relative',
  },
  swipeAction: {
    alignItems: 'center',
    bottom: GRID_POSTER_H + scale(42),
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  swipeRemoveAction: {
    left: 0,
  },
  swipeWatchedAction: {
    right: 0,
  },
  swipeActionText: {
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inlineRetry: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  inlineRetryText: {
    flex: 1,
    fontWeight: '700',
  },
  browseDock: {
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  browseDockInner: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
    overflow: 'hidden',
  },
  browseDockAction: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  browseDockDivider: {
    width: StyleSheet.hairlineWidth,
  },
  browseDockLabel: {
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
