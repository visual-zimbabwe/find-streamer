import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GridPosterCard } from './GridPosterCard';
import {
  GRID_GAP,
  SEARCH_PANEL_COLUMNS,
  SEARCH_PANEL_COL_W,
  SEARCH_PANEL_PAD,
  SEARCH_PANEL_POSTER_H,
} from '../theme/programme';
import { scale } from '../utils/responsive';
import { collidingTitleNames, yearBadgeFor } from '../lib/searchRanker';

/**
 * The three-column, caption-free poster grid the live "Matches" panel draws.
 *
 * It exists because the panel used to render 36x52dp thumbnails: at that size
 * no poster's lettering is readable, so every row *had* to print the title
 * underneath. Shrinking the art was what made the caption mandatory. At three
 * columns the poster is legible on its own and the text can go.
 *
 * Three columns rather than the results grid's two: the panel sits under a
 * focused text field with the keyboard up, so it gets roughly a third of the
 * screen. Six results (`SEARCH_PANEL_MAX_ROWS`) fill exactly two rows.
 */
export function SearchPosterGrid({ items, colors, typography, radii, onSelect }) {
  if (!items?.length) return null;

  const collisions = collidingTitleNames(items);
  // A trailing partial row has to stay left-aligned rather than spreading.
  const fillers =
    (SEARCH_PANEL_COLUMNS - (items.length % SEARCH_PANEL_COLUMNS)) % SEARCH_PANEL_COLUMNS;

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <GridPosterCard
          key={`${item.resultType || item.mediaType}-${item.tmdbId}`}
          item={item}
          colors={colors}
          typography={typography}
          radii={radii}
          showCaption={false}
          yearBadge={yearBadgeFor(item, collisions)}
          posterSize="w342"
          style={styles.cell}
          posterStyle={styles.cellPoster}
          onPress={() => onSelect && onSelect(item)}
        />
      ))}
      {Array.from({ length: fillers }, (_, i) => (
        <View key={`filler-${i}`} style={styles.cell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingBottom: scale(12),
    paddingHorizontal: SEARCH_PANEL_PAD,
  },
  cell: {
    width: SEARCH_PANEL_COL_W,
  },
  cellPoster: {
    height: SEARCH_PANEL_POSTER_H,
    width: SEARCH_PANEL_COL_W,
  },
});
