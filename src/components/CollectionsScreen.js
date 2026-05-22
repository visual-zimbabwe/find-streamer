import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { fetchHomeCollectionRows } from '../lib/homeFeed';
import { ContentRail } from './HomeScreen';
import { HomeTopNav } from './HomeTopNav';

export function CollectionsScreen({ onSelectItem, onOpenHomeFilter }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const bottomNavScroll = useBottomNavScroll();

  const [collectionRows, setCollectionRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCollectionRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchHomeCollectionRows();
      setCollectionRows(rows);
    } catch (err) {
      setError(err);
      setCollectionRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollectionRows();
  }, [loadCollectionRows]);

  return (
    <View style={styles.rootWrap}>
      <HomeTopNav
        selectedKey="collections"
        onSelect={(key) => {
          if (key === 'collections') return;
          onOpenHomeFilter?.(key);
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingTop: insets.top + 104,
            paddingBottom: insets.bottom + 112,
          },
        ]}
        showsVerticalScrollIndicator={false}
        {...bottomNavScroll}
      >
        {loading ? (
          <View style={[styles.statePanel, { backgroundColor: colors.surfaceContainerHighest }]}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading collections" />
            <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
              Finding top-rated movie collections...
            </Text>
          </View>
        ) : error ? (
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
        ) : collectionRows.length ? (
          collectionRows.map((row) => (
            <ContentRail
              key={row.id}
              title={row.title}
              data={row.items}
              colors={colors}
              typography={typography}
              radii={radii}
              onSelectItem={onSelectItem}
            />
          ))
        ) : (
          <View style={[styles.statePanel, { backgroundColor: colors.surfaceContainerHighest }]}>
            <Ionicons name="albums-outline" size={26} color={colors.onSurfaceVariant} />
            <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
              No confirmed movie collections found right now.
            </Text>
          </View>
        )}
      </ScrollView>
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
});
