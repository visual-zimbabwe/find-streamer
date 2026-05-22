import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { fetchHomeNowPlayingRail, fetchHomeTraktTrendingRail } from '../lib/homeFeed';
import { scale } from '../utils/responsive';

const POSTER_W = scale(118);
const POSTER_H = POSTER_W * 1.5;

function SearchPosterCard({ item, colors, typography, radii, onPress }) {
  return (
    <TouchableOpacity
      style={styles.posterCard}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
    >
      <View style={[styles.posterWrap, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '33', borderRadius: radii.xl }]}>
        <MediaArtwork
          uri={item.posterUrl}
          style={styles.posterImg}
          resizeMode="cover"
          icon={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
          title={item.title}
          compactFallback
          accessibilityLabel={`${item.title} poster`}
        />
        {item.ratingValue > 0 && (
          <View style={[styles.ratingBadge, { borderRadius: radii.sm }]}>
            <Text style={styles.ratingBadgeText}>★ {item.ratingValue.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.posterTitle, { color: colors.onSurface, ...typography.labelSm }]} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.posterMeta}>
        <Ionicons name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'} size={11} color={colors.onSurfaceVariant} />
        <Text style={[styles.posterYear, { color: colors.onSurfaceVariant }]}>{item.year}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SearchPosterRail({ title, data, colors, typography, radii, onSelectItem }) {
  if (!data?.length) return null;
  return (
    <View style={styles.suggestionsWrapper}>
      <Text style={[styles.suggestionTitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => `${item.mediaType || 'movie'}-${item.tmdbId}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.posterRail}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => (
          <SearchPosterCard
            item={item}
            colors={colors}
            typography={typography}
            radii={radii}
            onPress={() => onSelectItem?.(item)}
          />
        )}
      />
    </View>
  );
}

export function SearchPanel({
  value,
  onChangeText,
  onSubmit,
  loading,
  recentSearches,
  recentViewed,
  onPickSuggestion,
  onPickRecentViewed,
  hideHistory,
  typeResults,
  typeLoading,
  onTypeSelect,
  onVoicePress,
  voiceListening,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const visibleTypeResults = typeResults ? typeResults.slice(0, 10) : [];
  const hasSearchText = (value || '').length > 0;
  const hasRecentViewed = recentViewed && recentViewed.length > 0;
  const [traktTrending, setTraktTrending] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchHomeTraktTrendingRail().catch(() => []),
      fetchHomeNowPlayingRail().catch(() => []),
    ])
      .then(([traktItems, nowPlayingItems]) => {
        if (cancelled) return;
        setTraktTrending(traktItems || []);
        setNowPlaying(nowPlayingItems || []);
      })
      .catch(() => {
        if (cancelled) return;
        setTraktTrending([]);
        setNowPlaying([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.searchWrapper, { backgroundColor: colors.surfaceContainerHighest, borderRadius: radii.lg }]}>
        <View style={styles.iconWrapper}>
          <Ionicons name="search-outline" size={20} color={colors.primary} />
        </View>
        <TextInput
          style={[styles.input, { color: colors.onSurface, ...typography.bodyLg }]}
          placeholder="Search for a movie, show"
          placeholderTextColor={colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          editable={!loading}
        />
        {typeLoading && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 14 }} />
        )}
        {hasSearchText && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => onChangeText('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle-outline" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.voiceButton,
            voiceListening && { backgroundColor: colors.primary + '24' },
          ]}
          onPress={onVoicePress}
          disabled={loading || !onVoicePress}
          accessibilityRole="button"
          accessibilityLabel={voiceListening ? 'Stop voice search' : 'Start voice search'}
          accessibilityHint="Dictates search text with the device microphone"
          accessibilityState={{ selected: Boolean(voiceListening), disabled: loading || !onVoicePress }}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
        >
          <Ionicons
            name={voiceListening ? 'stop-circle' : 'mic-outline'}
            size={22}
            color={voiceListening ? colors.primary : colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>

      {/* Live suggestion list */}
      {visibleTypeResults.length > 0 && value.trim().length > 0 && (
        <View style={[styles.liveResults, { backgroundColor: colors.surfaceContainerHighest, borderRadius: radii.lg }]}>
          {visibleTypeResults.map((item, index) => {
            const isPerson = item.resultType === 'person';
            const hasYear = item.year && item.year !== 'N/A';
            const metaText = isPerson
              ? `${item.departmentLabel}${item.knownFor ? ` · ${item.knownFor}` : ''}`
              : `${hasYear ? item.year : ''}${hasYear && item.mediaType ? ' · ' : ''}${item.mediaType === 'tv' ? 'TV Show' : item.mediaType === 'movie' ? 'Movie' : ''}`;
            const imageUrl = isPerson ? item.profileUrl : item.posterUrl;

            return (
              <TouchableOpacity
                key={`${item.resultType || item.mediaType}-${item.tmdbId}`}
                style={[
                  styles.liveRow,
                  index < visibleTypeResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '26' },
                ]}
                onPress={() => onTypeSelect && onTypeSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={isPerson ? `View filmography for ${item.title}` : `Select ${item.title}`}
                activeOpacity={0.72}
              >
                <MediaArtwork
                  uri={imageUrl}
                  style={isPerson ? styles.liveAvatar : styles.livePoster}
                  resizeMode="cover"
                  icon={isPerson ? 'person-outline' : 'film-outline'}
                  title={item.title}
                  compactFallback
                  accessibilityLabel={isPerson ? `${item.title} profile photo` : `${item.title} poster`}
                />
                <View style={styles.liveInfo}>
                  <View style={styles.liveTitleRow}>
                    {isPerson && (
                      <Ionicons name={item.role === 'movie' ? 'camera-outline' : 'star-outline'} size={13} color={colors.primary} />
                    )}
                    <Text style={[styles.liveTitle, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Text style={[styles.liveMeta, { color: colors.onSurfaceVariant, ...typography.labelSm }]} numberOfLines={1}>
                    {metaText}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}




      {!hideHistory && hasRecentViewed && (
        <SearchPosterRail
          title="Recently Viewed"
          data={recentViewed}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onPickRecentViewed}
        />
      )}

      {!hideHistory && !hasRecentViewed && recentSearches && recentSearches.length > 0 && (
        <View style={styles.suggestionsWrapper}>
          <Text style={[styles.suggestionTitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Recent Searches</Text>
          <View style={styles.suggestionChips}>
            {recentSearches.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.suggestionChip, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '26' }]}
                onPress={() => onPickSuggestion(item)}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${item}`}
              >
                <Text style={{ color: colors.onSurface, ...typography.bodyMd }}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!hideHistory && (
        <SearchPosterRail
          title="Trending on Trakt"
          data={traktTrending}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onPickRecentViewed}
        />
      )}

      {!hideHistory && (
        <SearchPosterRail
          title="Now playing in theaters"
          data={nowPlaying}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onPickRecentViewed}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 18,
    marginBottom: 40,
  },
  searchWrapper: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 12,
  },
  iconWrapper: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontWeight: '500',
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginLeft: 2,
  },

  liveResults: {
    marginTop: 8,
    overflow: 'hidden',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  livePoster: {
    width: 36,
    height: 52,
    borderRadius: 6,
  },
  liveAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  livePosterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveInfo: {
    flex: 1,
    minWidth: 0,
  },
  liveTitle: {
    fontWeight: '600',
    flexShrink: 1,
  },
  liveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  liveMeta: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  suggestionsWrapper: {
    marginTop: 26,
  },
  suggestionTitle: {
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  posterRail: {
    paddingRight: 24,
  },
  posterCard: {
    width: POSTER_W,
  },
  posterWrap: {
    borderWidth: 1,
    height: POSTER_H,
    overflow: 'hidden',
    position: 'relative',
    width: POSTER_W,
  },
  posterImg: {
    height: '100%',
    width: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  ratingBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
  },
  posterTitle: {
    fontWeight: '700',
    marginTop: 8,
    minHeight: 34,
  },
  posterMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  posterYear: {
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
  },
});
