import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ContentRail } from './ContentRail';
import { GlassIconButton } from './GlassIconButton';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { ProgrammeBadge } from './ProgrammeBadge';
import { getAwardCeremonyRows, getAwardsCeremonies } from '../lib/awardsCatalog';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD } from '../theme/programme';
import { scale } from '../utils/responsive';

const CEREMONY_GROUPS = [
  { id: 'all', label: 'All Honors' },
  { id: 'big_three', label: 'The Big Three' },
  { id: 'academies', label: 'Academies' },
  { id: 'critics', label: 'Critics Circles' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'world', label: 'World Cinema' },
];

const GROUP_CEREMONY_IDS = {
  big_three: new Set(['cannes', 'venice', 'berlin']),
  academies: new Set(['oscars_picture', 'oscars_international', 'cesar', 'goya', 'efa', 'aacta']),
  critics: new Set(['nyfcc', 'nbr']),
  festivals: new Set(['sundance', 'tiff', 'locarno', 'san_sebastian', 'karlovy_vary', 'rotterdam']),
  world: new Set(['tokyo', 'mar_del_plata', 'iffi', 'shanghai', 'aacta_international']),
};

export function AwardsRailsView({
  colors,
  typography,
  radii,
  savedKeys,
  onSelectItem,
  onToggleWatchlist,
  onSaveCollection,
  onHeaderScroll,
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);

  const [activeGroup, setActiveGroup] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [navigatorVisible, setNavigatorVisible] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const allCeremonyRows = useMemo(() => getAwardCeremonyRows(), []);
  const allCeremoniesMeta = useMemo(() => getAwardsCeremonies(), []);

  // Filter rows by active group and search query
  const filteredRows = useMemo(() => {
    let rows = allCeremonyRows;

    // Filter by group
    if (activeGroup !== 'all' && GROUP_CEREMONY_IDS[activeGroup]) {
      const allowed = GROUP_CEREMONY_IDS[activeGroup];
      rows = rows.filter((r) => allowed.has(r.category.ceremonyId));
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows
        .map((r) => {
          const cat = r.category;
          const ceremonyMatches =
            cat.label.toLowerCase().includes(q) ||
            cat.fullName.toLowerCase().includes(q) ||
            cat.awardName.toLowerCase().includes(q) ||
            (cat.country && cat.country.toLowerCase().includes(q));

          if (ceremonyMatches) {
            return r;
          }

          // Filter matching films inside ceremony
          const matchingItems = r.items.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              (item.originalTitle && item.originalTitle.toLowerCase().includes(q)) ||
              (item.director && item.director.toLowerCase().includes(q)) ||
              (item.awardYear && String(item.awardYear).includes(q)),
          );

          if (matchingItems.length > 0) {
            return {
              ...r,
              items: matchingItems,
            };
          }
          return null;
        })
        .filter(Boolean);
    }

    return rows;
  }, [allCeremonyRows, activeGroup, searchQuery]);

  const handleScroll = useCallback(
    (event) => {
      onHeaderScroll?.(event);
      const y = event?.nativeEvent?.contentOffset?.y ?? 0;
      const shouldShow = y > 400;
      if (shouldShow !== showBackToTop) {
        setShowBackToTop(shouldShow);
      }
    },
    [onHeaderScroll, showBackToTop],
  );

  const handleScrollToTop = useCallback(() => {
    Haptics.selectionAsync();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleJumpToCeremony = useCallback(
    (ceremonyId) => {
      setNavigatorVisible(false);
      Haptics.selectionAsync();

      const index = filteredRows.findIndex((r) => r.category.ceremonyId === ceremonyId);
      if (index >= 0) {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
      }
    },
    [filteredRows],
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <ProgrammeSectionHeader
        eyebrow="GLOBAL CINEMA HONORS"
        title="Prestigious Awards & Laureates"
        subtitle="22 Premier International Honors · 1,580 Acclaimed Laureates"
        titleVariant="titleLg"
        align="center"
      />

      {/* Search Input */}
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
          placeholder="Search ceremonies, laureates & directors…"
          placeholderTextColor={colors.onSurfaceVariant}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          accessibilityLabel="Search awards and laureates"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={17} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Pills & Fast Navigator Row */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsScroll}
        >
          {CEREMONY_GROUPS.map((group) => {
            const isSelected = activeGroup === group.id;
            return (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? GOLD_ACCENT + '24' : colors.surfaceContainerHigh,
                    borderColor: isSelected ? GOLD_ACCENT : 'transparent',
                    borderRadius: radii.full,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveGroup(group.id);
                }}
                activeOpacity={0.78}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isSelected ? GOLD_ACCENT : colors.onSurfaceVariant,
                      fontWeight: isSelected ? '800' : '600',
                      ...typography.labelSm,
                    },
                  ]}
                >
                  {group.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.fastIndexButton,
            {
              backgroundColor: colors.surfaceContainerHigh,
              borderRadius: radii.full,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setNavigatorVisible(true);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open ceremony navigator"
        >
          <Ionicons name="list-outline" size={16} color={GOLD_ACCENT} />
          <Text style={[styles.fastIndexText, { color: colors.onSurface, ...typography.labelSm }]}>
            Ceremonies
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRailItem = useCallback(
    ({ item: row }) => {
      const cat = row.category;
      const savedCount = savedKeys && row.items
        ? row.items.filter((item) => savedKeys.has(watchlistEntryKey(item))).length
        : 0;
      const isFullySaved = savedCount === row.items.length && row.items.length > 0;
      const isPartiallySaved = savedCount > 0 && !isFullySaved;

      const headerRight = onSaveCollection ? (
        <TouchableOpacity
          style={[
            styles.saveAllButton,
            {
              backgroundColor: isFullySaved ? GOLD_ACCENT + '24' : colors.surfaceContainerHigh,
              borderRadius: radii.full,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onSaveCollection({
              id: cat.id,
              title: cat.fullName || cat.label,
              items: row.items,
            });
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Save all ${row.items.length} films from ${cat.label}`}
        >
          <Text
            style={[
              styles.saveAllText,
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
      ) : null;

      const subtitleParts = [cat.awardName];
      if (cat.country) subtitleParts.push(cat.country);
      if (cat.founded) subtitleParts.push(`Est. ${cat.founded}`);
      subtitleParts.push(`${row.items.length} Laureates`);
      const subtitle = subtitleParts.join(' · ');

      return (
        <ContentRail
          title={cat.fullName || cat.label}
          subtitle={subtitle}
          data={row.items}
          colors={colors}
          typography={typography}
          radii={radii}
          showMediaType={false}
          showCaption={false}
          showHairline={false}
          titleCase
          onSelectItem={onSelectItem}
          onToggleWatchlist={onToggleWatchlist}
          saved={savedKeys}
          getItemRankBadge={(film) => film.awardYear || null}
          headerRight={headerRight}
        />
      );
    },
    [colors, typography, radii, savedKeys, onSelectItem, onToggleWatchlist, onSaveCollection],
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="ribbon-outline" size={36} color={GOLD_ACCENT} style={{ opacity: 0.8 }} />
      <Text style={[styles.emptyTitle, { color: colors.onSurface, ...typography.titleMd }]}>
        No Honors Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
        No ceremonies or award laureates match "{searchQuery}". Try searching for a director, country, or another festival.
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={filteredRows}
        renderItem={renderRailItem}
        keyExtractor={(item) => item.category.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + 96,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        decelerationRate="normal"
      />

      {/* Back to Top Floating Button */}
      {showBackToTop && (
        <View style={[styles.backToTopWrap, { bottom: insets.bottom + 76 }]}>
          <TouchableOpacity
            style={[
              styles.backToTopButton,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: GOLD_DIM,
                borderRadius: radii.full,
              },
            ]}
            onPress={handleScrollToTop}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Scroll to top"
          >
            <Ionicons name="arrow-up" size={18} color={GOLD_ACCENT} />
          </TouchableOpacity>
        </View>
      )}

      {/* Ceremony Navigator Modal */}
      <Modal
        visible={navigatorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNavigatorVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setNavigatorVisible(false)}>
          <View
            style={[
              styles.navigatorModal,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderRadius: radii.xl,
                borderColor: GOLD_DIM,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface, ...typography.titleMd }]}>
                Jump to Ceremony
              </Text>
              <TouchableOpacity
                onPress={() => setNavigatorVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.navigatorScroll} showsVerticalScrollIndicator={false}>
              {allCeremoniesMeta.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.navigatorItem, { borderBottomColor: colors.outlineVariant + '33' }]}
                  onPress={() => handleJumpToCeremony(c.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.navigatorItemLeft}>
                    <View style={styles.navigatorItemText}>
                      <Text
                        style={[
                          styles.navigatorItemTitle,
                          { color: colors.onSurface, ...typography.bodyMd, fontWeight: '700' },
                        ]}
                      >
                        {c.name}
                      </Text>
                      <Text
                        style={[
                          styles.navigatorItemSubtitle,
                          { color: colors.onSurfaceVariant, ...typography.labelSm },
                        ]}
                      >
                        {c.awardName} · {c.country} ({c.winnersCount} films)
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={GOLD_ACCENT} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  headerContainer: {
    paddingTop: scale(8),
    marginBottom: scale(8),
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: GRID_PAD,
    marginTop: scale(14),
    marginBottom: scale(12),
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
  },
  searchIcon: {
    marginRight: scale(10),
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: scale(14),
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID_PAD,
    gap: 8,
  },
  pillsScroll: {
    gap: 8,
    paddingRight: scale(8),
  },
  filterPill: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: scale(12),
  },
  fastIndexButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
  },
  fastIndexText: {
    fontWeight: '700',
    fontSize: scale(12),
  },
  saveAllButton: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(4),
  },
  saveAllText: {
    fontWeight: '700',
    fontSize: scale(11),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(32),
    paddingVertical: scale(64),
    gap: 12,
  },
  emptyTitle: {
    fontWeight: '800',
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  backToTopWrap: {
    position: 'absolute',
    right: scale(20),
    zIndex: 99,
  },
  backToTopButton: {
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  navigatorModal: {
    width: '100%',
    maxHeight: '75%',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(18),
    paddingVertical: scale(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontWeight: '800',
  },
  navigatorScroll: {
    paddingHorizontal: scale(14),
  },
  navigatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navigatorItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  navigatorItemText: {
    flex: 1,
    gap: 2,
  },
  navigatorItemTitle: {
    fontSize: scale(14),
  },
  navigatorItemSubtitle: {
    fontSize: scale(12),
  },
});
