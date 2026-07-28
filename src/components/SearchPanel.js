import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { ContentRail } from './ContentRail';
import { fetchHomeNowPlayingRail, fetchHomeTraktTrendingRail } from '../lib/homeFeed';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD } from '../theme/programme';
import { scale } from '../utils/responsive';
import { hugLabel } from '../utils/labelText';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { LiveMatchesSkeleton, SkeletonBlock } from './SkeletonLoaders';
import { SearchResultRow } from './SearchResultRow';
import { SearchPosterGrid } from './SearchPosterGrid';
import {
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_PANEL_MAX_ROWS,
  partitionSearchResults,
} from '../lib/searchRanker';

export const SearchPanel = forwardRef(function SearchPanel(
  {
    value,
    onChangeText,
    onSubmit,
    loading,
    recentViewed,
    onPickRecentViewed,
    onRemoveRecentViewed,
    onClearRecentViewed,
    hideHistory,
    typeResults,
    typeLoading,
    onTypeSelect,
    onClear,
    submittedQuery,
    onVoicePress,
    voiceListening,
  },
  ref,
) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const inputRef = useRef(null);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
    }),
    [],
  );
  const visibleTypeResults = typeResults ? typeResults.slice(0, SEARCH_PANEL_MAX_ROWS) : [];
  const { people: panelPeople, titles: panelTitles } = partitionSearchResults(visibleTypeResults);
  const hasSearchText = (value || '').length > 0;
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
  const [traktTrending, setTraktTrending] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);

  const searchSurface = colors.glass;

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
      <ProgrammeSectionHeader eyebrow="Catalogue" title="Find a Title" titleVariant="titleMd" />

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
            ref={inputRef}
            style={[styles.input, { color: colors.onSurface, ...typography.bodyLg }]}
            placeholder="Search for a movie, show"
            placeholderTextColor={colors.onSurfaceVariant}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            textAlign="center"
            // The field is full of proper nouns, so autocorrect is a liability
            // rather than a help, and the action key should say what it does.
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
            autoComplete="off"
            accessibilityLabel="Search for a movie or show"
            accessibilityState={{ busy: Boolean(loading) }}
          />
          {(typeLoading || loading) && (
            <View
              style={styles.typeLoaderDot}
              accessibilityLabel={loading ? `Searching for ${submittedQuery}` : 'Searching'}
            >
              <SkeletonBlock style={StyleSheet.absoluteFill} />
            </View>
          )}
          {hasSearchText && !typeLoading && (
            <TouchableOpacity
              style={styles.clearButton}
              // Clears the committed results too, not just the text. Clearing
              // only the field left the previous search's "Top Matches" sitting
              // under an empty search box.
              onPress={onClear}
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
            disabled={!onVoicePress}
            accessibilityRole="button"
            accessibilityLabel={voiceListening ? 'Stop voice search' : 'Start voice search'}
            accessibilityHint="Dictates search text with the device microphone"
            accessibilityState={{
              selected: Boolean(voiceListening),
              disabled: !onVoicePress,
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
              {hugLabel(voiceListening ? 'Listening' : 'Voice')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showPanel && (
        <View
          style={[
            styles.liveResults,
            { backgroundColor: searchSurface, borderColor: GOLD_DIM, borderRadius: radii.lg },
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

      {!hideHistory && (
        <ContentRail
          title="Trending on Trakt"
          icon="trending-up-outline"
          data={traktTrending}
          colors={colors}
          typography={typography}
          radii={radii}
          showCaption={false}
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
          showCaption={false}
          onSelectItem={onPickRecentViewed}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: GRID_PAD,
    paddingTop: scale(8),
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
  typeLoaderDot: {
    borderRadius: 11,
    height: 22,
    marginLeft: scale(8),
    overflow: 'hidden',
    width: 22,
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
