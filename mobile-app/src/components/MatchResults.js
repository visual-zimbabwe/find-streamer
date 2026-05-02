import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';

export function MatchResults({ matches, onSelect, onToggleWatchlist, watchlistIds = [], selectedId }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  if (!matches || matches.length === 0) return null;

  const topMatch = matches[0];
  const others = matches.slice(1);
  const savedIds = new Set(watchlistIds);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface, ...typography.headlineLg }]}>Top Matches</Text>
        <Text style={[styles.count, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>{matches.length} results found</Text>
      </View>

      {/* Hero Card */}
      <TouchableOpacity
        style={[styles.heroCard, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}
        onPress={() => onSelect(topMatch)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${topMatch.title}`}
      >
        <MediaArtwork
          uri={topMatch.backdropUrl || topMatch.posterUrl}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityLabel={`${topMatch.title} artwork`}
        />
        <View style={styles.heroOverlay} />
        {onToggleWatchlist && (
          <TouchableOpacity
            style={[styles.heroBookmark, { backgroundColor: colors.surface + '99' }]}
            onPress={(event) => {
              event.stopPropagation?.();
              onToggleWatchlist(topMatch);
            }}
            accessibilityRole="button"
            accessibilityLabel={savedIds.has(topMatch.tmdbId) ? `Remove ${topMatch.title} from watchlist` : `Add ${topMatch.title} to watchlist`}
            accessibilityState={{ selected: savedIds.has(topMatch.tmdbId) }}
          >
            <Ionicons
              name={savedIds.has(topMatch.tmdbId) ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={savedIds.has(topMatch.tmdbId) ? colors.primary : colors.white}
            />
          </TouchableOpacity>
        )}
        <View style={styles.heroContent}>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.onPrimary, ...typography.labelSm }]}>⭐ TOP MATCH</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.white, ...typography.headlineLg }]}>{topMatch.title}</Text>
          <Text style={[styles.heroSynopsis, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
            {topMatch.synopsis}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Grid of others */}
      <View style={styles.grid}>
        {others.map((item) => (
          <TouchableOpacity
            key={item.tmdbId}
            style={styles.gridItem}
            onPress={() => onSelect(item)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Open details for ${item.title}`}
          >
            <View style={[styles.posterWrapper, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
              <MediaArtwork
                uri={item.posterUrl}
                style={styles.poster}
                resizeMode="cover"
                accessibilityLabel={`${item.title} poster`}
              />
              <TouchableOpacity
                style={[styles.bookmark, { backgroundColor: colors.surface + '99' }]}
                onPress={(event) => {
                  event.stopPropagation?.();
                  onToggleWatchlist?.(item);
                }}
                accessibilityRole="button"
                accessibilityLabel={savedIds.has(item.tmdbId) ? `Remove ${item.title} from watchlist` : `Add ${item.title} to watchlist`}
                accessibilityState={{ selected: savedIds.has(item.tmdbId) }}
              >
                <Ionicons
                  name={savedIds.has(item.tmdbId) ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={savedIds.has(item.tmdbId) ? colors.primary : colors.white}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.itemSubtitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                {item.mediaType === 'movie' ? 'Movie' : 'TV Series'} • {item.year}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  count: {
    fontWeight: '600',
  },
  heroCard: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    marginBottom: 32,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeText: {
    fontWeight: '800',
  },
  heroTitle: {
    fontWeight: '900',
    marginBottom: 8,
  },
  heroSynopsis: {
    fontWeight: '500',
    opacity: 0.9,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  gridItem: {
    width: '46%', // Simple 2-column grid for mobile
    marginBottom: 24,
  },
  posterWrapper: {
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  bookmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroBookmark: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  itemInfo: {
    paddingHorizontal: 4,
  },
  itemTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontWeight: '600',
  },
});
