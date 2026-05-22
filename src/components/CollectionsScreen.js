import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { ContentRail } from './HomeScreen';
import { HomeTopNav } from './HomeTopNav';

const PAGE_SIZE = 20;

export function CollectionsScreen({ onSelectItem, onOpenHomeFilter }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();

  const [allRows, setAllRows] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isLoadingMore = React.useRef(false);

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
    loadCollectionRows();
  }, [loadCollectionRows]);

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
        // Reset the debounce flag after state update settles
        requestAnimationFrame(() => { isLoadingMore.current = false; });
        return next;
      });
    }
  }, []);

  const bottomNavScroll = useBottomNavScroll(handleScroll);

  const visibleRows = allRows.slice(0, visibleCount);
  const hasMore = visibleCount < allRows.length;

  return (
    <View style={styles.rootWrap}>
      <HomeTopNav
        selectedKey="collections"
        visibleKeys={['collections']}
        onSelect={(key) => {
          if (key === 'collections') return;
          onOpenHomeFilter?.(key);
        }}
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
