import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { GRID_GAP, GRID_PAD, gridColWidth } from '../theme/programme';
import { scale, verticalScale } from '../utils/responsive';

const WINDOW_W = Dimensions.get('window').width;
const GRID_COL_W = gridColWidth(WINDOW_W);
const GRID_POSTER_H = GRID_COL_W * 1.5;
const FEATURE_H = verticalScale(420);
const CHIP_W = scale(248);
const CHIP_H = CHIP_W * (9 / 16);
const RAIL_POSTER_W = GRID_COL_W;
const RAIL_POSTER_H = GRID_POSTER_H;

/**
 * A single skeleton block with a horizontal shimmer sweep animation.
 */
export function SkeletonBlock({ style }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const backgroundColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceContainerHigh, colors.surfaceContainerHighest],
  });

  return <Animated.View style={[styles.block, { backgroundColor }, style]} />;
}

function GridPosterCardSkeleton() {
  return (
    <View style={[styles.gridCard, { width: GRID_COL_W }]}>
      <SkeletonBlock style={[styles.gridPoster, { height: GRID_POSTER_H }]} />
      <SkeletonBlock style={styles.gridTitleLine} />
      <SkeletonBlock style={styles.gridMetaLine} />
    </View>
  );
}

function GridRowSkeleton({ columns = 2 }) {
  return (
    <View style={styles.gridRow}>
      {Array.from({ length: columns }).map((_, index) => (
        <GridPosterCardSkeleton key={index} />
      ))}
    </View>
  );
}

function RailRowSkeleton({ posterCount = 4 }) {
  return (
    <View style={styles.railBlock}>
      <SkeletonBlock style={styles.railEyebrow} />
      <SkeletonBlock style={styles.railTitle} />
      <View style={styles.railPosterRow}>
        {Array.from({ length: posterCount }).map((_, index) => (
          <SkeletonBlock
            key={index}
            style={[
              styles.railPoster,
              { width: RAIL_POSTER_W, height: RAIL_POSTER_H },
              index > 0 && styles.railPosterGap,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A full-screen skeleton that matches the ResultView layout:
 * hero image + title + metadata pills.
 */
export function DetailSkeleton() {
  return (
    <View style={styles.detail}>
      <SkeletonBlock style={styles.detailHero} />
      <View style={styles.detailBody}>
        <SkeletonBlock style={styles.detailTitle} />
        <SkeletonBlock style={styles.detailSubtitle} />
        <View style={styles.detailPills}>
          <SkeletonBlock style={styles.detailPill} />
          <SkeletonBlock style={styles.detailPill} />
          <SkeletonBlock style={styles.detailPill} />
        </View>
        <SkeletonBlock style={styles.detailSynopsisLine} />
        <SkeletonBlock style={styles.detailSynopsisLine} />
        <SkeletonBlock style={[styles.detailSynopsisLine, { width: '68%' }]} />
      </View>
    </View>
  );
}

/**
 * 2-column poster grid skeleton matching DiscoverScreen / MatchResults.
 */
export function ResultsSkeleton({ count = 4 }) {
  const rows = Math.ceil(count / 2);
  return (
    <View style={styles.gridBody}>
      {Array.from({ length: rows }).map((_, index) => (
        <GridRowSkeleton key={index} columns={index === rows - 1 && count % 2 === 1 ? 1 : 2} />
      ))}
    </View>
  );
}

/** Home feed: featured hero + chip strip + two collection rails. */
export function HomeFeedSkeleton() {
  return (
    <View style={styles.homeFeed} accessibilityLabel="Loading home feed">
      <SkeletonBlock style={styles.homeHero} />
      <View style={styles.homeChipRow}>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonBlock
            key={index}
            style={[styles.homeChip, index > 0 && styles.homeChipGap]}
          />
        ))}
      </View>
      <RailRowSkeleton posterCount={4} />
      <RailRowSkeleton posterCount={4} />
    </View>
  );
}

/** Watchlist 2-col grid shimmer. */
export function WatchlistSkeleton({ count = 6 }) {
  const rows = Math.ceil(count / 2);
  return (
    <View style={styles.gridBody} accessibilityLabel="Loading watchlist">
      {Array.from({ length: rows }).map((_, index) => (
        <GridRowSkeleton key={index} columns={index === rows - 1 && count % 2 === 1 ? 1 : 2} />
      ))}
    </View>
  );
}

/** Search live Matches — three editorial row placeholders. */
export function LiveMatchesSkeleton({ count = 3 }) {
  return (
    <View accessibilityLabel="Loading matches">
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.liveRow, index < count - 1 && styles.liveRowDivider]}
        >
          <SkeletonBlock style={styles.liveThumb} />
          <View style={styles.liveTextCol}>
            <SkeletonBlock style={styles.liveTitleLine} />
            <SkeletonBlock style={styles.liveMetaLine} />
          </View>
          <SkeletonBlock style={styles.liveChevron} />
        </View>
      ))}
    </View>
  );
}

/** Discover pagination — two poster cards while loading more. */
export function LoadMoreSkeleton() {
  return <GridRowSkeleton columns={2} />;
}

/** Filter genre chip row placeholder. */
export function GenreChipSkeleton({ count = 8 }) {
  return (
    <View style={styles.chipWrap}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} style={styles.genreChip} />
      ))}
    </View>
  );
}

/** Modal picker list placeholder. */
export function PickerListSkeleton({ count = 6 }) {
  return (
    <View style={styles.pickerList}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} style={styles.pickerRow} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 8,
  },

  gridBody: {
    gap: GRID_GAP,
    paddingVertical: scale(8),
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    justifyContent: 'space-between',
  },
  gridCard: {
    marginBottom: scale(4),
  },
  gridPoster: {
    borderRadius: scale(12),
    marginBottom: scale(10),
    width: '100%',
  },
  gridTitleLine: {
    height: verticalScale(14),
    marginBottom: scale(6),
    width: '82%',
  },
  gridMetaLine: {
    height: verticalScale(11),
    width: '54%',
  },

  detail: {
    flex: 1,
  },
  detailHero: {
    width: '100%',
    height: FEATURE_H,
    borderRadius: 0,
  },
  detailBody: {
    padding: 24,
    gap: 14,
  },
  detailTitle: {
    height: verticalScale(36),
    width: '80%',
    borderRadius: scale(10),
  },
  detailSubtitle: {
    height: verticalScale(18),
    width: '55%',
    borderRadius: scale(8),
  },
  detailPills: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  detailPill: {
    height: verticalScale(28),
    width: scale(72),
    borderRadius: scale(20),
  },
  detailSynopsisLine: {
    height: 14,
    width: '100%',
    borderRadius: 6,
  },

  homeFeed: {
    gap: scale(22),
  },
  homeHero: {
    borderRadius: scale(16),
    height: FEATURE_H,
    width: '100%',
  },
  homeChipRow: {
    flexDirection: 'row',
  },
  homeChip: {
    borderRadius: scale(12),
    height: CHIP_H,
    width: CHIP_W,
  },
  homeChipGap: {
    marginLeft: scale(12),
  },
  railBlock: {
    gap: scale(12),
  },
  railEyebrow: {
    height: scale(10),
    width: scale(72),
  },
  railTitle: {
    height: scale(18),
    width: scale(160),
  },
  railPosterRow: {
    flexDirection: 'row',
  },
  railPoster: {
    borderRadius: scale(12),
  },
  railPosterGap: {
    marginLeft: GRID_GAP,
  },

  liveRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(12),
    minHeight: 48,
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
  },
  liveRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(212, 168, 83, 0.22)',
  },
  liveThumb: {
    borderRadius: 6,
    height: 52,
    width: 36,
  },
  liveTextCol: {
    flex: 1,
    gap: scale(6),
  },
  liveTitleLine: {
    height: verticalScale(14),
    width: '72%',
  },
  liveMetaLine: {
    height: verticalScale(11),
    width: '48%',
  },
  liveChevron: {
    borderRadius: 4,
    height: scale(14),
    width: scale(14),
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginVertical: scale(12),
  },
  genreChip: {
    borderRadius: scale(20),
    height: scale(32),
    width: scale(72),
  },

  pickerList: {
    gap: scale(10),
    marginTop: scale(32),
  },
  pickerRow: {
    borderRadius: scale(8),
    height: scale(44),
    width: '100%',
  },
});
