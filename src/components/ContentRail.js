import React, { useCallback, useMemo } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GridPosterCard } from './GridPosterCard';
import { ProgrammeHairline } from './ProgrammeHairline';
import { ContentRailSkeleton } from './SkeletonLoaders';
import { formatWatchers } from '../lib/searchRails';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { hugLabel } from '../utils/labelText';
import { GOLD_ACCENT, GRID_PAD, GRID_GAP } from '../theme/programme';
import { scale } from '../utils/responsive';

export { GridPosterCard, PosterGrid } from './GridPosterCard';
export { GRID_COL_W, GRID_POSTER_H } from '../theme/programme';

/**
 * A horizontal poster rail.
 *
 * `status` exists because "still loading", "failed", and "genuinely empty" used
 * to render identically — as nothing at all — which left the user with no way
 * to tell a flaky network from a section this app simply doesn't have.
 *
 * @param {'ready' | 'loading' | 'error'} [props.status]
 * @param {boolean} [props.showRank] number the tiles and swap the ★ badge for
 *   the rail's own ordering signal. Only meaningful when the rail really is
 *   ordered by something the number describes.
 */
export function ContentRail({
  title,
  icon = null,
  data,
  colors,
  typography,
  radii,
  onSelectItem,
  onRemoveItem = null,
  headerRight = null,
  variant = 'section',
  showMediaType = true,
  showCaption = true,
  status = 'ready',
  onRetry = null,
  onSeeAll = null,
  onToggleWatchlist = null,
  savedKeys = null,
  showRank = false,
  skeletonCount = 4,
  // Home opts out of the gold divider and the tracked-out caps so its rails read
  // as editorial shelves; Search/Franchise keep the original chrome.
  showHairline = true,
  titleCase = false,
}) {
  const savedSet = useMemo(() => new Set(savedKeys || []), [savedKeys]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <View style={index > 0 ? styles.railItemGap : null}>
        <GridPosterCard
          item={item}
          colors={colors}
          typography={typography}
          radii={radii}
          showMediaType={showMediaType}
          showCaption={showCaption}
          showRating={!showRank}
          // Position in *this* rail, not Trakt's global rank — the movie and
          // show lists each start at 1, so the source ranks would show two #1s.
          rankBadge={showRank ? index + 1 : null}
          footnoteBadge={showRank ? formatWatchers(item.watchers) : null}
          onRemove={onRemoveItem}
          // One corner, one control. Recent owns it for the ✕; every other rail
          // gets the bookmark.
          onToggleWatchlist={onRemoveItem ? null : onToggleWatchlist}
          saved={savedSet.has(watchlistEntryKey(item))}
          onPress={() => onSelectItem(item)}
        />
      </View>
    ),
    [
      colors,
      typography,
      radii,
      showMediaType,
      showCaption,
      showRank,
      onRemoveItem,
      onToggleWatchlist,
      savedSet,
      onSelectItem,
    ],
  );

  const keyExtractor = useCallback((item) => `${item.mediaType || 'movie'}-${item.tmdbId}`, []);

  const isLoading = status === 'loading';
  const isError = status === 'error';
  const hasData = Boolean(data?.length);

  // A rail with nothing to say and nothing to report still says nothing.
  if (!isLoading && !isError && !hasData) return null;

  const trailing =
    headerRight ??
    (onSeeAll && hasData ? (
      <TouchableOpacity
        onPress={onSeeAll}
        accessibilityRole="button"
        accessibilityLabel={`See all ${title}`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.seeAll, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {hugLabel('See all')}
        </Text>
      </TouchableOpacity>
    ) : null);

  return (
    <View style={[styles.railBlock, variant === 'inline' && styles.railBlockInline]}>
      {showHairline ? <ProgrammeHairline style={styles.railHairline} /> : null}
      <View style={styles.railHeaderRow}>
        <View style={styles.railHeaderLeft}>
          {icon ? (
            <Ionicons name={icon} size={16} color={GOLD_ACCENT} style={styles.railIcon} />
          ) : null}
          <Text
            style={[
              styles.railTitle,
              { color: colors.onSurface, ...typography.titleMd },
              titleCase && styles.railTitleCase,
            ]}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        {trailing}
      </View>

      {isLoading && !hasData ? (
        <ContentRailSkeleton posterCount={skeletonCount} />
      ) : isError && !hasData ? (
        <View style={styles.railErrorRow} accessibilityLiveRegion="polite">
          <Ionicons name="cloud-offline-outline" size={16} color={colors.onSurfaceVariant} />
          <Text
            style={[styles.railErrorText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
            numberOfLines={2}
          >
            Couldn’t load this right now.
          </Text>
          {onRetry ? (
            <TouchableOpacity
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={`Retry loading ${title}`}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.railRetry, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                {hugLabel('Retry')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          nestedScrollEnabled
          overScrollMode="never"
          decelerationRate="fast"
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  railBlock: {
    marginTop: scale(28),
    paddingHorizontal: GRID_PAD,
  },
  railBlockInline: {
    marginTop: scale(4),
  },
  railHairline: {
    marginBottom: scale(18),
  },
  railHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(14),
    gap: 8,
  },
  railHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  railIcon: {
    marginTop: 1,
  },
  railTitle: {
    flex: 1,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: scale(13),
  },
  // Editorial voice for Home: Title Case, no tracking, at the fuller titleMd size.
  railTitleCase: {
    textTransform: 'none',
    letterSpacing: 0.2,
    fontSize: scale(16),
    fontWeight: '700',
  },
  railList: {
    paddingRight: GRID_PAD,
  },
  railItemGap: {
    marginLeft: GRID_GAP,
  },
  seeAll: {
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  railErrorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(10),
    minHeight: 48,
    paddingVertical: scale(4),
  },
  railErrorText: {
    flex: 1,
    fontWeight: '500',
  },
  railRetry: {
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
