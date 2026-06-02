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
import { ContentRail } from './HomeScreen';
import { HomeTopNav } from './HomeTopNav';

const PAGE_SIZE = 20;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isLoadingMore = React.useRef(false);

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
      setVisibleCount(PAGE_SIZE);
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

  const handleScroll = useCallback((event) => {
    if (!event?.nativeEvent) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (!contentOffset || !contentSize || !layoutMeasurement) return;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 300 && !isLoadingMore.current) {
      isLoadingMore.current = true;
      setVisibleCount((prev) => {
        const next = prev + PAGE_SIZE;
        requestAnimationFrame(() => { isLoadingMore.current = false; });
        return next;
      });
    }
  }, []);

  const bottomNavScroll = useBottomNavScroll(handleScroll);

  const visibleRows = allRows.slice(0, visibleCount);
  const hasMore = visibleCount < allRows.length;

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

      <FlatList
        data={visibleRows}
        keyExtractor={(row) => row.id}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingTop: insets.top + 104,
            paddingBottom: insets.bottom + 112,
          },
        ]}
        showsVerticalScrollIndicator={false}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={3}
        removeClippedSubviews={true}
        {...bottomNavScroll}
        renderItem={({ item: row }) => (
          <ContentRail
            title={row.title}
            data={row.items}
            colors={colors}
            typography={typography}
            radii={radii}
            onSelectItem={onSelectItem}
          />
        )}
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
                onPress={loadCollectionRows}
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
                No confirmed movie collections found right now.
              </Text>
            </View>
          );
        }}
        ListFooterComponent={() => {
          if (hasMore && !loading && !error) {
            return (
              <View style={styles.loadMoreIndicator}>
                <ActivityIndicator color={colors.primary} />
              </View>
            );
          }
          return null;
        }}
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
  loadMoreIndicator: {
    alignItems: 'center',
    paddingVertical: 24,
  },
});
