import React, { memo, useCallback, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GridPosterCard } from './GridPosterCard';
import { ProgrammeHairline } from './ProgrammeHairline';
import { ContentRailSkeleton } from './SkeletonLoaders';
import { formatWatchers } from '../lib/searchRails';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { hugLabel } from '../utils/labelText';
import {
  GOLD_ACCENT,
  GRID_PAD,
  GRID_GAP,
  FOCAL_CARD_W,
  FOCAL_CARD_H,
  FOCAL_STEP,
} from '../theme/programme';
import { scale } from '../utils/responsive';

export { GridPosterCard, PosterGrid } from './GridPosterCard';
export { GRID_COL_W, GRID_POSTER_H, FOCAL_CARD_W, FOCAL_CARD_H, FOCAL_STEP } from '../theme/programme';

/**
 * FocalRailItem
 *
 * Implements Cineplex-grade dynamic focal depth for horizontal rails:
 * - Active leading card scales smoothly to 1.05x with pure unadorned art and elevated shadow
 * - Trailing cards gently step down to 0.95x with 18% depth scrim
 * - Continuous native driver interpolation on the UI thread (zero JS bridge jank)
 */
const FocalRailItem = memo(function FocalRailItem({
  item,
  index,
  scrollX,
  step,
  cardWidth,
  cardHeight,
  colors,
  typography,
  radii,
  showMediaType,
  showCaption,
  showRank,
  onRemoveItem,
  onToggleWatchlist,
  saved,
  onSelectItem,
}) {
  const { posterScale, depthScrimOpacity } = useMemo(() => {
    const inputRange = [(index - 1) * step, index * step, (index + 1) * step];
    return {
      posterScale: scrollX.interpolate({
        inputRange,
        outputRange: [0.95, 1.05, 0.95],
        extrapolate: 'clamp',
      }),
      depthScrimOpacity: scrollX.interpolate({
        inputRange,
        outputRange: [0.18, 0, 0.20],
        extrapolate: 'clamp',
      }),
    };
  }, [scrollX, index, step]);

  return (
    <View
      style={[
        styles.focalCardWrap,
        { width: cardWidth },
        index > 0 && styles.railItemGap,
      ]}
    >
      <GridPosterCard
        item={item}
        colors={colors}
        typography={typography}
        radii={radii}
        showMediaType={showMediaType}
        showCaption={showCaption}
        showRating={false}
        rankBadge={showRank ? index + 1 : null}
        footnoteBadge={showRank ? formatWatchers(item.watchers) : null}
        onRemove={onRemoveItem}
        onToggleWatchlist={onRemoveItem ? null : onToggleWatchlist}
        saved={saved}
        onPress={() => onSelectItem(item)}
        posterScale={posterScale}
        depthScrimOpacity={depthScrimOpacity}
        style={{ width: cardWidth }}
        posterStyle={{ width: cardWidth, height: cardHeight }}
      />
    </View>
  );
});

/**
 * ContentRail
 *
 * A horizontal cinematic focal poster rail for watchlists, custom shelves, and feeds:
 * - 2.5-card viewport density (~144-150dp width)
 * - Dynamic focal staging: 1.05x lead card elevation + 18% trailing depth scrim
 * - Magnetic snap intervals with smooth physics deceleration
 * - Pure studio poster artwork (rating badges removed)
 * - Instant image decode handoff to prevent blank flashes
 */
export function ContentRail({
  title,
  subtitle = null,
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
  showHairline = true,
  titleCase = false,
  titleStyle = null,
}) {
  const savedSet = useMemo(() => new Set(savedKeys || []), [savedKeys]);
  const scrollX = useRef(new Animated.Value(0)).current;

  const renderItem = useCallback(
    ({ item, index }) => (
      <FocalRailItem
        item={item}
        index={index}
        scrollX={scrollX}
        step={FOCAL_STEP}
        cardWidth={FOCAL_CARD_W}
        cardHeight={FOCAL_CARD_H}
        colors={colors}
        typography={typography}
        radii={radii}
        showMediaType={showMediaType}
        showCaption={showCaption}
        showRank={showRank}
        onRemoveItem={onRemoveItem}
        onToggleWatchlist={onRemoveItem ? null : onToggleWatchlist}
        saved={savedSet.has(watchlistEntryKey(item))}
        onSelectItem={onSelectItem}
      />
    ),
    [
      scrollX,
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
          <View style={styles.railTitleGroup}>
            <Text
              style={[
                { color: colors.onSurface, ...typography.titleMd },
                styles.railTitle,
                titleStyle,
                titleCase && styles.railTitleCase,
              ]}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  styles.railSubtitle,
                  { color: colors.onSurfaceVariant, ...typography.labelSm },
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
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
        <Animated.FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          nestedScrollEnabled
          overScrollMode="never"
          decelerationRate="fast"
          snapToInterval={FOCAL_STEP}
          snapToAlignment="start"
          disableIntervalMomentum={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
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
    marginTop: scale(26),
  },
  railBlockInline: {
    marginTop: scale(4),
  },
  railHairline: {
    marginHorizontal: GRID_PAD,
    marginBottom: scale(16),
  },
  railHeaderRow: {
    paddingHorizontal: GRID_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(10),
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
  railTitleGroup: {
    flex: 1,
    gap: 2,
  },
  railTitle: {
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: scale(13),
  },
  railSubtitle: {
    fontWeight: '600',
    letterSpacing: 0.2,
    fontSize: scale(11),
    opacity: 0.85,
  },
  railTitleCase: {
    textTransform: 'none',
    letterSpacing: 0.2,
    fontSize: scale(16),
    fontWeight: '700',
  },
  railList: {
    paddingLeft: GRID_PAD,
    paddingRight: GRID_PAD + scale(18),
    paddingVertical: scale(8),
  },
  focalCardWrap: {
    paddingVertical: scale(6),
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
    paddingHorizontal: GRID_PAD,
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
