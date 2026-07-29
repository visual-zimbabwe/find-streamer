import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import {
  GRID_GAP,
  GRID_COL_W,
  GRID_POSTER_H,
  HERO_HEIGHT,
  SEARCH_PANEL_COLUMNS,
  SEARCH_PANEL_COL_W,
  SEARCH_PANEL_PAD,
  SEARCH_PANEL_POSTER_H,
  SPOTLIGHT_POSTER_H,
} from '../theme/programme';
import { scale, verticalScale } from '../utils/responsive';
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

function GridPosterCardSkeleton({ captions = true }) {
  return (
    <View style={[styles.gridCard, { width: GRID_COL_W }]}>
      <SkeletonBlock style={[styles.gridPoster, { height: GRID_POSTER_H }]} />
      {captions ? (
        <>
          <SkeletonBlock style={styles.gridTitleLine} />
          <SkeletonBlock style={styles.gridMetaLine} />
        </>
      ) : null}
    </View>
  );
}

function GridRowSkeleton({ columns = 2, captions = true }) {
  return (
    <View style={styles.gridRow}>
      {Array.from({ length: columns }).map((_, index) => (
        <GridPosterCardSkeleton key={index} captions={captions} />
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
 * A full-screen skeleton matching the ResultView layout: hero band, title,
 * metadata pills, synopsis.
 *
 * Reachable again after the opening-a-title work. The Detail screen is now
 * pushed on the tap against a seed built from the row, so the ordinary open
 * never shows this — it is the fallback for a Detail route with no entry behind
 * it (state restoration). It reserves the real `HERO_HEIGHT` rather than a
 * height of its own; the two had silently drifted apart while nothing rendered
 * this.
 */
export function DetailSkeleton() {
  return (
    <View style={styles.detail} accessibilityLabel="Loading title details">
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
export function ResultsSkeleton({ count = 4, captions = true }) {
  const rows = Math.ceil(count / 2);
  return (
    <View style={styles.gridBody}>
      {Array.from({ length: rows }).map((_, index) => (
        <GridRowSkeleton
          key={index}
          columns={index === rows - 1 && count % 2 === 1 ? 1 : 2}
          captions={captions}
        />
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
          <SkeletonBlock key={index} style={[styles.homeChip, index > 0 && styles.homeChipGap]} />
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

/**
 * Placeholder for the live "Matches" panel. Poster-shaped and 3-up because the
 * panel is a poster grid now; the row-shaped version it replaced reserved a
 * band about a third of the height the real content needed, so the panel jumped
 * when results landed.
 */
export function LiveMatchesSkeleton({ count = SEARCH_PANEL_COLUMNS * 2 }) {
  return (
    <View style={styles.livePosterGrid} accessibilityLabel="Loading matches">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} style={styles.livePoster} />
      ))}
    </View>
  );
}

/**
 * Poster row for a `ContentRail` that is still loading. No eyebrow or title
 * lines — the rail renders its real header immediately and only the posters are
 * pending, so shimmering a header the user can already read would be a lie.
 */
export function ContentRailSkeleton({ posterCount = 4 }) {
  return (
    <View style={styles.railPosterRow} accessibilityLabel="Loading titles">
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
    height: HERO_HEIGHT,
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
    height: SPOTLIGHT_POSTER_H,
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

  livePosterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingBottom: scale(12),
    paddingHorizontal: SEARCH_PANEL_PAD,
  },
  livePoster: {
    borderRadius: scale(14),
    height: SEARCH_PANEL_POSTER_H,
    width: SEARCH_PANEL_COL_W,
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
