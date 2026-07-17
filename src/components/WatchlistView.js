import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
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
import {
  getUserWatchlistCollections,
  getStatusLabel,
  isInUserLibrary,
  watchlistEntryKey,
} from '../lib/watchlistModel';
import { fetchNowPlayingMovies, fetchTitleProviderCountries } from '../lib/tmdb';
import {
  DEFAULT_WHERE_TO_WATCH_COUNTRY,
  ensureAvailabilityForItems,
  getFreshAvailability,
  getServiceLabel,
  loadAvailabilityCache,
  loadWhereToWatchPrefs,
  matchingServiceKeys,
  persistAvailabilityCache,
  saveWhereToWatchPrefs,
  titleMatchesWhereToWatch,
  whereToWatchScopeItems,
} from '../lib/whereToWatch';
import { useBottomSheet } from './StackBottomSheet';
import {
  WhereToWatchCollectionsSheet,
  WhereToWatchCountrySheet,
  WhereToWatchServiceSheet,
} from './WhereToWatchSheets';
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
  matchedServiceKeys = null,
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
              matchedServiceKeys?.length ? (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: radii.sm },
                  ]}
                >
                  <Ionicons name="play-circle-outline" size={11} color={GOLD_ACCENT} />
                  <Text style={[styles.statusPillText, typography.labelSm]}>
                    {getServiceLabel(matchedServiceKeys[0])}
                    {matchedServiceKeys.length > 1 ? ` +${matchedServiceKeys.length - 1}` : ''}
                  </Text>
                </View>
              ) : item.status && item.status !== 'saved' ? (
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


function WherePill({ icon, label, onPress, colors, typography, accessibilityLabel }) {
  return (
    <TouchableOpacity
      style={[styles.wherePill, { borderColor: GOLD_DIM }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={14} color={GOLD_ACCENT} />
      <Text
        style={[styles.wherePillText, { color: colors.onSurface, ...typography.labelSm }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons name="chevron-down" size={12} color={colors.onSurfaceVariant} />
    </TouchableOpacity>
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
  const bottomSheet = useBottomSheet();

  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState({});
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState({});

  // Where-to-Watch filter. The persistent availability cache is only touched
  // inside the check effect (it is mutated by a concurrent fetch loop);
  // renders read `whereAvailability`, an immutable entryKey → services
  // snapshot the effect publishes.
  const [whereActive, setWhereActive] = useState(false);
  const [whereCountry, setWhereCountry] = useState(DEFAULT_WHERE_TO_WATCH_COUNTRY);
  const [whereServiceKey, setWhereServiceKey] = useState(null);
  const [whereCollectionIds, setWhereCollectionIds] = useState(null); // null = all collections
  const [whereChecking, setWhereChecking] = useState(false);
  const [whereProgress, setWhereProgress] = useState(null);
  const [whereFailedCount, setWhereFailedCount] = useState(0);
  const [whereRetryNonce, setWhereRetryNonce] = useState(0);
  const [whereAvailability, setWhereAvailability] = useState(null);
  const availabilityCacheRef = useRef(null);
  const whereRunIdRef = useRef(0);

  const [nowPlaying, setNowPlaying] = useState([]);
  const [nowPlayingLoading, setNowPlayingLoading] = useState(true);
  const [nowPlayingError, setNowPlayingError] = useState(null);

  const glassSurface = colors.glass;
  const atmosphereColors = [
    resolvedMode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
    colors.background,
  ];

  const libraryItems = useMemo(() => (items || []).filter(isInUserLibrary), [items]);

  const availableCollections = useMemo(
    () => (collections.length ? collections : getUserWatchlistCollections()),
    [collections],
  );

  /**
   * Which library entries pass the active where-to-watch filter, plus (in
   * any-service mode) which services matched, for the poster badge. Null when
   * the filter is off. `whereAvailability` already reflects the collection
   * scope — the check effect snapshots exactly the in-scope titles.
   */
  const whereMatches = useMemo(() => {
    if (!whereActive || !whereCountry?.code) return null;
    const matchedKeys = new Set();
    const matchedServices = new Map();
    if (whereAvailability) {
      const filter = { countryCode: whereCountry.code, serviceKey: whereServiceKey };
      whereAvailability.forEach((services, entryKey) => {
        if (titleMatchesWhereToWatch(services, filter)) {
          matchedKeys.add(entryKey);
          if (!whereServiceKey) {
            matchedServices.set(entryKey, matchingServiceKeys(services, whereCountry.code));
          }
        }
      });
    }
    return { keys: matchedKeys, services: matchedServices };
  }, [whereActive, whereCountry, whereServiceKey, whereAvailability]);

  const whereScopeCount = useMemo(
    () => (whereActive ? whereToWatchScopeItems(libraryItems, whereCollectionIds).length : 0),
    [whereActive, libraryItems, whereCollectionIds],
  );

  const visibleLibraryItems = useMemo(() => {
    if (!whereMatches) return libraryItems;
    return libraryItems.filter((item) => whereMatches.keys.has(watchlistEntryKey(item)));
  }, [libraryItems, whereMatches]);

  const scopedCollections = useMemo(() => {
    if (!whereActive || !whereCollectionIds?.length) return availableCollections;
    const selected = new Set(whereCollectionIds);
    return availableCollections.filter((collection) => selected.has(collection.id));
  }, [availableCollections, whereActive, whereCollectionIds]);

  const listExtraData = useMemo(
    () => ({ theme, collapsedCategoryIds, collapsedGroupKeys, whereMatches }),
    [theme, collapsedCategoryIds, collapsedGroupKeys, whereMatches],
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
      scopedCollections
        .map((collection) => {
          const all = visibleLibraryItems.filter((item) =>
            item.collectionIds?.includes(collection.id),
          );
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
    [scopedCollections, visibleLibraryItems],
  );

  const nowPlayingRows = useMemo(() => buildGridRows(nowPlaying), [nowPlaying]);

  /**
   * Assembling the flat row list *does* depend on collapse state, but it is now
   * only cheap object pushes over pre-packed rows — no filtering, sorting or
   * row-packing happens here.
   */
  const listData = useMemo(() => {
    const rows = [];
    // While the where-to-watch filter is on, everything left is a match — show
    // it expanded instead of making the user unfold each section.
    const defaultCollapsed = !whereActive;
    const categoryCollapsed = (id) => collapsedCategoryIds[id] ?? defaultCollapsed;
    const groupCollapsed = (categoryId, groupLabel) =>
      collapsedGroupKeys[`${categoryId}::${groupLabel}`] ?? defaultCollapsed;

    // Now Playing is theatre content; it has no streaming availability and is
    // hidden while the filter is active.
    if (!whereActive) {
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
    }

    if (whereActive && !whereChecking && whereAvailability && groupedItems.length === 0) {
      rows.push({ type: 'whereEmpty', key: 'where-empty' });
    }

    groupedItems.forEach((category, categoryIndex) => {
      if (categoryIndex > 0 || (!whereActive && !categoryCollapsed('now_playing'))) {
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
    whereActive,
    whereChecking,
    whereAvailability,
  ]);

  // Restore the last-used where-to-watch country/service.
  useEffect(() => {
    let alive = true;
    loadWhereToWatchPrefs().then((prefs) => {
      if (!alive) return;
      setWhereCountry({ code: prefs.countryCode, label: prefs.countryLabel });
      setWhereServiceKey(prefs.serviceKey);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * While the filter is active, make sure every in-scope title has fresh
   * availability data. Cache hits are free; misses fetch from TMDB. Country and
   * service are deliberately NOT dependencies — availability covers every
   * country/service at once, so changing them only re-runs the match memo.
   */
  useEffect(() => {
    if (!whereActive) return undefined;
    let alive = true;
    whereRunIdRef.current += 1;
    const runId = whereRunIdRef.current;

    (async () => {
      if (!availabilityCacheRef.current) {
        availabilityCacheRef.current = await loadAvailabilityCache();
        if (!alive || runId !== whereRunIdRef.current) return;
      }
      const cache = availabilityCacheRef.current;
      const scope = whereToWatchScopeItems(items || [], whereCollectionIds);

      const publishSnapshot = () => {
        const snapshot = new Map();
        scope.forEach((item) => {
          const entryKey = watchlistEntryKey(item);
          const services = getFreshAvailability(cache, entryKey);
          if (services) snapshot.set(entryKey, services);
        });
        setWhereAvailability(snapshot);
      };

      setWhereChecking(true);
      setWhereFailedCount(0);
      setWhereProgress({ checked: 0, total: scope.length });
      publishSnapshot(); // cached titles match instantly

      // Rebuilding the grouped grid costs ~100 ms on a large library, so the
      // list refreshes at most ~once a second mid-run; the cheap progress text
      // updates more often.
      let lastProgressAt = 0;
      let lastRebuildAt = Date.now();
      const result = await ensureAvailabilityForItems(scope, {
        cache,
        fetchAvailability: fetchTitleProviderCountries,
        shouldContinue: () => alive && runId === whereRunIdRef.current,
        onProgress: (progress) => {
          if (!alive || runId !== whereRunIdRef.current) return;
          const nowTs = Date.now();
          if (nowTs - lastProgressAt > 120 || progress.checked === progress.total) {
            lastProgressAt = nowTs;
            setWhereProgress(progress);
          }
          if (nowTs - lastRebuildAt > 1000) {
            lastRebuildAt = nowTs;
            publishSnapshot();
          }
        },
      });

      if (!alive || runId !== whereRunIdRef.current) return;
      setWhereChecking(false);
      setWhereFailedCount(result.failed);
      publishSnapshot();
      persistAvailabilityCache(cache);
    })();

    return () => {
      alive = false;
    };
  }, [whereActive, items, whereCollectionIds, whereRetryNonce]);

  const toggleWhereActive = () => {
    Haptics.selectionAsync();
    // Collapse state carries different defaults in filter mode; reset it so
    // each mode starts from its intended layout.
    setCollapsedCategoryIds({});
    setCollapsedGroupKeys({});
    setWhereActive((current) => !current);
  };

  const persistWherePrefs = (country, serviceKey) => {
    saveWhereToWatchPrefs({
      countryCode: country.code,
      countryLabel: country.label,
      serviceKey,
    });
  };

  const openWhereCountrySheet = () => {
    Haptics.selectionAsync();
    bottomSheet.show(
      (sheetId) => (
        <WhereToWatchCountrySheet
          selectedCode={whereCountry.code}
          onSelect={(region) => {
            const country = { code: region.code, label: region.label };
            setWhereCountry(country);
            persistWherePrefs(country, whereServiceKey);
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
  };

  const openWhereServiceSheet = () => {
    Haptics.selectionAsync();
    bottomSheet.show(
      (sheetId) => (
        <WhereToWatchServiceSheet
          selectedKey={whereServiceKey}
          onSelect={(serviceKey) => {
            setWhereServiceKey(serviceKey);
            persistWherePrefs(whereCountry, serviceKey);
            bottomSheet.dismiss(sheetId);
          }}
        />
      ),
      {
        eyebrow: 'Where to Watch',
        title: 'Streaming Service',
        subtitle: 'Narrow the match to one service',
        size: 'large',
        scrollable: true,
      },
    );
  };

  const openWhereCollectionsSheet = () => {
    Haptics.selectionAsync();
    bottomSheet.show(
      (sheetId) => (
        <WhereToWatchCollectionsSheet
          collections={availableCollections}
          selectedIds={whereCollectionIds}
          onApply={(collectionIds) => {
            setWhereCollectionIds(collectionIds);
            bottomSheet.dismiss(sheetId);
          }}
        />
      ),
      {
        eyebrow: 'Where to Watch',
        title: 'Collections',
        subtitle: 'Choose which lists to search',
        size: 'large',
        scrollable: true,
      },
    );
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

  const isCategoryCollapsed = (categoryId) => collapsedCategoryIds[categoryId] ?? !whereActive;

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
    collapsedGroupKeys[groupKey(categoryId, groupLabel)] ?? !whereActive;

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
            matchedServiceKeys={
              whereMatches && !whereServiceKey
                ? whereMatches.services.get(watchlistEntryKey(item))
                : null
            }
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

  const renderWhereEmpty = () => (
    <View
      style={[
        styles.whereEmptyBox,
        { backgroundColor: glassSurface, borderColor: GOLD_DIM, borderRadius: radii.lg },
      ]}
    >
      <Ionicons name="eye-off-outline" size={22} color={GOLD_ACCENT} />
      <Text style={[styles.whereEmptyTitle, { color: colors.onSurface, ...typography.titleMd }]}>
        Nothing to stream yet
      </Text>
      <Text
        style={[styles.whereEmptyText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
      >
        None of the {whereScopeCount} {whereScopeCount === 1 ? 'title' : 'titles'} in scope
        {whereServiceKey ? ` are on ${getServiceLabel(whereServiceKey)}` : ' are streamable'} in{' '}
        {whereCountry.label} right now. Try another service, country, or collection.
      </Text>
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
      case 'whereEmpty':
        return renderWhereEmpty();
      default:
        return null;
    }
  };

  const whereMatchedCount = whereMatches ? whereMatches.keys.size : 0;
  const whereCollectionsLabel = !whereCollectionIds?.length
    ? 'All Collections'
    : `${whereCollectionIds.length} ${whereCollectionIds.length === 1 ? 'Collection' : 'Collections'}`;

  const listHeader = (
    <>
      <ProgrammeSectionHeader
        eyebrow="Personal Ledger"
        title="My Watchlist"
        subtitle={`${libraryItems.length} ${libraryItems.length === 1 ? 'Title' : 'Titles'} Saved`}
      />

      <View
        style={[
          styles.wherePanel,
          {
            backgroundColor: glassSurface,
            borderColor: whereActive ? GOLD_ACCENT + '66' : GOLD_DIM,
            borderRadius: radii.xl,
          },
        ]}
      >
        <View style={styles.whereCopy}>
          <Text style={[styles.whereEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            Where to Watch
          </Text>
          <Text style={[styles.whereTitle, { color: colors.onSurface, ...typography.titleLg }]}>
            Find something to stream
          </Text>
          <Text
            style={[styles.whereSubtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
          >
            Only show saved titles you can stream right now.
          </Text>
        </View>

        <View style={styles.wherePillRow}>
          <WherePill
            icon="earth-outline"
            label={whereCountry.label}
            onPress={openWhereCountrySheet}
            colors={colors}
            typography={typography}
            accessibilityLabel={`Country: ${whereCountry.label}. Change country`}
          />
          <WherePill
            icon="tv-outline"
            label={getServiceLabel(whereServiceKey)}
            onPress={openWhereServiceSheet}
            colors={colors}
            typography={typography}
            accessibilityLabel={`Service: ${getServiceLabel(whereServiceKey)}. Change streaming service`}
          />
          <WherePill
            icon="albums-outline"
            label={whereCollectionsLabel}
            onPress={openWhereCollectionsSheet}
            colors={colors}
            typography={typography}
            accessibilityLabel={`Searching ${whereCollectionsLabel}. Change collections`}
          />
        </View>

        <View style={styles.whereActionsRow}>
          <TouchableOpacity
            style={[
              styles.whereToggle,
              {
                backgroundColor: whereActive ? 'transparent' : GOLD_ACCENT,
                borderColor: GOLD_ACCENT,
                borderRadius: radii.full,
              },
            ]}
            onPress={toggleWhereActive}
            accessibilityRole="button"
            accessibilityLabel={
              whereActive ? 'Clear the where-to-watch filter' : 'Show only streamable titles'
            }
          >
            <Ionicons
              name={whereActive ? 'close' : 'funnel-outline'}
              size={16}
              color={whereActive ? GOLD_ACCENT : '#1C1710'}
            />
            <Text
              style={[
                styles.whereToggleText,
                { color: whereActive ? GOLD_ACCENT : '#1C1710', ...typography.labelSm },
              ]}
            >
              {whereActive ? 'Clear' : 'Show Streamable'}
            </Text>
          </TouchableOpacity>

          {whereActive && whereChecking && (
            <View style={styles.whereStatus}>
              <ActivityIndicator size="small" color={GOLD_ACCENT} />
              <Text
                style={[
                  styles.whereStatusText,
                  { color: colors.onSurfaceVariant, ...typography.labelSm },
                ]}
                numberOfLines={1}
              >
                Checking {whereProgress?.checked ?? 0}/{whereProgress?.total ?? 0}
              </Text>
            </View>
          )}
        </View>

        {whereActive && !whereChecking && whereAvailability && (
          <View style={styles.whereResultRow}>
            <Text
              style={[styles.whereResultText, { color: colors.onSurface, ...typography.bodyMd }]}
            >
              {whereMatchedCount} of {whereScopeCount}{' '}
              {whereScopeCount === 1 ? 'title streams' : 'titles stream'}
              {whereServiceKey ? ` on ${getServiceLabel(whereServiceKey)}` : ''} in{' '}
              {whereCountry.label}.
            </Text>
            {whereFailedCount > 0 && (
              <TouchableOpacity
                onPress={() => setWhereRetryNonce((nonce) => nonce + 1)}
                accessibilityRole="button"
                accessibilityLabel={`${whereFailedCount} titles could not be checked. Retry`}
              >
                <Text
                  style={[styles.whereRetryText, { color: colors.error, ...typography.labelSm }]}
                >
                  {whereFailedCount} unchecked · Tap to retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
  wherePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: scale(14),
    marginBottom: scale(8),
    padding: scale(18),
  },
  whereCopy: {
    gap: 4,
  },
  whereEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.4,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  whereTitle: {
    fontWeight: '800',
  },
  whereSubtitle: {
    fontWeight: '500',
  },
  wherePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wherePill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    minHeight: 40,
    paddingHorizontal: scale(12),
  },
  wherePillText: {
    flexShrink: 1,
    fontWeight: '700',
  },
  whereActionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  whereToggle: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: scale(18),
  },
  whereToggleText: {
    fontWeight: '800',
    letterSpacing: 1.1,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  whereStatus: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  whereStatusText: {
    flexShrink: 1,
    fontWeight: '700',
  },
  whereResultRow: {
    gap: 4,
  },
  whereResultText: {
    fontWeight: '700',
  },
  whereRetryText: {
    fontWeight: '800',
  },
  whereEmptyBox: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    marginTop: scale(16),
    padding: scale(20),
  },
  whereEmptyTitle: {
    fontWeight: '800',
  },
  whereEmptyText: {
    textAlign: 'center',
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
