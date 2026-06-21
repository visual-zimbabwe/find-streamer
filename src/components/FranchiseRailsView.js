import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
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
import { ContentRail } from './ContentRail';
import { CollectionFindSheet } from './CollectionFindSheet';

const GRID_PAD = scale(22);
const GOLD_ACCENT = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';
const ALPHA_LETTER_FONT_SIZE = moderateScale(14, 0.4);

function ProgrammeSectionHeader({ eyebrow, title, subtitle, colors, typography }) {
  return (
    <View style={styles.pageHeader}>
      {eyebrow ? (
        <Text style={[styles.sectionEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[styles.sectionTitle, { color: colors.onSurface, ...typography.titleMd }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.sectionSubtitle,
            { color: colors.onSurfaceVariant, ...typography.labelSm },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

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
  colors,
  typography,
  radii,
  onSelectItem,
}) {
  const pinHidden = inLibrary;

  const headerRight = pinHidden ? null : (
    <TouchableOpacity
      style={[styles.pinButton, { borderColor: isPinned ? GOLD_ACCENT : GOLD_DIM }]}
      onPress={() => {
        Haptics.selectionAsync();
        onTogglePin(row.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={isPinned ? `Unpin ${row.title}` : `Pin ${row.title}`}
    >
      <Ionicons
        name={isPinned ? 'pin' : 'pin-outline'}
        size={18}
        color={isPinned ? GOLD_ACCENT : colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );

  return (
    <ContentRail
      title={row.title}
      icon="albums-outline"
      variant="inline"
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
    <View
      style={[
        styles.sortToggle,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: GOLD_DIM,
          borderRadius: radii.full,
        },
      ]}
    >
      {['rating', 'az'].map((mode) => {
        const active = sortMode === mode;
        const label = mode === 'rating' ? 'RTG' : 'A–Z';
        return (
          <TouchableOpacity
            key={mode}
            style={[
              styles.sortOption,
              active && { backgroundColor: GOLD_ACCENT + '18' },
              { borderRadius: radii.full },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(mode);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={mode === 'rating' ? 'Sort by rating' : 'Sort by A to Z'}
          >
            <Text
              style={[
                {
                  color: active ? GOLD_ACCENT : colors.onSurfaceVariant,
                  ...typography.labelSm,
                  fontWeight: '800',
                },
              ]}
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
          onPress={() => {
            Haptics.selectionAsync();
            onSelect(letter);
          }}
          hitSlop={{ top: 2, bottom: 2, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Jump to collections starting with ${letter}`}
        >
          <Text
            style={[
              styles.alphaLetterText,
              { color: GOLD_ACCENT, fontSize: ALPHA_LETTER_FONT_SIZE },
            ]}
          >
            {letter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FindBar({ badgeCount, onPress, colors, typography, radii }) {
  return (
    <TouchableOpacity
      style={[
        styles.findBar,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: GOLD_DIM,
          borderRadius: radii.lg,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel="Find collection"
    >
      <Ionicons name="search-outline" size={18} color={GOLD_ACCENT} />
      <Text style={[styles.findBarText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
        Find collection
      </Text>
      {badgeCount > 0 && (
        <View style={[styles.findBadge, { backgroundColor: GOLD_ACCENT }]}>
          <Text style={[styles.findBadgeText, typography.labelSm]}>{badgeCount}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={GOLD_ACCENT} style={{ opacity: 0.8 }} />
    </TouchableOpacity>
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
  onHeaderScroll,
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const skipNextCatalogResetRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const pendingScrollRestoreRef = useRef(null);

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

    result.push({
      key: 'catalog',
      title: 'All Collections',
      count: filteredMainRows.length,
      collapsible: false,
      data: filteredMainRows,
    });

    return result;
  }, [libraryRows, pinnedRows, sectionCollapsed, filteredMainRows]);

  const catalogSectionIndex = useMemo(
    () => sections.findIndex((section) => section.key === 'catalog'),
    [sections],
  );

  const indexLetters = useMemo(() => getIndexLetters(filteredMainRows), [filteredMainRows]);

  const badgeCount = useMemo(
    () =>
      countActiveFindBadge({
        searchQuery,
        sizeFilters,
        decadeFilters,
        customDecadeRange,
      }),
    [searchQuery, sizeFilters, decadeFilters, customDecadeRange],
  );

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

  useLayoutEffect(() => {
    if (pendingScrollRestoreRef.current != null) {
      const offset = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = null;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset?.({ offset, animated: false });
      });
    }
  }, [sectionCollapsed, sections]);

  const scrollToCatalogIndex = useCallback(
    (targetIndex, { requireAz = false } = {}) => {
      if (targetIndex < 0 || catalogSectionIndex < 0) return;
      setCatalogScrollTarget({
        sectionIndex: catalogSectionIndex,
        itemIndex: targetIndex,
        requireAz,
      });
    },
    [catalogSectionIndex],
  );

  useLayoutEffect(() => {
    if (!catalogScrollTarget) return;
    if (catalogScrollTarget.requireAz && sortMode !== 'az') return;
    if (catalogScrollTarget.sectionIndex >= sections.length) return;

    const { sectionIndex, itemIndex: targetIndex } = catalogScrollTarget;
    const section = sections[sectionIndex];
    if (!section || targetIndex >= section.data.length) return;

    const list = listRef.current;
    if (!list) return;

    requestAnimationFrame(() => {
      list.scrollToLocation({
        sectionIndex,
        itemIndex: targetIndex,
        animated: true,
        viewOffset: 0,
        viewPosition: 0,
      });
      setCatalogScrollTarget(null);
    });
  }, [catalogScrollTarget, sortMode, sections]);

  const scrollToRowId = useCallback(
    (rowId) => {
      const targetIndex = filteredMainRows.findIndex((row) => row.id === rowId);
      scrollToCatalogIndex(targetIndex);
    },
    [filteredMainRows, scrollToCatalogIndex],
  );

  const scrollToLetter = useCallback(
    (letter) => {
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
    },
    [
      allRows,
      searchQuery,
      sizeFilters,
      decadeFilters,
      customDecadeRange,
      sortMode,
      scrollToCatalogIndex,
    ],
  );

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
    setCustomDecadeRange({ min: null, max: null });
  }, []);

  const bottomNavScroll = useBottomNavScroll((event) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    onHeaderScroll?.(event);
  });

  const renderCollectionRail = useCallback(
    (row) => (
      <CollectionRail
        row={row}
        inLibrary={libraryIds.has(row.id)}
        isPinned={pinnedIds.includes(row.id)}
        onTogglePin={handleTogglePin}
        colors={colors}
        typography={typography}
        radii={radii}
        onSelectItem={onSelectItem}
      />
    ),
    [colors, typography, radii, onSelectItem, libraryIds, pinnedIds, handleTogglePin],
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

  const handleScrollToIndexFailed = useCallback((info) => {
    setTimeout(() => {
      const list = listRef.current;
      if (!list) return;
      list.scrollToLocation({
        sectionIndex: info.sectionIndex,
        itemIndex: info.index,
        animated: true,
        viewOffset: 0,
        viewPosition: 0,
      });
      setCatalogScrollTarget(null);
    }, 100);
  }, []);

  const renderCatalogEmpty = useCallback(() => {
    if (filteredMainRows.length > 0) return null;

    if (loading) {
      return (
        <View style={styles.statePanel}>
          <ActivityIndicator color={GOLD_ACCENT} accessibilityLabel="Loading collections" />
          <Text
            style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
          >
            Finding top-rated movie collections...
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
        <Ionicons name="albums-outline" size={26} color={colors.onSurfaceVariant} />
        <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          No collections match your filters.
        </Text>
      </View>
    );
  }, [filteredMainRows.length, loading, error, colors, typography, onRetry]);

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
          eyebrow="Franchises"
          title="Collection Index"
          subtitle={`${filteredMainRows.length} collections`}
          colors={colors}
          typography={typography}
        />
        <FindBar
          badgeCount={badgeCount}
          onPress={() => setFindVisible(true)}
          colors={colors}
          typography={typography}
          radii={radii}
        />
      </View>
    ),
    [filteredMainRows.length, badgeCount, colors, typography, radii],
  );

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.sideControls,
          {
            top: insets.top + verticalScale(180),
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
        <AlphabetIndex letters={indexLetters} onSelect={scrollToLetter} colors={colors} />
      </View>

      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={keyExtractor}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingTop: insets.top + 104,
            paddingBottom: insets.bottom + 112,
            paddingRight: scale(42),
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
        onScrollToIndexFailed={handleScrollToIndexFailed}
        removeClippedSubviews={Platform.OS === 'android'}
        {...bottomNavScroll}
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
  scrollInnerEmpty: {
    flexGrow: 1,
  },
  listHeader: {
    paddingHorizontal: GRID_PAD,
    gap: scale(16),
    marginBottom: scale(8),
  },
  pageHeader: {
    alignItems: 'center',
    gap: 4,
  },
  sectionEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  findBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  findBarText: {
    flex: 1,
    fontWeight: '600',
  },
  findBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  findBadgeText: {
    color: '#0c0c0e',
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
    borderWidth: StyleSheet.hairlineWidth,
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
    textTransform: 'uppercase',
  },
  pinButton: {
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    marginRight: GRID_PAD,
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
});
