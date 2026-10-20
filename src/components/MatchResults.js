import React, { memo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { scale } from '../utils/responsive';
import { GOLD_DIM, GRID_COL_W, GRID_PAD, GRID_POSTER_ASPECT } from '../theme/programme';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GridPosterCard, PosterGrid } from './GridPosterCard';
import { SearchResultRow } from './SearchResultRow';
import { ResultsSkeleton } from './SkeletonLoaders';
import { collidingTitleNames, partitionSearchResults, yearBadgeFor } from '../lib/searchRanker';

const WINDOW_W = Dimensions.get('window').width;

/**
 * The top match, drawn as one large poster.
 *
 * It used to be a 16:9 backdrop card with the title, a two-line synopsis, the
 * year, a rating pill and a type pill stacked over it. Two things were wrong
 * with that. The art was `backdropUrl` — TMDb's community-primary backdrop,
 * which is routinely key-art with the title already baked in (see
 * `pickHeroBackdrop` in tmdb.js), so the title was drawn twice. And everything
 * in that stack is on the detail screen, one tap away.
 *
 * A poster at ~1.6 grid columns keeps one visual language across the whole
 * screen: the same artwork, the same star badge, the same year rule.
 */
const TOP_MATCH_W = Math.min(GRID_COL_W * 1.62, WINDOW_W - GRID_PAD * 2);

const TopMatchFeature = memo(function TopMatchFeature({
  item,
  colors,
  typography,
  radii,
  saved,
  onPress,
  onToggleWatchlist,
}) {
  return (
    <View style={styles.featureWrap}>
      <GridPosterCard
        item={item}
        colors={colors}
        typography={typography}
        radii={radii}
        showCaption={true}
        showTitle={true}
        showMediaType={true}
        yearBadge={null}
        posterSize="w780"
        // The visible "TOP MATCH" eyebrow is gone with the rest of the caption
        // stack, so the label has to carry what it used to say — otherwise a
        // screen reader hears this and a grid card as the same thing.
        accessibilityLabel={`Top match: ${item.title}${item.year && item.year !== 'N/A' ? ` (${item.year})` : ''}. Open details.`}
        saved={saved}
        onToggleWatchlist={onToggleWatchlist}
        onPress={onPress}
        style={styles.featureCard}
        posterStyle={styles.featurePoster}
      />
    </View>
  );
});

/**
 * The people the search turned up. Rendered as rows rather than poster cards
 * because a person is a route to a filmography, not a thing you can watch — and
 * because this is the same row the live panel shows, so tapping the same name in
 * either place looks and behaves identically.
 */
function PeopleBlock({ people, colors, typography, radii, onSelect }) {
  if (!people.length) return null;

  return (
    <View style={styles.peopleBlock}>
      <Text style={[styles.blockLabel, { color: colors.onSurface, ...typography.labelSm }]}>
        {people.length === 1 ? 'Person' : 'People'}
      </Text>
      <View
        style={[
          styles.peopleCard,
          { backgroundColor: colors.glass, borderColor: GOLD_DIM, borderRadius: radii.lg },
        ]}
      >
        {people.map((person, index) => (
          <SearchResultRow
            key={`person-${person.personId ?? person.tmdbId}`}
            item={person}
            showDivider={index < people.length - 1}
            colors={colors}
            typography={typography}
            radii={radii}
            onPress={() => onSelect(person)}
          />
        ))}
      </View>
    </View>
  );
}

/** The committed-search replacement while one exact query is resolving. */
export function SearchResultsLoading({ query }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <View
      style={styles.container}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Searching for ${query}`}
    >
      <ProgrammeHairline />
      <ProgrammeSectionHeader
        eyebrow="Searching"
        title={`Looking for “${query}”`}
        subtitle="Finding the best matches"
        titleUppercase
      />
      <ResultsSkeleton count={4} />
      <Text style={[styles.loadingHint, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
        You can keep typing to search for something else.
      </Text>
    </View>
  );
}

export function MatchResults({ matches, onSelect, onToggleWatchlist, watchlistIds = [] }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  if (!matches || matches.length === 0) return null;

  // `searchTitleCandidates` returns titles and people in one ranked list now, so
  // the screen splits them rather than the search abandoning itself whenever a
  // person happened to rank first.
  const { people, titles, leadsWithPerson } = partitionSearchResults(matches);
  // When a person is the #1 match (e.g. "Jason Statham"), do not promote an
  // obscure documentary/novelty title as a giant hero poster directly under the
  // person card — render titles in the "Also Matched" grid instead.
  const showHeroFeature = Boolean(titles[0]) && !leadsWithPerson;
  const topMatch = showHeroFeature ? titles[0] : null;
  const others = showHeroFeature ? titles.slice(1) : titles;
  const savedIds = new Set(watchlistIds);

  const subtitleParts = [];
  if (people.length > 0 && leadsWithPerson) {
    subtitleParts.push(`${people.length} ${people.length === 1 ? 'PERSON' : 'PEOPLE'}`);
  }
  if (titles.length > 0) {
    subtitleParts.push(`${titles.length} ${titles.length === 1 ? 'TITLE' : 'TITLES'}`);
  }
  if (people.length > 0 && !leadsWithPerson) {
    subtitleParts.push(`${people.length} ${people.length === 1 ? 'PERSON' : 'PEOPLE'}`);
  }
  const subtitleLabel = `${subtitleParts.join(' · ')} FOUND`;

  const peopleBlock = (
    <PeopleBlock
      people={people}
      colors={colors}
      typography={typography}
      radii={radii}
      onSelect={onSelect}
    />
  );

  return (
    <View style={styles.container}>
      <ProgrammeHairline />

      <ProgrammeSectionHeader
        eyebrow="Results"
        title={titles.length > 0 || leadsWithPerson ? 'Top Matches' : 'People'}
        subtitle={subtitleLabel}
        titleUppercase
      />

      {/* When the best answer overall was a person — "Jason Statham" — they lead. */}
      {leadsWithPerson ? peopleBlock : null}

      {topMatch ? (
        <TopMatchFeature
          item={topMatch}
          colors={colors}
          typography={typography}
          radii={radii}
          saved={savedIds.has(watchlistEntryKey(topMatch))}
          onPress={() => onSelect(topMatch)}
          onToggleWatchlist={onToggleWatchlist}
        />
      ) : null}

      {others.length > 0 && (
        <View style={styles.alsoMatchedBlock}>
          <ProgrammeHairline />
          <Text style={[styles.blockLabel, { color: colors.onSurface, ...typography.labelSm }]}>
            Also Matched
          </Text>
          <PosterGrid
            bodyStyle={styles.alsoMatchedGrid}
            items={others}
            keyExtractor={watchlistEntryKey}
            renderItem={(item) => (
              <GridPosterCard
                item={item}
                colors={colors}
                typography={typography}
                radii={radii}
                showCaption={true}
                showTitle={true}
                showMediaType={true}
                yearBadge={null}
                saved={savedIds.has(watchlistEntryKey(item))}
                onPress={() => onSelect(item)}
                onToggleWatchlist={onToggleWatchlist}
              />
            )}
          />
        </View>
      )}

      {leadsWithPerson ? null : peopleBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: scale(8),
    paddingHorizontal: GRID_PAD,
  },
  featureWrap: {
    alignItems: 'center',
  },
  featureCard: {
    width: TOP_MATCH_W,
  },
  featurePoster: {
    height: TOP_MATCH_W * GRID_POSTER_ASPECT,
    width: TOP_MATCH_W,
  },
  alsoMatchedBlock: {
    marginTop: scale(28),
  },
  blockLabel: {
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: scale(14),
    paddingHorizontal: GRID_PAD,
    textTransform: 'uppercase',
  },
  alsoMatchedGrid: {
    paddingHorizontal: 0,
  },
  peopleBlock: {
    marginTop: scale(24),
  },
  peopleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingVertical: scale(4),
  },
  loadingHint: {
    marginTop: scale(14),
    textAlign: 'center',
  },
});
