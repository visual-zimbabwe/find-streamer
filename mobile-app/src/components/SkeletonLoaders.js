import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function SkeletonBlock({ style }) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View
      style={[
        styles.block,
        { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant + '1F' },
        style,
      ]}
    />
  );
}

export function ResultsSkeleton({ count = 4 }) {
  return (
    <View style={styles.results}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.card}>
          <SkeletonBlock style={styles.poster} />
          <SkeletonBlock style={styles.title} />
          <SkeletonBlock style={styles.meta} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 8,
    borderWidth: 1,
    opacity: 0.72,
  },
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
    marginBottom: 10,
    width: '100%',
  },
  title: {
    height: 14,
    marginBottom: 6,
    width: '82%',
  },
  meta: {
    height: 11,
    width: '54%',
  },
});
