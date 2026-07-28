import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { fetchStaticCollectionRows } from '../lib/collectionMovieRows';
import { getImdbTop100Movies, getImdbTop100Tv } from '../lib/imdbTop100Catalog';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { scale } from '../utils/responsive';
import { MediaArtwork } from './MediaArtwork';
import { FranchiseRailsView } from './FranchiseRailsView';
import { HomeTopNav } from './HomeTopNav';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD } from '../theme/programme';

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
    <TouchableOpacity
      style={[styles.imdbRow, { borderBottomColor: GOLD_DIM }]}
      activeOpacity={0.78}
      onPress={() => onSelectItem?.(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}, ranked ${rank}`}
    >
      <Text style={[styles.imdbRank, { color: GOLD_ACCENT, ...typography.labelSm }]}>{rank}</Text>
      <View
        style={[
          styles.imdbPosterWrap,
          { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.md },
        ]}
      >
        <MediaArtwork uri={item.posterUrl} style={styles.imdbPoster} title={item.title} instant />
      </View>
      <View style={styles.imdbCopy}>
        <Text
          style={[styles.imdbTitle, { color: colors.onSurface, ...typography.bodyMd }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={[styles.imdbMeta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
          {item.year} · {item.mediaType === 'tv' ? 'TV Show' : 'Movie'}
        </Text>
      </View>
      {onToggleWatchlist && (
        <TouchableOpacity
          style={[styles.imdbBookmark, { borderColor: inLibrary ? GOLD_ACCENT : GOLD_DIM }]}
          onPress={(e) => {
            e?.stopPropagation?.();
            Haptics.selectionAsync();
            onToggleWatchlist(item);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            inLibrary ? `Manage library entry for ${item.title}` : `Save ${item.title} to library`
          }
        >
          <Ionicons
            name={inLibrary ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={inLibrary ? GOLD_ACCENT : colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      )}
      <Ionicons name="chevron-forward" size={16} color={GOLD_ACCENT} style={{ opacity: 0.72 }} />
    </TouchableOpacity>
  );
}

function ImdbPageHeader({ colors, typography, count, mediaTab }) {
  return (
    <View style={styles.imdbPageHeader}>
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

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const savedKeys = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const imdbItems = useMemo(() => {
    const source = imdbMediaTab === 'tv' ? getImdbTop100Tv() : getImdbTop100Movies();
    return [...source].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  }, [imdbMediaTab]);

  const atmosphereColors = [colors.surfaceContainerHigh, colors.background];

  const loadCollectionRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchStaticCollectionRows();
      setAllRows(rows);
    } catch (err) {
      setError(err);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subView === 'franchises') {
      loadCollectionRows();
    }
  }, [loadCollectionRows, subView]);

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
  imdbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  imdbRank: {
    width: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  imdbPosterWrap: {
    width: 36,
    height: 52,
    overflow: 'hidden',
  },
  imdbPoster: {
    width: 36,
    height: 52,
  },
  imdbCopy: {
    flex: 1,
    gap: 2,
  },
  imdbTitle: {
    fontWeight: '700',
  },
  imdbMeta: {
    fontWeight: '600',
  },
  imdbBookmark: {
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
});
