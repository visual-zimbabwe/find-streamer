import React, { useRef, useCallback } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';

/**
 * AnimatedCard
 * Wraps any card content with a spring press-in animation that makes the
 * poster appear to "grow" into the next screen — approximating a shared-element
 * transition without needing a native navigation engine.
 */
function AnimatedCard({ style, onPress, children, accessibilityLabel }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.96,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 200,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    // Burst scale to 1.04 before navigating — gives "launch" feel
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.04,
        tension: 300,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => onPress?.());
  }, [scale, onPress]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

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

      {/* Hero Card — grows on press */}
      <AnimatedCard
        style={[styles.heroCard, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}
        onPress={() => onSelect(topMatch)}
        accessibilityLabel={`Open details for ${topMatch.title}`}
      >
        <MediaArtwork
          uri={topMatch.backdropUrl || topMatch.posterUrl}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityLabel={`${topMatch.title} artwork`}
          title={topMatch.title}
        />
        <View style={styles.heroOverlay} />
        {onToggleWatchlist && (
          <TouchableOpacity
            style={[styles.heroBookmark, { backgroundColor: colors.surface + '99' }]}
            onPress={(event) => {
              event.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      </AnimatedCard>

      {/* Grid of others — each poster also grows on press */}
      <View style={styles.grid}>
        {others.map((item) => (
          <View key={item.tmdbId} style={styles.gridItem}>
            <AnimatedCard
              style={[styles.posterWrapper, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}
              onPress={() => onSelect(item)}
              accessibilityLabel={`Open details for ${item.title}`}
            >
              <MediaArtwork
                uri={item.posterUrl}
                style={styles.poster}
                resizeMode="cover"
                accessibilityLabel={`${item.title} poster`}
                title={item.title}
              />
              <TouchableOpacity
                style={[styles.bookmark, { backgroundColor: colors.surface + '99' }]}
                onPress={(event) => {
                  event.stopPropagation?.();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
            </AnimatedCard>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.itemSubtitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                {item.mediaType === 'movie' ? 'Movie' : 'TV Series'} • {item.year}
              </Text>
            </View>
          </View>
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
    width: '46%',
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
