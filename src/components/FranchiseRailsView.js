import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import {
  CATEGORY_PILLS,
  SIZE_BUCKETS,
  countActiveFindBadge,
  filterCollectionRows,
  getLibraryCollectionIds,
  getRowsForIds,
  sortCollectionRows,
} from '../lib/collectionFilters';
import {
  loadCollectionSearchQuery,
  loadCollectionSectionCollapsed,
  loadPinnedCollectionIds,
  saveCollectionSearchQuery,
  saveCollectionSectionCollapsed,
  savePinnedCollectionIds,
} from '../lib/collectionPrefsStorage';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { scale, verticalScale } from '../utils/responsive';
import { ContentRail } from './ContentRail';
import { FranchiseNavigatorSheet } from './FranchiseNavigatorSheet';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD } from '../theme/programme';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { ProgrammeBadge } from './ProgrammeBadge';
import { HomeFeedSkeleton } from './SkeletonLoaders';

const SCRUBBER_LETTERS = ['ALL', '#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

function SectionHeader({ title, count, expanded, collapsible, onToggle, colors, typography }) {
  const content = (
    <>
      <View style={styles.sectionHeaderLeft}>
        <Text style={[styles.sectionHeaderEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {collapsible ? 'Your Library' : 'Catalogue'}
        </Text>
        <Text
          style={[{ color: colors.onSurface, ...typography.titleMd, fontWeight: '800', flex: 1 }]}
        >
          {title}
        </Text>
      </View>
      {count != null && (
        <Text
          style={[{ color: colors.onSurfaceVariant, ...typography.labelSm, fontWeight: '700' }]}
        >
          {count}
        </Text>
      )}
      {collapsible && (
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={GOLD_ACCENT} />
      )}
    </>
  );

  if (!collapsible) {
    return <View style={styles.catalogSectionHeader}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={onToggle}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count} collections, ${expanded ? 'expanded' : 'collapsed'}`}
    >
      {content}
    </TouchableOpacity>
  );
}

function CollectionRail({
  row,
  inLibrary,
  isPinned,
  onTogglePin,
  onSaveCollection,
  onToggleWatchlist,
  savedKeys,
  colors,
  typography,
  radii,
  onSelectItem,
}) {
  const savedCount = useMemo(() => {
    if (!savedKeys || !row.items) return 0;
    return row.items.filter((item) => savedKeys.has(watchlistEntryKey(item))).length;
  }, [savedKeys, row.items]);

  const isFullySaved = savedCount === row.items.length && row.items.length > 0;
  const isPartiallySaved = savedCount > 0 && !isFullySaved;

  const subtitle = useMemo(() => {
    const parts = [];
    if (row.items?.length) parts.push(`${row.items.length} Films`);
    if (row.yearSpan) parts.push(row.yearSpan);
    if (row.avgRating && row.avgRating !== 'N/A') parts.push(`★ ${row.avgRating}`);
    return parts.join(' · ');
  }, [row.items, row.yearSpan, row.avgRating]);

  const headerRight = (
    <View style={styles.railHeaderActions}>
      {onSaveCollection && (
        <TouchableOpacity
          style={[
            styles.saveCollectionButton,
            {
              backgroundColor: isFullySaved ? GOLD_ACCENT + '24' : colors.surfaceContainerHigh,
              borderRadius: radii.full,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onSaveCollection(row);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={
            isFullySaved
              ? `${row.title} all ${row.items.length} films saved to library`
              : `Save all ${row.items.length} films in ${row.title} to library`
          }
        >
          <Text
            style={[
              styles.saveCollectionText,
              {
                color: isFullySaved || isPartiallySaved ? GOLD_ACCENT : colors.onSurfaceVariant,
                ...typography.labelSm,
              },
            ]}
          >
            {isFullySaved
              ? `Saved (${savedCount})`
              : isPartiallySaved
              ? `Save (${savedCount}/${row.items.length})`
              : `Save All`}
          </Text>
        </TouchableOpacity>
      )}

      {!inLibrary && (
        <TouchableOpacity
          style={[
            styles.pinButton,
            {
              backgroundColor: isPinned ? GOLD_ACCENT + '24' : colors.surfaceContainerHigh,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onTogglePin(row.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={isPinned ? `Unpin ${row.title}` : `Pin ${row.title}`}
        >
          <Ionicons
            name={isPinned ? 'pin' : 'pin-outline'}
            size={15}
            color={isPinned ? GOLD_ACCENT : colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ContentRail
      title={row.title}
      subtitle={subtitle}
      icon={null}
      variant="inline"
      showHairline={false}
      showCaption={false}
      showMediaType={false}
      titleStyle={styles.railTitleReduced}
      data={row.items}
      colors={colors}
      typography={typography}
      radii={radii}
      onSelectItem={onSelectItem}
      onToggleWatchlist={onToggleWatchlist}
      savedKeys={savedKeys}
      headerRight={headerRight}
    />
  );
}

function CategoryPillsBar({ selectedCategory, onSelectCategory, colors, typography, radii }) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={CATEGORY_PILLS}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.categoryPillsContainer}
      renderItem={({ item }) => {
        const active = selectedCategory === item.key;
        return (
          <TouchableOpacity
            style={[
              styles.categoryPill,
              {
                backgroundColor: active ? GOLD_ACCENT : colors.surfaceContainerHigh,
                borderRadius: radii.full,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelectCategory(item.key);
            }}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filter by ${item.label}`}
          >
            <Text
              style={[
                styles.categoryPillText,
                {
                  color: active ? '#0c0c0e' : colors.onSurface,
                  ...typography.labelSm,
                  fontWeight: active ? '800' : '600',
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function AlphabetScrubberBar({ letterFilter, onSelectLetter, colors, typography, radii }) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={SCRUBBER_LETTERS}
      keyExtractor={(item) => item}
      contentContainerStyle={styles.scrubberContainer}
      renderItem={({ item }) => {
        const active = item === 'ALL' ? !letterFilter : letterFilter === item;
        return (
          <TouchableOpacity
            style={[
              styles.scrubberPill,
              {
                backgroundColor: active ? GOLD_ACCENT : colors.surfaceContainerHigh,
                borderRadius: radii.full,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelectLetter(item);
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item === 'ALL' ? 'Show all letters' : `Filter by letter ${item}`}
          >
            <Text
              style={[
                styles.scrubberText,
                {
                  color: active ? '#0c0c0e' : colors.onSurface,
                  ...typography.labelSm,
                  fontWeight: active ? '900' : '600',
                },
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function QuickSortBar({ sortMode, onSelectSort, onOpenNavigator, badgeCount, colors, typography, radii }) {
  const sortOptions = [
    { key: 'popular', label: 'Featured' },
    { key: 'rating', label: 'Top Rated' },
    { key: 'az', label: 'A–Z' },
    { key: 'count', label: 'Sagas' },
  ];

  return (
    <View style={styles.quickSortRow}>
      <View
        style={[
          styles.sortPillsWrap,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderRadius: radii.full,
          },
        ]}
      >
        {sortOptions.map((opt) => {
          const active = sortMode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortSegment,
                active && { backgroundColor: GOLD_ACCENT + '24' },
                { borderRadius: radii.full },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                onSelectSort(opt.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.sortSegmentText,
                  {
                    color: active ? GOLD_ACCENT : colors.onSurfaceVariant,
                    ...typography.labelSm,
                    fontWeight: active ? '800' : '600',
                  },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.navigatorTrigger,
          {
            backgroundColor: badgeCount > 0 ? GOLD_ACCENT + '20' : colors.surfaceContainerHigh,
            borderRadius: radii.full,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          onOpenNavigator();
        }}
        accessibilityRole="button"
        accessibilityLabel="Open Franchise Index Navigator"
      >
        <Text
          style={[
            styles.navigatorTriggerText,
            {
              color: badgeCount > 0 ? GOLD_ACCENT : colors.onSurface,
              ...typography.labelSm,
              fontWeight: '800',
            },
          ]}
        >
          Index
        </Text>
        {badgeCount > 0 && (
          <View style={[styles.badgePill, { backgroundColor: GOLD_ACCENT }]}>
            <Text style={styles.badgeText}>{badgeCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ActiveFiltersBar({
  searchQuery,
  onClearSearch,
  letterFilter,
  onClearLetter,
  categoryFilter,
  onClearCategory,
  sizeFilters,
  onClearSize,
  decadeFilters,
  onClearDecade,
  onResetAll,
  colors,
  typography,
  radii,
}) {
  const hasFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(letterFilter) ||
    categoryFilter !== 'all' ||
    sizeFilters.length > 0 ||
    decadeFilters.length > 0;

  if (!hasFilters) return null;

  return (
    <View style={styles.activeFiltersRow}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[
          ...(searchQuery.trim() ? [{ type: 'search', label: `"${searchQuery}"`, onClear: onClearSearch }] : []),
          ...(letterFilter ? [{ type: 'letter', label: `Letter: ${letterFilter}`, onClear: onClearLetter }] : []),
          ...(categoryFilter !== 'all'
            ? [
                {
                  type: 'category',
                  label: CATEGORY_PILLS.find((c) => c.key === categoryFilter)?.label || categoryFilter,
                  onClear: onClearCategory,
                },
              ]
            : []),
          ...sizeFilters.map((s) => ({
            type: 'size',
            label: `${SIZE_BUCKETS[s]?.label || s} Films`,
            onClear: () => onClearSize(s),
          })),
          ...decadeFilters.map((d) => ({
            type: 'decade',
            label: d,
            onClear: () => onClearDecade(d),
          })),
        ]}
        keyExtractor={(item) => `${item.type}-${item.label}`}
        contentContainerStyle={styles.activeFilterChipsWrap}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.activeFilterChip,
              {
                backgroundColor: GOLD_ACCENT + '20',
                borderRadius: radii.full,
              },
            ]}
            onPress={item.onClear}
            accessibilityRole="button"
            accessibilityLabel={`Remove filter ${item.label}`}
          >
            <Text style={[styles.activeFilterChipText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
              {item.label}
            </Text>
            <Ionicons name="close-circle" size={13} color={GOLD_ACCENT} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.clearAllBtn}
        onPress={() => {
          Haptics.selectionAsync();
          onResetAll();
        }}
        accessibilityRole="button"
        accessibilityLabel="Clear all active filters"
      >
        <Text style={[{ color: colors.onSurfaceVariant, ...typography.labelSm, fontWeight: '700' }]}>
          Clear All
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SearchBar({ searchQuery, onSearchChange, onClear, colors, typography, radii }) {
  return (
    <View
      style={[
        styles.searchBox,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderRadius: radii.lg,
        },
      ]}
    >
      <Ionicons name="search-outline" size={17} color={GOLD_ACCENT} style={styles.searchIcon} />
      <TextInput
        style={[styles.searchInput, { color: colors.onSurface, ...typography.bodyMd }]}
        placeholder="Search 8,200+ sagas, movies & universes…"
        placeholderTextColor={colors.onSurfaceVariant}
        value={searchQuery}
        onChangeText={onSearchChange}
        autoCorrect={false}
        accessibilityLabel="Search franchise collections"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={17} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function FranchiseRailsView({
  allRows,
  loading,
  error,
  onRetry,
  savedKeys,
  colors,
  typography,
  radii,
  onSelectItem,
  onToggleWatchlist,
  onSaveCollection,
  onHeaderScroll,
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const pendingScrollRestoreRef = useRef(null);

  const [sortMode, setSortMode] = useState('popular');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [letterFilter, setLetterFilter] = useState(null);
  const [navigatorVisible, setNavigatorVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilters, setSizeFilters] = useState([]);
  const [decadeFilters, setDecadeFilters] = useState([]);
  const [customDecadeRange, setCustomDecadeRange] = useState({ min: null, max: null });
  const [pinnedIds, setPinnedIds] = useState([]);
  const [sectionCollapsed, setSectionCollapsed] = useState({ library: true, pinned: true });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [search, pinned, collapsed] = await Promise.all([
        loadCollectionSearchQuery(),
        loadPinnedCollectionIds(),
        loadCollectionSectionCollapsed(),
      ]);
      if (cancelled) return;
      setSearchQuery(search);
      setPinnedIds(pinned);
      setSectionCollapsed(collapsed);
      setPrefsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    saveCollectionSearchQuery(searchQuery);
  }, [prefsLoaded, searchQuery]);

  const libraryIds = useMemo(
    () => getLibraryCollectionIds(allRows, savedKeys, watchlistEntryKey),
    [allRows, savedKeys],
  );

  const manualPinnedIds = useMemo(
    () => pinnedIds.filter((id) => !libraryIds.has(id)),
    [pinnedIds, libraryIds],
  );

  const libraryRows = useMemo(() => {
    const raw = getRowsForIds(allRows, libraryIds, 'popular');
    if (
      !searchQuery.trim() &&
      categoryFilter === 'all' &&
      !letterFilter &&
      sizeFilters.length === 0 &&
      decadeFilters.length === 0 &&
      customDecadeRange?.min == null &&
      customDecadeRange?.max == null
    ) {
      return raw;
    }
    return filterCollectionRows(raw, {
      searchQuery,
      sizeFilters,
      decadeFilters,
      customDecadeRange,
      categoryFilter,
      letterFilter,
    });
  }, [allRows, libraryIds, searchQuery, categoryFilter, letterFilter, sizeFilters, decadeFilters, customDecadeRange]);

  const pinnedRows = useMemo(() => {
    const raw = getRowsForIds(allRows, manualPinnedIds, 'popular');
    if (
      !searchQuery.trim() &&
      categoryFilter === 'all' &&
      !letterFilter &&
      sizeFilters.length === 0 &&
      decadeFilters.length === 0 &&
      customDecadeRange?.min == null &&
      customDecadeRange?.max == null
    ) {
      return raw;
    }
    return filterCollectionRows(raw, {
      searchQuery,
      sizeFilters,
      decadeFilters,
      customDecadeRange,
      categoryFilter,
      letterFilter,
    });
  }, [allRows, manualPinnedIds, searchQuery, categoryFilter, letterFilter, sizeFilters, decadeFilters, customDecadeRange]);

  const filteredMainRows = useMemo(() => {
    const filtered = filterCollectionRows(allRows, {
      searchQuery,
      sizeFilters,
      decadeFilters,
      customDecadeRange,
      categoryFilter,
      letterFilter,
    });
    return sortCollectionRows(filtered, sortMode);
  }, [allRows, searchQuery, sizeFilters, decadeFilters, customDecadeRange, categoryFilter, letterFilter, sortMode]);

  const sections = useMemo(() => {
    const result = [];

    if (libraryRows.length > 0) {
      result.push({
        key: 'library',
        title: 'In your library',
        count: libraryRows.length,
        collapsible: true,
        data: sectionCollapsed.library ? [] : libraryRows,
      });
    }

    if (pinnedRows.length > 0) {
      result.push({
        key: 'pinned',
        title: 'Pinned',
        count: pinnedRows.length,
        collapsible: true,
        data: sectionCollapsed.pinned ? [] : pinnedRows,
      });
    }

    const sectionTitle = searchQuery
      ? `Results for "${searchQuery}"`
      : letterFilter
      ? `Sagas starting with "${letterFilter}"`
      : categoryFilter !== 'all'
      ? `${CATEGORY_PILLS.find((c) => c.key === categoryFilter)?.label || 'Filtered'} Franchises`
      : 'All Franchises';

    result.push({
      key: 'catalog',
      title: sectionTitle,
      count: filteredMainRows.length,
      collapsible: false,
      data: filteredMainRows,
    });

    return result;
  }, [libraryRows, pinnedRows, sectionCollapsed, filteredMainRows, searchQuery, letterFilter, categoryFilter]);

  const badgeCount = useMemo(
    () =>
      countActiveFindBadge({
        searchQuery,
        sizeFilters,
        decadeFilters,
        customDecadeRange,
        categoryFilter,
        letterFilter,
      }),
    [searchQuery, sizeFilters, decadeFilters, customDecadeRange, categoryFilter, letterFilter],
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    });
  }, [searchQuery, sizeFilters, decadeFilters, customDecadeRange, categoryFilter, letterFilter, sortMode]);

  useLayoutEffect(() => {
    if (pendingScrollRestoreRef.current != null) {
      const offset = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = null;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset?.({ offset, animated: false });
      });
    }
  }, [sectionCollapsed, sections]);

  const handleSelectLetter = useCallback((letter) => {
    setLetterFilter(letter === 'ALL' || letter === null ? null : letter);
  }, []);

  const handleTogglePin = useCallback(
    (rowId) => {
      if (libraryIds.has(rowId)) return;
      setPinnedIds((prev) => {
        const next = prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId];
        savePinnedCollectionIds(next);
        return next;
      });
    },
    [libraryIds],
  );

  const handleToggleSection = useCallback((sectionKey) => {
    pendingScrollRestoreRef.current = scrollOffsetRef.current;
    setSectionCollapsed((prev) => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      saveCollectionSectionCollapsed(next);
      return next;
    });
  }, []);

  const handleToggleSizeFilter = useCallback((sizeKey) => {
    setSizeFilters((prev) =>
      prev.includes(sizeKey) ? prev.filter((key) => key !== sizeKey) : [...prev, sizeKey],
    );
  }, []);

  const handleToggleDecadeFilter = useCallback((decadeKey) => {
    setDecadeFilters((prev) =>
      prev.includes(decadeKey) ? prev.filter((key) => key !== decadeKey) : [...prev, decadeKey],
    );
  }, []);

  const handleResetFilters = useCallback(() => {
    setSizeFilters([]);
    setDecadeFilters([]);
    setCategoryFilter('all');
    setLetterFilter(null);
    setCustomDecadeRange({ min: null, max: null });
    setSearchQuery('');
  }, []);

  const handleScrollToTop = useCallback(() => {
    Haptics.selectionAsync();
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  }, []);

  const bottomNavScroll = useBottomNavScroll((event) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = y;
    setShowScrollTop(y > 360);
    onHeaderScroll?.(event);
  });

  const renderCollectionRail = useCallback(
    (row) => (
      <CollectionRail
        row={row}
        inLibrary={libraryIds.has(row.id)}
        isPinned={pinnedIds.includes(row.id)}
        onTogglePin={handleTogglePin}
        onSaveCollection={onSaveCollection}
        onToggleWatchlist={onToggleWatchlist}
        savedKeys={savedKeys}
        colors={colors}
        typography={typography}
        radii={radii}
        onSelectItem={onSelectItem}
      />
    ),
    [
      colors,
      typography,
      radii,
      onSelectItem,
      onToggleWatchlist,
      onSaveCollection,
      savedKeys,
      libraryIds,
      pinnedIds,
      handleTogglePin,
    ],
  );

  const renderSectionHeader = useCallback(
    ({ section }) => {
      const expanded = section.collapsible ? !sectionCollapsed[section.key] : true;

      return (
        <SectionHeader
          title={section.title}
          count={section.count}
          expanded={expanded}
          collapsible={section.collapsible}
          onToggle={section.collapsible ? () => handleToggleSection(section.key) : undefined}
          colors={colors}
          typography={typography}
        />
      );
    },
    [sectionCollapsed, colors, typography, handleToggleSection],
  );

  const renderItem = useCallback(({ item }) => renderCollectionRail(item), [renderCollectionRail]);

  const keyExtractor = useCallback((item, index) => `${item.id}-${index}`, []);

  const renderCatalogEmpty = useCallback(() => {
    if (filteredMainRows.length > 0) return null;

    if (loading) {
      return (
        <View style={styles.statePanel}>
          <HomeFeedSkeleton />
          <Text
            style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
          >
            Curating pristine movie collections...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <TouchableOpacity
          style={styles.statePanel}
          onPress={onRetry}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Retry loading movie collections"
        >
          <Ionicons name="refresh-outline" size={24} color={GOLD_ACCENT} />
          <Text
            style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
          >
            Collections could not load. Tap to retry.
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.statePanel}>
        <Ionicons name="albums-outline" size={28} color={GOLD_ACCENT} />
        <Text style={[styles.stateText, { color: colors.onSurface, ...typography.titleMd }]}>
          No collections found
        </Text>
        <Text style={[{ color: colors.onSurfaceVariant, ...typography.bodyMd, textAlign: 'center' }]}>
          Try clearing search keywords or resetting filters.
        </Text>
        <TouchableOpacity
          style={[styles.resetEmptyButton, { backgroundColor: GOLD_ACCENT + '20', borderRadius: radii.full }]}
          onPress={handleResetFilters}
        >
          <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm, fontWeight: '800' }]}>
            Reset All Filters
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [filteredMainRows.length, loading, error, colors, typography, radii, onRetry, handleResetFilters]);

  const renderSectionFooter = useCallback(
    ({ section }) => {
      if (section.key !== 'catalog') return null;
      return renderCatalogEmpty();
    },
    [renderCatalogEmpty],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <ProgrammeSectionHeader
          eyebrow="Franchises & Sagas"
          title="Collections"
          subtitle={`${filteredMainRows.length.toLocaleString()} curated universes`}
          titleUppercase
          style={styles.pageHeader}
        />
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          colors={colors}
          typography={typography}
          radii={radii}
        />
        <CategoryPillsBar
          selectedCategory={categoryFilter}
          onSelectCategory={setCategoryFilter}
          colors={colors}
          typography={typography}
          radii={radii}
        />
        <AlphabetScrubberBar
          letterFilter={letterFilter}
          onSelectLetter={handleSelectLetter}
          colors={colors}
          typography={typography}
          radii={radii}
        />
        <QuickSortBar
          sortMode={sortMode}
          onSelectSort={setSortMode}
          onOpenNavigator={() => setNavigatorVisible(true)}
          badgeCount={badgeCount}
          colors={colors}
          typography={typography}
          radii={radii}
        />
        <ActiveFiltersBar
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
          letterFilter={letterFilter}
          onClearLetter={() => setLetterFilter(null)}
          categoryFilter={categoryFilter}
          onClearCategory={() => setCategoryFilter('all')}
          sizeFilters={sizeFilters}
          onClearSize={handleToggleSizeFilter}
          decadeFilters={decadeFilters}
          onClearDecade={handleToggleDecadeFilter}
          onResetAll={handleResetFilters}
          colors={colors}
          typography={typography}
          radii={radii}
        />
      </View>
    ),
    [
      filteredMainRows.length,
      searchQuery,
      categoryFilter,
      letterFilter,
      sortMode,
      badgeCount,
      sizeFilters,
      decadeFilters,
      handleSelectLetter,
      handleToggleSizeFilter,
      handleToggleDecadeFilter,
      handleResetFilters,
      colors,
      typography,
      radii,
    ],
  );

  return (
    <View style={styles.root}>
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={keyExtractor}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingTop: insets.top + 104,
            paddingBottom: insets.bottom + 120,
          },
          filteredMainRows.length === 0 && styles.scrollInnerEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={listHeader}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        renderItem={renderItem}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        {...bottomNavScroll}
      />

      {/* Floating Action Controls */}
      <View
        style={[
          styles.floatingActionContainer,
          { bottom: insets.bottom + verticalScale(68) },
        ]}
        pointerEvents="box-none"
      >
        {showScrollTop && (
          <TouchableOpacity
            style={[
              styles.scrollTopButton,
              { backgroundColor: colors.surfaceContainerHigh },
            ]}
            onPress={handleScrollToTop}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Scroll back to top"
          >
            <Ionicons name="arrow-up" size={18} color={GOLD_ACCENT} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.floatingNavigatorPill,
            {
              backgroundColor: '#16161b',
              borderRadius: radii.full,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setNavigatorVisible(true);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open Franchise Navigator"
        >
          <Text style={[styles.floatingPillText, { ...typography.labelSm }]}>
            Fast Index
          </Text>
          {badgeCount > 0 && (
            <ProgrammeBadge
              label={badgeCount}
              variant="gold"
              size="xs"
              shape="pill"
              style={styles.floatingBadge}
              textStyle={styles.floatingBadgeText}
            />
          )}
        </TouchableOpacity>
      </View>

      <FranchiseNavigatorSheet
        visible={navigatorVisible}
        onClose={() => setNavigatorVisible(false)}
        colors={colors}
        typography={typography}
        radii={radii}
        allRows={allRows}
        filteredRows={filteredMainRows}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        letterFilter={letterFilter}
        onSelectLetter={handleSelectLetter}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        sizeFilters={sizeFilters}
        onToggleSizeFilter={handleToggleSizeFilter}
        decadeFilters={decadeFilters}
        onToggleDecadeFilter={handleToggleDecadeFilter}
        customDecadeRange={customDecadeRange}
        onCustomDecadeRangeChange={setCustomDecadeRange}
        onResetFilters={handleResetFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingTop: 0,
  },
  scrollInnerEmpty: {
    flexGrow: 1,
  },
  listHeader: {
    paddingHorizontal: GRID_PAD,
    gap: scale(10),
    marginBottom: scale(10),
  },
  pageHeader: {
    marginBottom: 0,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    gap: 8,
  },
  searchIcon: {
    marginTop: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
  },
  categoryPillsContainer: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  categoryPillText: {
    fontSize: scale(11.5),
  },
  scrubberContainer: {
    gap: 6,
    paddingVertical: 2,
  },
  scrubberPill: {
    minWidth: scale(32),
    height: scale(28),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scrubberText: {
    fontSize: scale(11),
  },
  quickSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  sortPillsWrap: {
    flex: 1,
    flexDirection: 'row',
    padding: 2.5,
    gap: 2,
  },
  sortSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sortSegmentText: {
    fontSize: scale(10.5),
  },
  navigatorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  navigatorTriggerText: {
    fontSize: scale(11),
  },
  badgePill: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginStart: 4,
  },
  badgeText: {
    color: '#0c0c0e',
    fontSize: 9.5,
    fontWeight: '900',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  activeFilterChipsWrap: {
    gap: 6,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeFilterChipText: {
    fontSize: scale(11),
    fontWeight: '700',
  },
  clearAllBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: GRID_PAD,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  catalogSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: GRID_PAD,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  sectionHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  sectionHeaderEyebrow: {
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  railTitleReduced: {
    fontSize: scale(13.5),
    lineHeight: scale(18),
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  railHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  saveCollectionText: {
    fontWeight: '700',
    fontSize: scale(11),
    letterSpacing: 0.2,
  },
  pinButton: {
    padding: 6,
    borderRadius: 999,
  },
  floatingActionContainer: {
    position: 'absolute',
    right: GRID_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 40,
    elevation: 40,
  },
  scrollTopButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingNavigatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingPillText: {
    color: GOLD_ACCENT,
    fontWeight: '800',
    fontSize: scale(11.5),
    letterSpacing: 0.3,
  },
  floatingBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginStart: 5,
  },
  floatingBadgeText: {
    color: '#0c0c0e',
    fontSize: 9.5,
    fontWeight: '900',
  },
  statePanel: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    marginHorizontal: GRID_PAD,
    marginTop: 22,
    minHeight: 150,
    paddingHorizontal: 22,
  },
  stateText: {
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  resetEmptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
});
