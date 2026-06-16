import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { ContentRail } from './HomeScreen';
import { fetchHomeNowPlayingRail, fetchHomeTraktTrendingRail } from '../lib/homeFeed';
import { scale } from '../utils/responsive';

const GRID_PAD = scale(22);
const GOLD_ACCENT = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';

function ProgrammeSectionHeader({ eyebrow, title, colors, typography }) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? (
        <Text style={[styles.sectionEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[styles.sectionTitle, { color: colors.onSurface, ...typography.titleMd }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
    </View>
  );
}

function LiveResultRow({ item, index, total, colors, typography, radii, onPress }) {
  const isPerson = item.resultType === 'person';
  const hasYear = item.year && item.year !== 'N/A';
  const metaText = isPerson
    ? `${item.departmentLabel}${item.knownFor ? ` · ${item.knownFor}` : ''}`
    : `${hasYear ? item.year : ''}${hasYear && item.mediaType ? ' · ' : ''}${item.mediaType === 'tv' ? 'TV Show' : item.mediaType === 'movie' ? 'Movie' : ''}`;
  const imageUrl = isPerson ? item.profileUrl : item.posterUrl;

  return (
    <TouchableOpacity
      style={[
        styles.liveRow,
        index < total - 1 && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: GOLD_DIM,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isPerson ? `View filmography for ${item.title}` : `Select ${item.title}`}
      activeOpacity={0.78}
    >
      <View
        style={[
          styles.liveThumbFrame,
          isPerson ? styles.liveAvatarFrame : styles.livePosterFrame,
          { borderRadius: radii.md, backgroundColor: colors.surfaceContainerHigh },
        ]}
      >
        <MediaArtwork
          uri={imageUrl}
          style={isPerson ? styles.liveAvatar : styles.posterImg}
          resizeMode="cover"
          icon={isPerson ? 'person-outline' : 'film-outline'}
          title={item.title}
          compactFallback
          instant
          accessibilityLabel={isPerson ? `${item.title} profile photo` : `${item.title} poster`}
        />
      </View>
      <View style={styles.liveInfo}>
        <View style={styles.liveTitleRow}>
          {isPerson && (
            <Ionicons
              name={item.role === 'movie' ? 'camera-outline' : 'star-outline'}
              size={13}
              color={GOLD_ACCENT}
            />
          )}
          <Text
            style={[styles.liveTitle, { color: colors.onSurface, ...typography.bodyMd }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </View>
        <Text
          style={[styles.liveMeta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
          numberOfLines={1}
        >
          {metaText}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={GOLD_ACCENT} style={{ opacity: 0.72 }} />
    </TouchableOpacity>
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
  const { theme, resolvedMode } = useTheme();
  const { colors, typography, radii } = theme;
  const visibleTypeResults = typeResults ? typeResults.slice(0, 10) : [];
  const hasSearchText = (value || '').length > 0;
  const hasRecentViewed = recentViewed && recentViewed.length > 0;
  const [traktTrending, setTraktTrending] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);

  const searchSurface = useMemo(
    () => (resolvedMode === 'dark' ? 'rgba(12, 12, 14, 0.96)' : 'rgba(247, 247, 242, 0.96)'),
    [resolvedMode],
  );

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
      <ProgrammeSectionHeader
        eyebrow="Catalogue"
        title="Find a Title"
        colors={colors}
        typography={typography}
      />

      <View
        style={[
          styles.searchTheatre,
          {
            backgroundColor: searchSurface,
            borderColor: voiceListening ? GOLD_ACCENT : GOLD_DIM,
            borderRadius: radii.lg,
          },
        ]}
      >
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={20} color={GOLD_ACCENT} style={styles.searchIcon} />
          <TextInput
            style={[styles.input, { color: colors.onSurface, ...typography.bodyLg }]}
            placeholder="Search for a movie, show"
            placeholderTextColor={colors.onSurfaceVariant}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            editable={!loading}
            textAlign="center"
            accessibilityLabel="Search for a movie or show"
          />
          {typeLoading && (
            <ActivityIndicator size="small" color={GOLD_ACCENT} style={styles.typeLoader} />
          )}
          {hasSearchText && !typeLoading && (
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
          {!hasSearchText && !typeLoading && <View style={styles.clearButtonSpacer} />}
        </View>

        <View style={[styles.searchRule, { backgroundColor: GOLD_DIM }]} />

        <View style={styles.searchActions}>
          <TouchableOpacity
            style={[
              styles.voiceButton,
              voiceListening && { backgroundColor: GOLD_ACCENT + '22', borderColor: GOLD_ACCENT },
            ]}
            onPress={onVoicePress}
            disabled={loading || !onVoicePress}
            accessibilityRole="button"
            accessibilityLabel={voiceListening ? 'Stop voice search' : 'Start voice search'}
            accessibilityHint="Dictates search text with the device microphone"
            accessibilityState={{
              selected: Boolean(voiceListening),
              disabled: loading || !onVoicePress,
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={voiceListening ? 'stop-circle' : 'mic-outline'}
              size={20}
              color={voiceListening ? GOLD_ACCENT : colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.voiceLabel,
                {
                  color: voiceListening ? GOLD_ACCENT : colors.onSurfaceVariant,
                  ...typography.labelSm,
                },
              ]}
            >
              {voiceListening ? 'Listening' : 'Voice'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {value.trim().length > 0 && (typeLoading || visibleTypeResults.length > 0) && (
        <View
          style={[
            styles.liveResults,
            { backgroundColor: searchSurface, borderColor: GOLD_DIM, borderRadius: radii.lg },
          ]}
        >
          <Text style={[styles.liveResultsLabel, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            Matches
          </Text>
          {typeLoading && visibleTypeResults.length === 0 ? (
            <View style={styles.liveLoadingRow}>
              <ActivityIndicator
                size="small"
                color={GOLD_ACCENT}
                accessibilityLabel="Loading matches"
              />
            </View>
          ) : (
            visibleTypeResults.map((item, index) => (
              <LiveResultRow
                key={`${item.resultType || item.mediaType}-${item.tmdbId}`}
                item={item}
                index={index}
                total={visibleTypeResults.length}
                colors={colors}
                typography={typography}
                radii={radii}
                onPress={() => onTypeSelect && onTypeSelect(item)}
              />
            ))
          )}
        </View>
      )}

      {!hideHistory && hasRecentViewed && (
        <ContentRail
          title="Recently Viewed"
          icon="time-outline"
          data={recentViewed}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onPickRecentViewed}
        />
      )}

      {!hideHistory && !hasRecentViewed && recentSearches && recentSearches.length > 0 && (
        <View style={styles.historyBlock}>
          <View style={[styles.sectionDivider, { backgroundColor: colors.outlineVariant }]} />
          <ProgrammeSectionHeader
            eyebrow="History"
            title="Recent Searches"
            colors={colors}
            typography={typography}
          />
          <View style={styles.recentChips}>
            {recentSearches.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.recentChip,
                  { borderColor: GOLD_DIM, backgroundColor: searchSurface },
                ]}
                onPress={() => onPickSuggestion(item)}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${item}`}
                activeOpacity={0.82}
              >
                <Ionicons name="search-outline" size={12} color={GOLD_ACCENT} />
                <Text
                  style={[styles.recentChipText, { color: colors.onSurface, ...typography.bodyMd }]}
                  numberOfLines={1}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!hideHistory && (
        <ContentRail
          title="Trending on Trakt"
          icon="trending-up-outline"
          data={traktTrending}
          colors={colors}
          typography={typography}
          radii={radii}
          onSelectItem={onPickRecentViewed}
        />
      )}

      {!hideHistory && (
        <ContentRail
          title="Now playing in theaters"
          icon="ticket-outline"
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
    paddingHorizontal: GRID_PAD,
    paddingTop: scale(8),
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: scale(18),
  },
  sectionEyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  searchTheatre: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 0 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
    }),
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: scale(56),
    paddingHorizontal: scale(14),
    paddingTop: scale(10),
  },
  searchIcon: {
    marginRight: scale(8),
  },
  input: {
    flex: 1,
    fontWeight: '600',
    minHeight: scale(44),
    paddingVertical: 0,
    textAlign: 'center',
  },
  typeLoader: {
    marginLeft: scale(8),
  },
  clearButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  clearButtonSpacer: {
    width: 40,
  },
  searchRule: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: scale(18),
  },
  searchActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: scale(12),
    paddingTop: scale(8),
  },
  voiceButton: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
  },
  voiceLabel: {
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  liveResults: {
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: scale(14),
    overflow: 'hidden',
    paddingBottom: scale(4),
    paddingTop: scale(12),
  },
  liveResultsLabel: {
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: scale(4),
    paddingHorizontal: scale(16),
    textTransform: 'uppercase',
  },
  liveRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(12),
    minHeight: 48,
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
  },
  liveThumbFrame: {
    overflow: 'hidden',
  },
  livePosterFrame: {
    height: 52,
    width: 36,
  },
  liveAvatarFrame: {
    height: 44,
    width: 44,
  },
  posterImg: {
    borderRadius: 6,
    height: 52,
    width: 36,
  },
  livePoster: {
    height: 52,
    width: 36,
  },
  liveAvatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  liveLoadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: scale(12),
  },
  liveInfo: {
    flex: 1,
    minWidth: 0,
  },
  liveTitle: {
    flexShrink: 1,
    fontWeight: '600',
  },
  liveTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 2,
  },
  liveMeta: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  historyBlock: {
    marginTop: scale(28),
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: scale(18),
    opacity: 0.65,
  },
  recentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
  },
  recentChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    minHeight: 48,
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
  },
  recentChipText: {
    flexShrink: 1,
    fontWeight: '600',
  },
});
