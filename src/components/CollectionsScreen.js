import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { fetchStaticCollectionRows, getStaticCollectionRows } from '../lib/collectionMovieRows';
import { getImdbTop100Movies, getImdbTop100Tv } from '../lib/imdbTop100Catalog';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { scale } from '../utils/responsive';
import { MediaListRow } from './MediaListRow';
import { GlassIconButton } from './GlassIconButton';
import { FranchiseRailsView } from './FranchiseRailsView';
import { HomeTopNav } from './HomeTopNav';
import { GOLD_ACCENT, GRID_PAD } from '../theme/programme';

function ImdbRankedRow({
  item,
  rank,
  colors,
  typography,
  radii,
  saved,
  onSelectItem,
  onToggleWatchlist,
}) {
  const key = watchlistEntryKey(item);
  const inLibrary = saved && key && saved.has(key);

  return (
    <MediaListRow
      item={item}
      rank={rank}
      title={item.title}
      titleStyle={{ fontWeight: '700' }}
      meta={`${item.year} · ${item.mediaType === 'tv' ? 'TV Show' : 'Movie'}`}
      metaStyle={{ fontWeight: '600' }}
      imageUri={item.posterUrl}
      imageVariant="poster"
      colors={colors}
      typography={typography}
      radii={radii}
      onPress={() => onSelectItem?.(item)}
      showBookmark={Boolean(onToggleWatchlist)}
      isBookmarked={inLibrary}
      onToggleBookmark={() => onToggleWatchlist?.(item)}
      bookmarkAccessibilityLabel={
        inLibrary ? `Manage library entry for ${item.title}` : `Save ${item.title} to library`
      }
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}, ranked ${rank}`}
      chevronSize={16}
      chevronColor={GOLD_ACCENT}
      chevronOpacity={0.72}
      paddingHorizontal={0}
      paddingVertical={12}
    />
  );
}

function ImdbPageHeader({ colors, typography, count, mediaTab, onBack }) {
  return (
    <View style={styles.imdbPageHeader}>
      {onBack ? (
        <View style={styles.imdbBackRow}>
          <GlassIconButton
            icon="arrow-back"
            iconSize={20}
            size={36}
            onPress={onBack}
            accessibilityLabel="Back to collections"
          />
        </View>
      ) : null}
      <Text style={[styles.imdbEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>IMDb</Text>
      <Text
        style={[styles.imdbPageTitle, { color: colors.onSurface, ...typography.titleMd }]}
        accessibilityRole="header"
      >
        Top 100
      </Text>
      <Text
        style={[styles.imdbPageSubtitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
      >
        {count} {mediaTab === 'tv' ? 'series' : 'films'}
      </Text>
    </View>
  );
}

export function CollectionsScreen({
  onSelectItem,
  onOpenHomeFilter,
  onToggleWatchlist,
  onSaveCollection,
  watchlistIds = [],
  subView = 'franchises',
  onSubViewChange,
  imdbMediaTab = 'movie',
  onImdbMediaTabChange,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const headerScrolledRef = useRef(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const [allRows, setAllRows] = useState(() => {
    try {
      return getStaticCollectionRows();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const savedKeys = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const imdbItems = useMemo(() => {
    const source = imdbMediaTab === 'tv' ? getImdbTop100Tv() : getImdbTop100Movies();
    return [...source].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  }, [imdbMediaTab]);

  const atmosphereColors = [colors.surfaceContainerHigh, colors.background];

  const loadCollectionRows = useCallback(async () => {
    try {
      const staticRows = getStaticCollectionRows();
      if (staticRows && staticRows.length > 0) {
        setAllRows(staticRows);
        return;
      }
      setLoading(true);
      setError(null);
      const rows = await fetchStaticCollectionRows();
      setAllRows(rows);
    } catch (err) {
      console.error('[CollectionsScreen] failed to load rows:', err);
      setError(err);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subView === 'franchises' && allRows.length === 0) {
      loadCollectionRows();
    }
  }, [loadCollectionRows, subView, allRows.length]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (subView === 'imdb') {
        onSubViewChange?.('franchises');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [subView, onSubViewChange]);

  const handleHeaderScroll = useCallback((event) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    const scrolled = y > 24;
    if (scrolled !== headerScrolledRef.current) {
      headerScrolledRef.current = scrolled;
      setHeaderScrolled(scrolled);
    }
  }, []);

  const handleNavSelect = (key) => {
    if (subView === 'franchises') {
      if (key === 'imdb_top100') {
        onSubViewChange?.('imdb');
        onImdbMediaTabChange?.('movie');
      }
      return;
    }

    if (key === 'collections') {
      onSubViewChange?.('franchises');
      return;
    }
    if (key === 'movie' || key === 'tv') {
      onImdbMediaTabChange?.(key);
    }
  };

  const bottomNavScroll = useBottomNavScroll((event) => {
    handleHeaderScroll(event);
  });

  const topNavSet = subView === 'imdb' ? 'imdbTop100' : 'collectionsRoot';
  const topNavSelected =
    subView === 'imdb' ? (imdbMediaTab === 'tv' ? 'tv' : 'movie') : 'collections';

  if (subView === 'imdb') {
    return (
      <View style={[styles.rootWrap, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={atmosphereColors}
          style={styles.atmosphereTop}
          pointerEvents="none"
        />
        <HomeTopNav
          navSet={topNavSet}
          selectedKey={topNavSelected}
          onSelect={handleNavSelect}
          variant="programme"
          headerScrolled={headerScrolled}
        />
        <FlatList
          data={imdbItems}
          keyExtractor={(item) => watchlistEntryKey(item) || String(item.tmdbId)}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollInner,
            styles.imdbListInner,
            {
              paddingTop: insets.top + 104,
              paddingBottom: insets.bottom + 112,
            },
          ]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={
            <ImdbPageHeader
              colors={colors}
              typography={typography}
              count={imdbItems.length}
              mediaTab={imdbMediaTab}
              onBack={() => onSubViewChange?.('franchises')}
            />
          }
          {...bottomNavScroll}
          renderItem={({ item, index }) => (
            <ImdbRankedRow
              item={item}
              rank={item.rank || index + 1}
              colors={colors}
              typography={typography}
              radii={radii}
              saved={savedKeys}
              onSelectItem={onSelectItem}
              onToggleWatchlist={onToggleWatchlist}
            />
          )}
        />
      </View>
    );
  }

  return (
    <View style={[styles.rootWrap, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />
      <HomeTopNav
        navSet={topNavSet}
        selectedKey={topNavSelected}
        onSelect={handleNavSelect}
        variant="programme"
        headerScrolled={headerScrolled}
      />

      <FranchiseRailsView
        allRows={allRows}
        loading={loading}
        error={error}
        onRetry={loadCollectionRows}
        savedKeys={savedKeys}
        colors={colors}
        typography={typography}
        radii={radii}
        onSelectItem={onSelectItem}
        onToggleWatchlist={onToggleWatchlist}
        onSaveCollection={onSaveCollection}
        onHeaderScroll={handleHeaderScroll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrap: {
    flex: 1,
  },
  atmosphereTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: scale(280),
    zIndex: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingTop: 0,
  },
  imdbListInner: {
    paddingHorizontal: GRID_PAD,
  },
  imdbPageHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: scale(20),
    position: 'relative',
    justifyContent: 'center',
  },
  imdbBackRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
  imdbEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  imdbPageTitle: {
    fontWeight: '800',
    letterSpacing: 0.4,
    paddingEnd: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  imdbPageSubtitle: {
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
