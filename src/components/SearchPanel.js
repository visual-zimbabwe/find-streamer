import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { ContentRail } from './ContentRail';
import { fetchHomeNowPlayingRail, fetchHomeTraktTrendingRail } from '../lib/homeFeed';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD } from '../theme/programme';
import { scale } from '../utils/responsive';
import { hugLabel } from '../utils/labelText';
import { LiveMatchesSkeleton } from './SkeletonLoaders';
import { SearchResultRow } from './SearchResultRow';
import { SearchPosterGrid } from './SearchPosterGrid';
import {
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_PANEL_MAX_ROWS,
  partitionSearchResults,
} from '../lib/searchRanker';

/**
 * Everything under the query field: the live "Matches" panel, Recent, and the
 * two idle rails. The field itself is `SearchField`, docked above the scroll
 * view by `SearchStack`.
 */
export function SearchPanel({
  value,
  recentViewed,
  onPickRecentViewed,
  onRemoveRecentViewed,
  onClearRecentViewed,
  hideHistory,
  typeResults,
  typeLoading,
  onTypeSelect,
  submittedQuery,
  onToggleWatchlist,
  savedWatchlistKeys,
  onSeeAllRail,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const visibleTypeResults = typeResults ? typeResults.slice(0, SEARCH_PANEL_MAX_ROWS) : [];
  const { people: panelPeople, titles: panelTitles } = partitionSearchResults(visibleTypeResults);
  const hasRecentViewed = recentViewed && recentViewed.length > 0;
  const trimmedValue = (value || '').trim();
  // Below the minimum the controller never fires a request, so the panel must
  // not claim to be looking for anything.
  const querySearchable = trimmedValue.length >= MIN_SEARCH_QUERY_LENGTH;
  const isSubmittedQuery = Boolean(submittedQuery) && trimmedValue === submittedQuery;
  // The third state the panel never had. It used to render only while loading
  // or while it had rows, so a query TMDb has no answer for — 20 of 25 realistic
  // typos return literally zero results — made the whole block disappear and the
  // screen looked exactly as if nothing had been typed.
  const showNoMatches = querySearchable && !typeLoading && visibleTypeResults.length === 0;
  // Once a query has been submitted, its answer is the results section below —
  // the panel would otherwise announce "no matches" for a query whose matches
  // are on screen, because submitting clears the suggestions but keeps the text.
  // Editing the text makes this false again and the panel comes straight back.
  const showPanel =
    !isSubmittedQuery &&
    querySearchable &&
    (typeLoading || visibleTypeResults.length > 0 || showNoMatches);
  // Each rail carries its own status. Collapsing a failure into an empty array
  // used to make "offline", "rate-limited" and "still loading" render as the
  // same thing — nothing — so the only conclusion available to the user was
  // that the section didn't exist.
  const [traktTrending, setTraktTrending] = useState({ status: 'loading', items: [], source: null });
  const [nowPlaying, setNowPlaying] = useState({ status: 'loading', items: [], source: null });
  const railRunRef = useRef(0);

  // Fetchers resolve either a bare array (Now Playing) or `{ items, source }`
  // (Trending, which cascades Trakt → TMDb). Normalise both so the state always
  // carries a `source` the header can key off.
  const loadRail = useCallback((fetcher, setState) => {
    const run = railRunRef.current;
    setState((prev) => ({ status: 'loading', items: prev.items, source: prev.source }));
    fetcher()
      .then((result) => {
        if (railRunRef.current !== run) return;
        const items = Array.isArray(result) ? result : result?.items || [];
        const source = Array.isArray(result) ? null : result?.source || null;
        setState({ status: 'ready', items, source });
      })
      .catch(() => {
        if (railRunRef.current !== run) return;
        setState({ status: 'error', items: [], source: null });
      });
  }, []);

  const loadTrending = useCallback(
    () => loadRail(fetchHomeTraktTrendingRail, setTraktTrending),
    [loadRail],
  );
  const loadNowPlaying = useCallback(
    () => loadRail(fetchHomeNowPlayingRail, setNowPlaying),
    [loadRail],
  );

  useEffect(() => {
    loadTrending();
    loadNowPlaying();
    return () => {
      // Invalidates every in-flight rail load for this mount.
      railRunRef.current += 1;
    };
  }, [loadTrending, loadNowPlaying]);

  // Trakt was unreachable and the rail is showing TMDb popularity instead — the
  // header and the rank/watcher chrome both key off this.
  const trendingFromFallback = traktTrending.source === 'tmdb';

  return (
    <View style={styles.container}>
      {showPanel && (
        <View
          style={[
            styles.liveResults,
            { backgroundColor: colors.glass, borderColor: GOLD_DIM, borderRadius: radii.lg },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.liveResultsLabel, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            Matches
          </Text>
          {typeLoading && visibleTypeResults.length === 0 ? (
            <LiveMatchesSkeleton />
          ) : showNoMatches ? (
            <View style={styles.noMatchRow}>
              <Ionicons name="search-outline" size={16} color={colors.onSurfaceVariant} />
              <Text
                style={[
                  styles.noMatchText,
                  { color: colors.onSurfaceVariant, ...typography.bodyMd },
                ]}
                numberOfLines={2}
              >
                No matches for “{trimmedValue}”. Try a shorter title or another search.
              </Text>
            </View>
          ) : (
            <>
              {/*
                Titles are posters, people are rows. A person has no poster and
                is a route to a filmography rather than something to watch, so
                the row — with its circular portrait — is still the right shape
                for them; it is only the titles that stopped needing a caption.
              */}
              <SearchPosterGrid
                items={panelTitles}
                colors={colors}
                typography={typography}
                radii={radii}
                onSelect={(item) => onTypeSelect && onTypeSelect(item)}
              />
              {panelPeople.map((item, index) => (
                <SearchResultRow
                  key={`person-${item.personId ?? item.tmdbId}`}
                  item={item}
                  showDivider={index < panelPeople.length - 1}
                  colors={colors}
                  typography={typography}
                  radii={radii}
                  onPress={() => onTypeSelect && onTypeSelect(item)}
                />
              ))}
            </>
          )}
        </View>
      )}

      {/*
        One history block, not two.
        `Recent Searches` used to sit here as a wrapping cloud of the raw query
        *strings* the user typed — lowercase, typos and all — with no way to
        delete any of them; the only eviction was pushing eight newer searches
        in front. It also duplicated the rail above it, because once a search
        ends in opening a title, "what I searched for" and "what I looked at"
        are the same record. This keeps the useful half: the title itself, as
        artwork, one tap from where the user left off — and now removable.
      */}
      {!hideHistory && hasRecentViewed && (
        <ContentRail
          title="Recent"
          icon="time-outline"
          data={recentViewed}
          colors={colors}
          typography={typography}
          radii={radii}
          showCaption={false}
          onSelectItem={onPickRecentViewed}
          onRemoveItem={onRemoveRecentViewed}
          headerRight={
            onClearRecentViewed ? (
              <TouchableOpacity
                onPress={onClearRecentViewed}
                accessibilityRole="button"
                accessibilityLabel="Clear recent titles"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.clearHistory, { color: GOLD_ACCENT, ...typography.labelSm }]}>
                  {hugLabel('Clear')}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/*
        Numbered, because the rail is normally in Trakt's order rather than in
        TMDb rating order — the number is the content, and it would have been a
        lie before. When Trakt is unreachable the rail silently falls back to
        TMDb popularity: the header drops the Trakt claim, and the rank/watcher
        chrome comes off with it, because neither describes the fallback data.
      */}
      {!hideHistory && (
        <ContentRail
          title={trendingFromFallback ? 'Trending now' : 'Trending on Trakt'}
          icon="trending-up-outline"
          data={traktTrending.items}
          status={traktTrending.status}
          onRetry={loadTrending}
          showRank={!trendingFromFallback}
          colors={colors}
          typography={typography}
          radii={radii}
          showCaption={false}
          onSelectItem={onPickRecentViewed}
          onToggleWatchlist={onToggleWatchlist}
          savedKeys={savedWatchlistKeys}
          onSeeAll={
            onSeeAllRail
              ? () =>
                  onSeeAllRail({
                    railId: 'trakt-trending',
                    title: trendingFromFallback ? 'Trending now' : 'Trending on Trakt',
                  })
              : null
          }
        />
      )}

      {/*
        Named for the country it actually describes. TMDb answers `now_playing`
        for the US when no region is passed, which it silently was — so the
        header made a claim about the user's local cinema that the payload never
        supported. There is no finer granularity than the country available.
      */}
      {!hideHistory && (
        <ContentRail
          title="Now playing in US theaters"
          icon="ticket-outline"
          data={nowPlaying.items}
          status={nowPlaying.status}
          onRetry={loadNowPlaying}
          colors={colors}
          typography={typography}
          radii={radii}
          showCaption={false}
          onSelectItem={onPickRecentViewed}
          onToggleWatchlist={onToggleWatchlist}
          savedKeys={savedWatchlistKeys}
          onSeeAll={
            onSeeAllRail
              ? () => onSeeAllRail({ railId: 'now-playing', title: 'Now playing in US theaters' })
              : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: GRID_PAD,
  },
  liveResults: {
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: scale(4),
    overflow: 'hidden',
    paddingBottom: scale(4),
    paddingTop: scale(12),
  },
  clearHistory: {
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  liveResultsLabel: {
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: scale(4),
    paddingHorizontal: scale(16),
    textTransform: 'uppercase',
  },
  noMatchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(10),
    minHeight: 48,
    paddingBottom: scale(12),
    paddingHorizontal: scale(16),
    paddingTop: scale(4),
  },
  noMatchText: {
    flex: 1,
    fontWeight: '500',
  },
});
