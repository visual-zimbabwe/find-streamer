import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { EmptyState } from './EmptyState';
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
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD, GRID_GAP, GRID_COL_W, GRID_POSTER_H, buildGridRows } from '../theme/programme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { resolveRatingValue } from '../lib/ratings';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GridPosterCard } from './GridPosterCard';
import { WatchlistSkeleton } from './SkeletonLoaders';

function WatchlistGridCard({
  item,
  colors,
  typography,
  radii,
  onSelect,
  onRemove,
  onMarkWatched,
  reduceMotion = false,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_THRESHOLD = 72;

  const resetPosition = () => {
    if (reduceMotion) {
      translateX.setValue(0);
      return;
    }
    Animated.timing(translateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const completeSwipe = (direction) => {
    Haptics.selectionAsync();
    const finish = () => {
      translateX.setValue(0);
      if (direction === 'left') {
        onMarkWatched(item);
      } else {
        onRemove(item);
      }
    };
    if (reduceMotion) {
      finish();
      return;
    }
    Animated.timing(translateX, {
      toValue: direction === 'left' ? -GRID_COL_W : GRID_COL_W,
      duration: 180,
      useNativeDriver: true,
    }).start(finish);
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
    }),
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
      <Animated.View
        style={[styles.swipeAction, styles.swipeRemoveAction, { opacity: removeOpacity }]}
      >
        <Ionicons name="trash-outline" size={18} color={colors.error} />
        <Text style={[styles.swipeActionText, { color: colors.error, ...typography.labelSm }]}>
          Remove
        </Text>
      </Animated.View>
      <Animated.View
        style={[styles.swipeAction, styles.swipeWatchedAction, { opacity: watchedOpacity }]}
      >
        <Text style={[styles.swipeActionText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          Watched
        </Text>
        <Ionicons name="checkmark-circle-outline" size={18} color={GOLD_ACCENT} />
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onSelect(item)}
          accessibilityRole="button"
          accessibilityLabel={`Open details for ${item.title}. Swipe left to mark as watched, or swipe right to remove.`}
        >
          <GridPosterCard
            item={item}
            colors={colors}
            typography={typography}
            radii={radii}
            pressable={false}
            posterOverlay={
              item.status && item.status !== 'saved' ? (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: radii.sm },
                  ]}
                >
                  <Ionicons
                    name={
                      item.status === 'watched'
                        ? 'checkmark-circle-outline'
                        : item.status === 'watching'
                          ? 'play-circle-outline'
                          : 'archive-outline'
                    }
                    size={11}
                    color={item.status === 'watched' ? GOLD_ACCENT : '#fff'}
                  />
                  <Text style={[styles.statusPillText, typography.labelSm]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              ) : null
            }
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}


const sortByRatingDesc = (arr) =>
  [...arr].sort((a, b) => resolveRatingValue(b) - resolveRatingValue(a));

export function WatchlistView({
  items,
  collections = [],
  onRemove,
  onMarkWatched,
  onSelect,
  onBrowseMovies,
  onBrowseTV,
}) {
  const { theme, resolvedMode } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const bottomNavScroll = useBottomNavScroll();
  const reduceMotion = useReduceMotion();

  const [randomPick, setRandomPick] = useState(null);
  const pickOpacity = useRef(new Animated.Value(0)).current;
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState({});
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState({});

  const [nowPlaying, setNowPlaying] = useState([]);
  const [nowPlayingLoading, setNowPlayingLoading] = useState(true);
  const [nowPlayingError, setNowPlayingError] = useState(null);

  const glassSurface = colors.glass;
  const atmosphereColors = [
    resolvedMode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
    colors.background,
  ];

  const libraryItems = useMemo(() => (items || []).filter(isInUserLibrary), [items]);

  const pickableItems = useMemo(
    () => libraryItems.filter((item) => item.status !== 'watched'),
    [libraryItems],
  );

  const listExtraData = useMemo(
    () => ({ theme, collapsedCategoryIds, collapsedGroupKeys }),
    [theme, collapsedCategoryIds, collapsedGroupKeys],
  );

  const availableCollections = useMemo(
    () => (collections.length ? collections : getUserWatchlistCollections()),
    [collections],
  );

  /**
   * The expensive pass: for every collection, a scan of the whole library plus
   * two rating sorts, and the 2-up row packing. It depends only on the library
   * and the collections — *not* on collapse state — so it is memoised here to
   * keep expand/collapse off this path. Rebuilding it on every toggle cost a
   * ~109 ms frame (2 missed vsyncs) on a 794-title watchlist, which is what was
   * left of P1 after the list itself was virtualized.
   */
  const groupedItems = useMemo(
    () =>
      availableCollections
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
            groups: [
              { label: 'Movies', icon: 'film-outline', data: movies, rows: buildGridRows(movies) },
              { label: 'TV Shows', icon: 'tv-outline', data: tvShows, rows: buildGridRows(tvShows) },
            ].filter((group) => group.data.length > 0),
          };
        })
        .filter((category) => category.totalCount > 0),
    [availableCollections, libraryItems],
  );

  const nowPlayingRows = useMemo(() => buildGridRows(nowPlaying), [nowPlaying]);

  /**
   * Assembling the flat row list *does* depend on collapse state, but it is now
   * only cheap object pushes over pre-packed rows — no filtering, sorting or
   * row-packing happens here.
   */
  const listData = useMemo(() => {
    const rows = [];
    const categoryCollapsed = (id) => collapsedCategoryIds[id] ?? true;
    const groupCollapsed = (categoryId, groupLabel) =>
      collapsedGroupKeys[`${categoryId}::${groupLabel}`] ?? true;

    rows.push({ type: 'nowPlayingHeader', key: 'now-playing-header' });
    if (!categoryCollapsed('now_playing')) {
      if (nowPlayingLoading) {
        rows.push({ type: 'nowPlayingSkeleton', key: 'now-playing-skeleton', mt: scale(12) });
      } else if (nowPlayingError) {
        rows.push({ type: 'nowPlayingError', key: 'now-playing-error', mt: scale(12) });
      } else if (nowPlaying.length > 0) {
        nowPlayingRows.forEach((rowItems, rowIndex) => {
          rows.push({
            type: 'posterRow',
            variant: 'nowPlaying',
            items: rowItems,
            key: `now-playing-row-${watchlistEntryKey(rowItems[0])}`,
            mt: rowIndex === 0 ? scale(12) : GRID_GAP,
          });
        });
      }
    }

    groupedItems.forEach((category, categoryIndex) => {
      if (categoryIndex > 0 || !categoryCollapsed('now_playing')) {
        rows.push({ type: 'hairline', key: `hairline-${category.id}` });
      }
      rows.push({ type: 'categoryHeader', category, key: `category-${category.id}` });
      if (categoryCollapsed(category.id)) return;

      category.groups.forEach((group, groupIndex) => {
        rows.push({
          type: 'groupHeader',
          categoryId: category.id,
          group,
          key: `group-${category.id}-${group.label}`,
          mt: groupIndex === 0 ? scale(16) : scale(24),
        });
        if (groupCollapsed(category.id, group.label)) return;
        group.rows.forEach((rowItems, rowIndex) => {
          rows.push({
            type: 'posterRow',
            variant: 'watchlist',
            items: rowItems,
            key: `poster-${category.id}-${group.label}-${watchlistEntryKey(rowItems[0])}-${rowIndex}`,
            mt: GRID_GAP,
          });
        });
      });
    });

    return rows;
  }, [
    groupedItems,
    nowPlayingRows,
    nowPlaying.length,
    nowPlayingLoading,
    nowPlayingError,
    collapsedCategoryIds,
    collapsedGroupKeys,
  ]);

  const chooseRandomPick = () => {
    const source = pickableItems.length
      ? pickableItems
      : libraryItems.length
        ? libraryItems
        : items;
    if (!source?.length) return;
    const nextPick = source[Math.floor(Math.random() * source.length)];
    setRandomPick(nextPick);
    pickOpacity.setValue(reduceMotion ? 1 : 0);
    Haptics.selectionAsync();
    if (reduceMotion) return;
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
      .then((results) => {
        if (!cancelled) setNowPlaying(results);
      })
      .catch((err) => {
        if (!cancelled)
          setNowPlayingError(classifyAppError(err).message || 'Could not load Now Playing.');
      })
      .finally(() => {
        if (!cancelled) setNowPlayingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!libraryItems.length) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />
        <View style={styles.emptyWrap}>
          <EmptyState
            variant="empty"
            title="Your Watchlist"
            description="You have no titles saved yet. Explore movies and add them to your collection."
            primaryAction={
              onBrowseMovies
                ? {
                    label: 'Browse Movies',
                    icon: 'film-outline',
                    onPress: onBrowseMovies,
                    accessibilityLabel: 'Browse movies',
                  }
                : undefined
            }
            secondaryAction={
              onBrowseTV
                ? {
                    label: 'Browse TV',
                    onPress: onBrowseTV,
                    accessibilityLabel: 'Browse TV shows',
                  }
                : undefined
            }
          />
        </View>
      </View>
    );
  }

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
      .catch((err) =>
        setNowPlayingError(classifyAppError(err).message || 'Could not load Now Playing.'),
      )
      .finally(() => setNowPlayingLoading(false));
  };

  const rowKeyExtractor = (row) => row.key;

  const renderNowPlayingHeader = () => (
    <View style={styles.categorySection}>
      <TouchableOpacity
        style={styles.categoryHeading}
        activeOpacity={0.75}
        onPress={() => toggleCategory('now_playing')}
        accessibilityRole="button"
        accessibilityLabel={`${isCategoryCollapsed('now_playing') ? 'Expand' : 'Collapse'} Now Playing`}
        accessibilityState={{ expanded: !isCategoryCollapsed('now_playing') }}
      >
        <View
          style={[styles.categoryIcon, { backgroundColor: GOLD_ACCENT + '18', borderColor: GOLD_DIM }]}
        >
          <Ionicons name="film-outline" size={18} color={GOLD_ACCENT} />
        </View>
        <View style={styles.categoryHeadingText}>
          <Text style={[styles.categoryEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            In Theatres
          </Text>
          <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleMd }]}>
            Now Playing
          </Text>
          <Text
            style={[styles.categoryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
          >
            {nowPlayingLoading
              ? 'Loading…'
              : nowPlayingError
                ? 'Unavailable'
                : `${nowPlaying.length} ${nowPlaying.length === 1 ? 'Title' : 'Titles'}`}
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
    </View>
  );

  const renderNowPlayingError = (row) => (
    <TouchableOpacity
      style={[
        styles.inlineRetry,
        {
          marginTop: row.mt,
          backgroundColor: colors.error + '12',
          borderColor: colors.error + '33',
          borderRadius: radii.md,
        },
      ]}
      onPress={retryNowPlaying}
      accessibilityRole="button"
      accessibilityLabel="Retry loading Now Playing"
    >
      <Ionicons name="refresh-outline" size={16} color={colors.error} />
      <Text style={[styles.inlineRetryText, { color: colors.error, ...typography.bodyMd }]}>
        Could not load this section. Tap to retry.
      </Text>
    </TouchableOpacity>
  );

  const renderCategoryHeader = (row) => {
    const category = row.category;
    const isCollapsed = isCategoryCollapsed(category.id);
    return (
      <View style={styles.categorySection}>
        <TouchableOpacity
          style={styles.categoryHeading}
          activeOpacity={0.75}
          onPress={() => toggleCategory(category.id)}
          accessibilityRole="button"
          accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${category.label}`}
          accessibilityState={{ expanded: !isCollapsed }}
        >
          <View
            style={[styles.categoryIcon, { backgroundColor: GOLD_ACCENT + '18', borderColor: GOLD_DIM }]}
          >
            <Ionicons name={category.icon} size={18} color={GOLD_ACCENT} />
          </View>
          <View style={styles.categoryHeadingText}>
            <Text style={[styles.categoryEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
              Collection
            </Text>
            <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleMd }]}>
              {category.label}
            </Text>
            <Text
              style={[styles.categoryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
            >
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
      </View>
    );
  };

  const renderGroupHeader = (row) => {
    const { categoryId, group } = row;
    const groupCollapsed = isGroupCollapsed(categoryId, group.label);
    return (
      <TouchableOpacity
        style={[styles.mediaGroupHeader, { marginTop: row.mt }]}
        activeOpacity={0.75}
        onPress={() => toggleGroup(categoryId, group.label)}
        accessibilityRole="button"
        accessibilityLabel={`${groupCollapsed ? 'Expand' : 'Collapse'} ${group.label}`}
        accessibilityState={{ expanded: !groupCollapsed }}
      >
        <Ionicons name={group.icon} size={13} color={GOLD_ACCENT} />
        <Text style={[styles.mediaGroupLabel, { color: colors.onSurface, ...typography.labelSm }]}>
          {group.label}
        </Text>
        <Text
          style={[styles.mediaGroupCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
        >
          {group.data.length}
        </Text>
        <View style={[styles.mediaGroupDivider, { backgroundColor: GOLD_DIM }]} />
        <Ionicons
          name={groupCollapsed ? 'chevron-down' : 'chevron-up'}
          size={13}
          color={colors.onSurfaceVariant}
        />
      </TouchableOpacity>
    );
  };

  const renderPosterRow = (row) => (
    <View style={[styles.posterRow, { marginTop: row.mt }]}>
      {row.items.map((item) =>
        row.variant === 'watchlist' ? (
          <WatchlistGridCard
            key={watchlistEntryKey(item)}
            item={item}
            colors={colors}
            typography={typography}
            radii={radii}
            onSelect={onSelect}
            onRemove={onRemove}
            onMarkWatched={onMarkWatched}
            reduceMotion={reduceMotion}
          />
        ) : (
          <GridPosterCard
            key={watchlistEntryKey(item)}
            item={item}
            colors={colors}
            typography={typography}
            radii={radii}
            onPress={() => onSelect(item)}
            mediaLabel="Movie"
          />
        ),
      )}
      {row.items.length === 1 ? <View style={styles.gridCardSpacer} /> : null}
    </View>
  );

  const renderRow = ({ item: row }) => {
    switch (row.type) {
      case 'nowPlayingHeader':
        return renderNowPlayingHeader();
      case 'nowPlayingSkeleton':
        return (
          <View style={{ marginTop: row.mt }}>
            <WatchlistSkeleton count={4} />
          </View>
        );
      case 'nowPlayingError':
        return renderNowPlayingError(row);
      case 'hairline':
        return <ProgrammeHairline style={{ marginVertical: scale(22) }} />;
      case 'categoryHeader':
        return renderCategoryHeader(row);
      case 'groupHeader':
        return renderGroupHeader(row);
      case 'posterRow':
        return renderPosterRow(row);
      default:
        return null;
    }
  };

  const listHeader = (
    <>
      <ProgrammeSectionHeader
        eyebrow="Personal Ledger"
        title="My Watchlist"
        subtitle={`${libraryItems.length} ${libraryItems.length === 1 ? 'Title' : 'Titles'} Saved`}
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
          <Text style={[styles.randomEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            Random Pick
          </Text>
          <Text style={[styles.randomTitle, { color: colors.onSurface, ...typography.titleLg }]}>
            What should I watch?
          </Text>
          <Text
            style={[styles.randomSubtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
          >
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
          <Text style={[styles.randomButtonText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            Pick
          </Text>
        </TouchableOpacity>
        {randomPick && (
          <Animated.View
            style={[
              styles.randomResult,
              {
                opacity: pickOpacity,
                backgroundColor:
                  resolvedMode === 'dark' ? 'rgba(212,168,83,0.08)' : 'rgba(212,168,83,0.12)',
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
              <Text style={[styles.randomResultLabel, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                Tonight's Pick
              </Text>
              <Text
                style={[styles.randomResultTitle, { color: colors.onSurface, ...typography.titleLg }]}
                numberOfLines={2}
              >
                {randomPick.title}
              </Text>
              <Text
                style={[
                  styles.randomResultMeta,
                  { color: colors.onSurfaceVariant, ...typography.bodyMd },
                ]}
                numberOfLines={1}
              >
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

      <ProgrammeHairline style={{ marginVertical: scale(22) }} />
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />

      <FlatList
        style={styles.container}
        data={listData}
        renderItem={renderRow}
        keyExtractor={rowKeyExtractor}
        extraData={listExtraData}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + scale(12), paddingBottom: insets.bottom + 112 },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        initialNumToRender={6}
        // Expanding a group mounts the newly-visible poster rows (artwork +
        // PanResponder per card). Mounting them in one batch cost a ~105 ms
        // frame; smaller batches spread that across frames so the tap stays
        // responsive. Revealing rows with no posters was already ~18 ms, which
        // is what pinned the cost on card mount rather than on list rebuilding.
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        {...bottomNavScroll}
      />

      <View
        style={[styles.browseDock, { bottom: insets.bottom + 88, paddingHorizontal: GRID_PAD }]}
      >
        <View
          style={[
            styles.browseDockInner,
            { backgroundColor: glassSurface, borderColor: GOLD_DIM, borderRadius: radii.xl },
          ]}
        >
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
            <Text
              style={[styles.browseDockLabel, { color: colors.onSurface, ...typography.labelSm }]}
            >
              Movies
            </Text>
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
            <Text
              style={[styles.browseDockLabel, { color: colors.onSurface, ...typography.labelSm }]}
            >
              TV Shows
            </Text>
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
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: GRID_PAD,
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
    paddingEnd: 2,
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
    paddingEnd: 2,
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
    paddingEnd: 2,
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
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  categoryTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  categoryCount: {
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
    paddingEnd: 2,
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
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  mediaGroupCount: {
    fontWeight: '700',
  },
  mediaGroupDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  categoryGrid: {
    paddingHorizontal: 0,
  },
  posterRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  gridCardSpacer: {
    width: GRID_COL_W,
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
    paddingEnd: 2,
    textTransform: 'uppercase',
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
    paddingEnd: 2,
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
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
});
