import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { fetchStaticCollectionRows } from '../lib/collectionMovieRows';
import { getImdbTop100Movies, getImdbTop100Tv } from '../lib/imdbTop100Catalog';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { MediaArtwork } from './MediaArtwork';
import { FranchiseRailsView } from './FranchiseRailsView';
import { HomeTopNav } from './HomeTopNav';

function ImdbRankedRow({ item, rank, colors, typography, radii, saved, onSelectItem, onToggleWatchlist }) {
  const key = watchlistEntryKey(item);
  const inLibrary = saved && key && saved.has(key);

  return (
    <TouchableOpacity
      style={[styles.imdbRow, { backgroundColor: colors.surface, borderRadius: radii.xl }]}
      activeOpacity={0.82}
      onPress={() => onSelectItem?.(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}, ranked ${rank}`}
    >
      <Text style={[styles.imdbRank, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>{rank}</Text>
      <View style={[styles.imdbPosterWrap, { backgroundColor: colors.surfaceContainer, borderRadius: radii.lg }]}>
        <MediaArtwork uri={item.posterUrl} style={styles.imdbPoster} title={item.title} />
      </View>
      <View style={styles.imdbCopy}>
        <Text style={[styles.imdbTitle, { color: colors.onSurface, ...typography.titleMd }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.imdbMeta, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          {item.year} • {item.mediaType === 'tv' ? 'TV' : 'Movie'}
        </Text>
      </View>
      {onToggleWatchlist && (
        <TouchableOpacity
          style={[styles.imdbBookmark, { borderColor: colors.outlineVariant }]}
          onPress={(e) => {
            e?.stopPropagation?.();
            onToggleWatchlist(item);
          }}
          accessibilityRole="button"
          accessibilityLabel={inLibrary ? `Manage library entry for ${item.title}` : `Save ${item.title} to library`}
        >
          <Ionicons
            name={inLibrary ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={inLibrary ? colors.primary : colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
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

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const savedKeys = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const imdbItems = useMemo(() => {
    const source = imdbMediaTab === 'tv' ? getImdbTop100Tv() : getImdbTop100Movies();
    return [...source].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  }, [imdbMediaTab]);

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

  const bottomNavScroll = useBottomNavScroll();

  const topNavSet = subView === 'imdb' ? 'imdbTop100' : 'collectionsRoot';
  const topNavSelected = subView === 'imdb'
    ? (imdbMediaTab === 'tv' ? 'tv' : 'movie')
    : 'collections';

  if (subView === 'imdb') {
    return (
      <View style={styles.rootWrap}>
        <HomeTopNav
          navSet={topNavSet}
          selectedKey={topNavSelected}
          onSelect={handleNavSelect}
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
    <View style={styles.rootWrap}>
      <HomeTopNav
        navSet={topNavSet}
        selectedKey={topNavSelected}
        onSelect={handleNavSelect}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrap: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingTop: 0,
  },
  imdbListInner: {
    paddingHorizontal: 20,
    gap: 10,
  },
  imdbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    padding: 10,
  },
  imdbRank: {
    width: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  imdbPosterWrap: {
    width: 52,
    height: 78,
    overflow: 'hidden',
  },
  imdbPoster: {
    width: '100%',
    height: '100%',
  },
  imdbCopy: {
    flex: 1,
    gap: 4,
  },
  imdbTitle: {
    fontWeight: '800',
  },
  imdbMeta: {
    fontWeight: '600',
  },
  imdbBookmark: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
});
