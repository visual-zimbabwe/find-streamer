import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import {
  countActiveFindBadge,
  filterCollectionRows,
  findRowIndexForLetter,
  getIndexLetters,
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
import { moderateScale, scale, verticalScale } from '../utils/responsive';
import { ContentRail } from './HomeScreen';
import { CollectionFindSheet } from './CollectionFindSheet';

const ALPHA_LETTER_FONT_SIZE = moderateScale(14, 0.4);

// Approximate ContentRail block height for scrollToIndex without rendering every row.
const RAIL_ITEM_HEIGHT = 280;

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  colors,
  typography,
  children,
}) {
  return (
    <View style={styles.sectionBlock}>
      <TouchableOpacity
        style={[styles.sectionHeader, { backgroundColor: colors.surfaceContainerHigh }]}
        onPress={onToggle}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${count} collections, ${expanded ? 'expanded' : 'collapsed'}`}
      >
        <Text style={[{ color: colors.onSurface, ...typography.titleMd, fontWeight: '800', flex: 1 }]}>
          {title}
        </Text>
        <Text style={[{ color: colors.onSurfaceVariant, ...typography.labelSm, fontWeight: '700', marginRight: 8 }]}>
          {count}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.onSurfaceVariant}
        />
      </TouchableOpacity>
      {expanded ? children : null}
    </View>
  );
}

function CollectionRail({
  row,
  inLibrary,
  isPinned,
  onTogglePin,
  colors,
  typography,
  radii,
  onSelectItem,
}) {
  const pinHidden = inLibrary;

  const headerRight = pinHidden ? null : (
    <TouchableOpacity
      style={[styles.pinButton, { borderColor: colors.outlineVariant }]}
      onPress={() => onTogglePin(row.id)}
      accessibilityRole="button"
      accessibilityLabel={isPinned ? `Unpin ${row.title}` : `Pin ${row.title}`}
    >
      <Ionicons
        name={isPinned ? 'pin' : 'pin-outline'}
        size={18}
        color={isPinned ? colors.primary : colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );

  return (
    <ContentRail
      title={row.title}
      data={row.items}
      colors={colors}
      typography={typography}
      radii={radii}
      onSelectItem={onSelectItem}
      headerRight={headerRight}
    />
  );
}

function SortToggle({ sortMode, onChange, colors, typography, radii }) {
  return (
    <View style={[styles.sortToggle, { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.full }]}>
      {['rating', 'az'].map((mode) => {
        const active = sortMode === mode;
        const label = mode === 'rating' ? 'RTG' : 'A–Z';
        return (
          <TouchableOpacity
            key={mode}
            style={[
              styles.sortOption,
              active && { backgroundColor: colors.primary + '22' },
              { borderRadius: radii.full },
            ]}
            onPress={() => onChange(mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={mode === 'rating' ? 'Sort by rating' : 'Sort by A to Z'}
          >
            <Text style={[{
              color: active ? colors.primary : colors.onSurfaceVariant,
              ...typography.labelSm,
              fontWeight: '800',
            }]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AlphabetIndex({ letters, onSelect, colors }) {
  if (!letters.length) return null;

  return (
    <View style={styles.alphaIndex}>
      {letters.map((letter) => (
        <TouchableOpacity
          key={letter}
          style={styles.alphaLetterTap}
          onPress={() => onSelect(letter)}
          hitSlop={{ top: 2, bottom: 2, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Jump to collections starting with ${letter}`}
        >
          <Text style={[styles.alphaLetterText, { color: colors.primary, fontSize: ALPHA_LETTER_FONT_SIZE }]}>
            {letter}
          </Text>
        </TouchableOpacity>
      ))}
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
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const skipNextCatalogResetRef = useRef(false);

  const [sortMode, setSortMode] = useState('rating');
  const [catalogScrollTarget, setCatalogScrollTarget] = useState(null);
  const [findVisible, setFindVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilters, setSizeFilters] = useState([]);
  const [decadeFilters, setDecadeFilters] = useState([]);
  const [customDecadeRange, setCustomDecadeRange] = useState({ min: null, max: null });
  const [pinnedIds, setPinnedIds] = useState([]);
  const [sectionCollapsed, setSectionCollapsed] = useState({ library: true, pinned: true });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

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
    return () => { cancelled = true; };
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

  const libraryRows = useMemo(
    () => getRowsForIds(allRows, libraryIds, 'rating'),
    [allRows, libraryIds],
  );

  const pinnedRows = useMemo(
    () => getRowsForIds(allRows, manualPinnedIds, 'rating'),
    [allRows, manualPinnedIds],
  );

  const filteredMainRows = useMemo(() => {
    const filtered = filterCollectionRows(allRows, {
      searchQuery,
      sizeFilters,
      decadeFilters,
      customDecadeRange,
    });
    return sortCollectionRows(filtered, sortMode);
  }, [allRows, searchQuery, sizeFilters, decadeFilters, customDecadeRange, sortMode]);

  const indexLetters = useMemo(
    () => getIndexLetters(filteredMainRows),
    [filteredMainRows],
  );

  const badgeCount = useMemo(() => countActiveFindBadge({
    searchQuery,
    sizeFilters,
    decadeFilters,
    customDecadeRange,
  }), [searchQuery, sizeFilters, decadeFilters, customDecadeRange]);

  useEffect(() => {
    if (skipNextCatalogResetRef.current) {
      skipNextCatalogResetRef.current = false;
      return;
    }
    setCatalogScrollTarget(null);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    });
  }, [searchQuery, sizeFilters, decadeFilters, customDecadeRange, sortMode]);

  const scrollToCatalogIndex = useCallback((targetIndex, { requireAz = false } = {}) => {
    if (targetIndex < 0) return;
    setCatalogScrollTarget({ index: targetIndex, requireAz });
  }, []);

  useLayoutEffect(() => {
    if (!catalogScrollTarget) return;
    if (catalogScrollTarget.requireAz && sortMode !== 'az') return;
    if (catalogScrollTarget.index >= filteredMainRows.length) return;

    const { index: targetIndex } = catalogScrollTarget;
    const list = listRef.current;
    if (!list) return;

    requestAnimationFrame(() => {
      try {
        list.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0,
        });
        setCatalogScrollTarget(null);
      } catch {
        list.scrollToOffset({
          offset: Math.max(0, targetIndex * RAIL_ITEM_HEIGHT),
          animated: true,
        });
        setCatalogScrollTarget(null);
      }
    });
  }, [catalogScrollTarget, sortMode, filteredMainRows.length]);

  const scrollToRowId = useCallback((rowId) => {
    const targetIndex = filteredMainRows.findIndex((row) => row.id === rowId);
    scrollToCatalogIndex(targetIndex);
  }, [filteredMainRows, scrollToCatalogIndex]);

  const scrollToLetter = useCallback((letter) => {
    const filtered = filterCollectionRows(allRows, {
      searchQuery,
      sizeFilters,
      decadeFilters,
      customDecadeRange,
    });
    const azRows = sortCollectionRows(filtered, 'az');
    const targetIndex = findRowIndexForLetter(azRows, letter);
    if (targetIndex < 0) return;

    if (sortMode !== 'az') {
      skipNextCatalogResetRef.current = true;
      setSortMode('az');
    }
    scrollToCatalogIndex(targetIndex, { requireAz: true });
  }, [
    allRows,
    searchQuery,
    sizeFilters,
    decadeFilters,
    customDecadeRange,
    sortMode,
    scrollToCatalogIndex,
  ]);

  const handleTogglePin = useCallback((rowId) => {
    if (libraryIds.has(rowId)) return;
    setPinnedIds((prev) => {
      const next = prev.includes(rowId)
        ? prev.filter((id) => id !== rowId)
        : [...prev, rowId];
      savePinnedCollectionIds(next);
      return next;
    });
  }, [libraryIds]);

  const handleToggleSection = useCallback((sectionKey) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      saveCollectionSectionCollapsed(next);
      return next;
    });
  }, []);

  const handleToggleSizeFilter = useCallback((sizeKey) => {
    setSizeFilters((prev) => (
      prev.includes(sizeKey)
        ? prev.filter((key) => key !== sizeKey)
        : [...prev, sizeKey]
    ));
  }, []);

  const handleToggleDecadeFilter = useCallback((decadeKey) => {
    setDecadeFilters((prev) => (
      prev.includes(decadeKey)
        ? prev.filter((key) => key !== decadeKey)
        : [...prev, decadeKey]
    ));
  }, []);

  const handleResetFilters = useCallback(() => {
    setSizeFilters([]);
    setDecadeFilters([]);
    setCustomDecadeRange({ min: null, max: null });
  }, []);

  const bottomNavScroll = useBottomNavScroll();

  const renderCollectionRail = useCallback((row) => (
    <CollectionRail
      key={row.id}
      row={row}
      inLibrary={libraryIds.has(row.id)}
      isPinned={pinnedIds.includes(row.id)}
      onTogglePin={handleTogglePin}
      colors={colors}
      typography={typography}
      radii={radii}
      onSelectItem={onSelectItem}
    />
  ), [colors, typography, radii, onSelectItem, libraryIds, pinnedIds, handleTogglePin]);

  const listHeader = useMemo(() => (
    <View>
      {libraryRows.length > 0 && (
        <CollapsibleSection
          title="In your library"
          count={libraryRows.length}
          expanded={!sectionCollapsed.library}
          onToggle={() => handleToggleSection('library')}
          colors={colors}
          typography={typography}
        >
          {libraryRows.map(renderCollectionRail)}
        </CollapsibleSection>
      )}
      {pinnedRows.length > 0 && (
        <CollapsibleSection
          title="Pinned"
          count={pinnedRows.length}
          expanded={!sectionCollapsed.pinned}
          onToggle={() => handleToggleSection('pinned')}
          colors={colors}
          typography={typography}
        >
          {pinnedRows.map(renderCollectionRail)}
        </CollapsibleSection>
      )}
    </View>
  ), [
    libraryRows,
    pinnedRows,
    sectionCollapsed,
    colors,
    typography,
    handleToggleSection,
    renderCollectionRail,
  ]);

  return (
    <View style={styles.root}>
      <TouchableOpacity
        style={[
          styles.findButton,
          {
            top: insets.top + 58,
            backgroundColor: colors.surfaceContainerHigh,
            borderRadius: radii.full,
          },
        ]}
        onPress={() => setFindVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Find collection"
      >
        <Ionicons name="search-outline" size={20} color={colors.onSurface} />
        {badgeCount > 0 && (
          <View style={[styles.findBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.findBadgeText, typography.labelSm]}>{badgeCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View
        style={[
          styles.sideControls,
          {
            top: insets.top + verticalScale(100),
            bottom: insets.bottom + verticalScale(88),
          },
        ]}
        pointerEvents="box-none"
      >
        <SortToggle
          sortMode={sortMode}
          onChange={setSortMode}
          colors={colors}
          typography={typography}
          radii={radii}
        />
        <AlphabetIndex
          letters={indexLetters}
          onSelect={scrollToLetter}
          colors={colors}
        />
      </View>

      <FlatList
        ref={listRef}
        data={filteredMainRows}
        extraData={sortMode}
        keyExtractor={(row) => String(row.id)}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingTop: insets.top + 104,
            paddingBottom: insets.bottom + 112,
            paddingRight: scale(42),
          },
        ]}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        maxToRenderPerBatch={4}
        initialNumToRender={5}
        removeClippedSubviews={Platform.OS === 'ios'}
        getItemLayout={(_, index) => ({
          length: RAIL_ITEM_HEIGHT,
          offset: RAIL_ITEM_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            const list = listRef.current;
            if (!list) return;
            try {
              list.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0,
              });
            } catch {
              list.scrollToOffset({
                offset: Math.max(0, info.index * RAIL_ITEM_HEIGHT),
                animated: true,
              });
            }
            setCatalogScrollTarget(null);
          }, 100);
        }}
        {...bottomNavScroll}
        ListHeaderComponent={listHeader}
        renderItem={({ item: row }) => renderCollectionRail(row)}
        ListEmptyComponent={() => {
          if (loading) {
            return (
              <View style={[styles.statePanel, { backgroundColor: colors.surfaceContainerHighest }]}>
                <ActivityIndicator color={colors.primary} accessibilityLabel="Loading collections" />
                <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                  Finding top-rated movie collections...
                </Text>
              </View>
            );
          }
          if (error) {
            return (
              <TouchableOpacity
                style={[styles.statePanel, { backgroundColor: colors.surfaceContainerHighest }]}
                onPress={onRetry}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Retry loading movie collections"
              >
                <Ionicons name="refresh-outline" size={24} color={colors.primary} />
                <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                  Collections could not load. Tap to retry.
                </Text>
              </TouchableOpacity>
            );
          }
          return (
            <View style={[styles.statePanel, { backgroundColor: colors.surfaceContainerHighest }]}>
              <Ionicons name="albums-outline" size={26} color={colors.onSurfaceVariant} />
              <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                No collections match your filters.
              </Text>
            </View>
          );
        }}
      />

      <CollectionFindSheet
        visible={findVisible}
        onClose={() => setFindVisible(false)}
        colors={colors}
        typography={typography}
        radii={radii}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        sizeFilters={sizeFilters}
        onToggleSizeFilter={handleToggleSizeFilter}
        decadeFilters={decadeFilters}
        onToggleDecadeFilter={handleToggleDecadeFilter}
        customDecadeRange={customDecadeRange}
        onCustomDecadeRangeChange={setCustomDecadeRange}
        onResetFilters={handleResetFilters}
        filteredRows={filteredMainRows}
        onJumpTo={scrollToRowId}
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
  findButton: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  findBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
  },
  sideControls: {
    position: 'absolute',
    right: scale(2),
    zIndex: 30,
    elevation: 30,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: scale(38),
    paddingTop: verticalScale(4),
  },
  sortToggle: {
    flexDirection: 'column',
    padding: 2,
    gap: 2,
  },
  sortOption: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
  },
  alphaIndex: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    marginTop: verticalScale(8),
  },
  alphaLetterTap: {
    flex: 1,
    width: '100%',
    minHeight: verticalScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  alphaLetterText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionBlock: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  pinButton: {
    padding: 6,
    borderWidth: 1,
    borderRadius: 999,
    marginRight: 16,
  },
  statePanel: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 22,
    minHeight: 150,
    paddingHorizontal: 22,
  },
  stateText: {
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
});
