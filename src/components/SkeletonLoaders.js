import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { scale, verticalScale } from '../utils/responsive';
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

  // Oscillate between the two surface shades to create a shimmer pulse
  const backgroundColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceContainerHigh, colors.surfaceContainerHighest],
  });

  return <Animated.View style={[styles.block, { backgroundColor }, style]} />;
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
  return (
    <View style={styles.results}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.card}>
          <SkeletonBlock style={styles.poster} />
          <SkeletonBlock style={styles.titleLine} />
          <SkeletonBlock style={styles.metaLine} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 8,
  },

  /* ── Results grid ─────────────────────────────────── */
  results: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingVertical: 8,
  },
  card: {
    marginBottom: 8,
    width: '46%',
  },
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
  },
  titleLine: {
    height: verticalScale(14),
    marginBottom: scale(6),
    width: '82%',
  },
  metaLine: {
    height: verticalScale(11),
    width: '54%',
  },

  /* ── Detail skeleton ──────────────────────────────── */
  detail: {
    flex: 1,
  },
  detailHero: {
    width: '100%',
    height: verticalScale(420),
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
});
