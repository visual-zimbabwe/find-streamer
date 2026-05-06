import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { StatePanel } from './StatePanel';
import { MediaArtwork } from './MediaArtwork';
import { WATCHLIST_CATEGORIES, getWatchlistCategory } from '../lib/watchlistCategories';
import { fetchNowPlayingMovies } from '../lib/tmdb';

export function WatchlistView({ items, onRemove, onSelect }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState(
    () => Object.fromEntries([...WATCHLIST_CATEGORIES.map((c) => [c.id, true]), ['now_playing', true]])
  );

  const [nowPlaying, setNowPlaying] = useState([]);
  const [nowPlayingLoading, setNowPlayingLoading] = useState(true);
  const [nowPlayingError, setNowPlayingError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setNowPlayingLoading(true);
    setNowPlayingError(null);
    fetchNowPlayingMovies()
      .then((results) => { if (!cancelled) setNowPlaying(results); })
      .catch((err) => { if (!cancelled) setNowPlayingError(err.message || 'Failed to load.'); })
      .finally(() => { if (!cancelled) setNowPlayingLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!items || items.length === 0) {
    return (
      <StatePanel 
        type="empty" 
        title="Your Watchlist" 
        description="You have no titles saved yet. Explore movies and add them to your collection."
      />
    );
  }

  const sortByRatingDesc = (arr) =>
    [...arr].sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));

  const groupedItems = WATCHLIST_CATEGORIES
    .map((category) => {
      const all = items.filter((item) => getWatchlistCategory(item.watchlistCategoryId).id === category.id);
      const movies = sortByRatingDesc(all.filter((item) => item.mediaType === 'movie'));
      const tvShows = sortByRatingDesc(all.filter((item) => item.mediaType !== 'movie'));
      return { ...category, movies, tvShows, totalCount: all.length };
    })
    .filter((category) => category.totalCount > 0);

  const toggleCategory = (categoryId) => {
    setCollapsedCategoryIds((current) => ({
      ...current,
      [categoryId]: !current[categoryId],
    }));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface, ...typography.headlineLg }]}>My Watchlist</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          You have {items.length} titles saved to watch later.
        </Text>
      </View>

      <View style={styles.categoryStack}>
        {/* ── Now Playing ── */}
        <View style={styles.categorySection}>
          <TouchableOpacity
            style={styles.categoryHeading}
            activeOpacity={0.75}
            onPress={() => toggleCategory('now_playing')}
            accessibilityRole="button"
            accessibilityLabel={`${collapsedCategoryIds['now_playing'] ? 'Expand' : 'Collapse'} Now Playing`}
            accessibilityState={{ expanded: !collapsedCategoryIds['now_playing'] }}
          >
            <View style={[styles.categoryIcon, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name="film-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.categoryHeadingText}>
              <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]}>Now Playing</Text>
              <Text style={[styles.categoryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                {nowPlayingLoading ? 'LOADING…' : nowPlayingError ? 'UNAVAILABLE' : `${nowPlaying.length} ${nowPlaying.length === 1 ? 'TITLE' : 'TITLES'}`}
              </Text>
            </View>
            <View style={[styles.categoryToggle, { borderColor: colors.outlineVariant }]}>
              <Ionicons
                name={collapsedCategoryIds['now_playing'] ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={colors.onSurfaceVariant}
              />
            </View>
          </TouchableOpacity>

          {!collapsedCategoryIds['now_playing'] && (
            <View style={styles.list}>
              {nowPlayingLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
              )}
              {!nowPlayingLoading && nowPlayingError && (
                <Text style={[styles.synopsis, { color: colors.error, ...typography.bodyMd }]}>{nowPlayingError}</Text>
              )}
              {!nowPlayingLoading && !nowPlayingError && nowPlaying.map((item) => (
                <TouchableOpacity
                  key={item.tmdbId}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => onSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open details for ${item.title}`}
                >
                  <View style={[styles.posterWrapper, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
                    <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} />
                  </View>
                  <View style={styles.info}>
                    <View style={styles.badgeRow}>
                      <Text style={[styles.mediaType, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>MOVIE</Text>
                    </View>
                    <Text style={[styles.itemTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.meta}>
                      <Ionicons name="star" size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary }}>{item.rating}</Text>
                      <Text style={{ color: colors.onSurfaceVariant }}>• {item.year}</Text>
                    </View>
                    <Text style={[styles.synopsis, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
                      {item.synopsis}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── User watchlist categories ── */}
        {groupedItems.map((category) => {
          const isCollapsed = collapsedCategoryIds[category.id];

          return (
            <View key={category.id} style={styles.categorySection}>
              <TouchableOpacity
                style={styles.categoryHeading}
                activeOpacity={0.75}
                onPress={() => toggleCategory(category.id)}
                accessibilityRole="button"
                accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${category.label}`}
                accessibilityState={{ expanded: !isCollapsed }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: colors.primary + '22' }]}>
                  <Ionicons name={category.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.categoryHeadingText}>
                  <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]}>{category.label}</Text>
                  <Text style={[styles.categoryCount, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                    {category.totalCount} {category.totalCount === 1 ? 'TITLE' : 'TITLES'}
                  </Text>
                </View>
                <View style={[styles.categoryToggle, { borderColor: colors.outlineVariant }]}>
                  <Ionicons
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color={colors.onSurfaceVariant}
                  />
                </View>
              </TouchableOpacity>

              {!isCollapsed && (
                <View style={styles.groupStack}>
                  {[{ label: 'Movies', icon: 'film-outline', data: category.movies }, { label: 'TV Shows', icon: 'tv-outline', data: category.tvShows }]
                    .filter((g) => g.data.length > 0)
                    .map((group) => (
                      <View key={group.label} style={styles.mediaGroup}>
                        <View style={styles.mediaGroupHeader}>
                          <Ionicons name={group.icon} size={14} color={colors.onSurfaceVariant} />
                          <Text style={[styles.mediaGroupLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                            {group.label.toUpperCase()}
                          </Text>
                          <View style={[styles.mediaGroupDivider, { backgroundColor: colors.outlineVariant }]} />
                        </View>
                        <View style={styles.list}>
                          {group.data.map((item) => (
                            <TouchableOpacity
                              key={item.tmdbId}
                              style={styles.card}
                              activeOpacity={0.8}
                              onPress={() => onSelect(item)}
                              accessibilityRole="button"
                              accessibilityLabel={`Open details for ${item.title}`}
                            >
                              <View style={[styles.posterWrapper, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
                                <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} />
                                <TouchableOpacity
                                  style={[styles.removeButton, { backgroundColor: colors.surface + 'cc' }]}
                                  onPress={() => onRemove(item.tmdbId)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove ${item.title} from watchlist`}
                                >
                                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                                </TouchableOpacity>
                              </View>
                              <View style={styles.info}>
                                <Text style={[styles.itemTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
                                  {item.title}
                                </Text>
                                <View style={styles.meta}>
                                  <Ionicons name="star" size={14} color={colors.primary} />
                                  <Text style={{ color: colors.primary }}>{item.rating}</Text>
                                  <Text style={{ color: colors.onSurfaceVariant }}>• {item.year}</Text>
                                </View>
                                <Text style={[styles.synopsis, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
                                  {item.synopsis}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))
                  }
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontWeight: '900',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  subtitle: {
    fontWeight: '500',
  },
  categoryStack: {
    gap: 36,
  },
  categorySection: {
    gap: 18,
  },
  categoryHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  categoryHeadingText: {
    flex: 1,
  },
  categoryTitle: {
    fontWeight: '900',
  },
  categoryCount: {
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  categoryToggle: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  groupStack: {
    gap: 28,
  },
  mediaGroup: {
    gap: 16,
  },
  mediaGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaGroupLabel: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  mediaGroupDivider: {
    flex: 1,
    height: 1,
  },
  list: {
    gap: 32,
  },
  card: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  posterWrapper: {
    width: 120,
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  mediaType: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  itemTitle: {
    fontWeight: '800',
    lineHeight: 28,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  synopsis: {
    lineHeight: 22,
    marginTop: 4,
  },
});
