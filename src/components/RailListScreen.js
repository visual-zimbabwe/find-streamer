import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { GridPosterCard, PosterGrid } from './GridPosterCard';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { ResultsSkeleton } from './SkeletonLoaders';
import { EmptyState } from './EmptyState';
import { fetchSearchRailFull } from '../lib/homeFeed';
import { formatWatchers } from '../lib/searchRails';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { scale, verticalScale } from '../utils/responsive';
import { SCROLL_BOTTOM_PAD } from '../theme/programme';

/**
 * The full list behind a rail's "See all".
 *
 * It re-fetches deeper rather than being handed the rail's ten, so the rail
 * itself stays cheap — the whole point of enriching a small buffer is undone if
 * the rail has to hold forty items on the off-chance the user taps through.
 */
export function RailListScreen({
  railId,
  title,
  eyebrow,
  onSelectItem,
  onToggleWatchlist,
  savedKeys,
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const [state, setState] = useState({ status: 'loading', items: [] });

  const load = useCallback(() => {
    let cancelled = false;
    setState((prev) => ({ status: 'loading', items: prev.items }));
    fetchSearchRailFull(railId)
      .then((items) => {
        if (!cancelled) setState({ status: 'ready', items: items || [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [railId]);

  useEffect(() => load(), [load]);

  const savedSet = new Set(savedKeys || []);
  const showRank = railId === 'trakt-trending';
  const atmosphereColors = [colors.surfaceContainerHigh, colors.background];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + scale(8), paddingBottom: insets.bottom + SCROLL_BOTTOM_PAD },
        ]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <ProgrammeSectionHeader eyebrow={eyebrow} title={title} titleVariant="titleMd" />

        {state.status === 'loading' && !state.items.length ? (
          <ResultsSkeleton count={8} captions={false} />
        ) : state.status === 'error' && !state.items.length ? (
          <EmptyState
            variant="offline"
            title="Couldn’t load this list"
            description="Check your connection and try again."
            primaryAction={{
              label: 'Try Again',
              icon: 'refresh-outline',
              onPress: load,
              accessibilityLabel: `Retry loading ${title}`,
            }}
            compact
          />
        ) : (
          <PosterGrid
            items={state.items}
            keyExtractor={(item) => `${item.mediaType || 'movie'}-${item.tmdbId}`}
            renderItem={(item) => {
              const rank = state.items.indexOf(item) + 1;
              return (
                <GridPosterCard
                  item={item}
                  colors={colors}
                  typography={typography}
                  radii={radii}
                  showCaption={false}
                  showRating={!showRank}
                  rankBadge={showRank ? rank : null}
                  footnoteBadge={showRank ? formatWatchers(item.watchers) : null}
                  saved={savedSet.has(watchlistEntryKey(item))}
                  onToggleWatchlist={onToggleWatchlist}
                  onPress={() => onSelectItem(item)}
                />
              );
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  atmosphereTop: {
    height: verticalScale(280),
    left: 0,
    opacity: 0.55,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scrollContent: {
    paddingTop: scale(4),
  },
});
