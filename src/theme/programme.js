import { Dimensions } from 'react-native';
import { scale, verticalScale } from '../utils/responsive';

export const GOLD_ACCENT = '#D4A853';
export const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';
/** Slightly brighter hairline for marquee chrome (BottomNav top rule). */
export const GOLD_RULE = 'rgba(212, 168, 83, 0.55)';
export const GRID_PAD = scale(22);
export const GRID_GAP = scale(14);
export const GRID_POSTER_ASPECT = 1.5;
export const FADE_MS = 320;
/** Bottom nav shell height + breathing room for scroll content. */
export const SCROLL_BOTTOM_PAD = 112;
/**
 * Detail-screen hero. Shared so the loading skeleton reserves the same band the
 * real hero occupies — it used to hardcode its own `verticalScale(420)`, which
 * nobody noticed because the skeleton was unreachable.
 */
export const HERO_HEIGHT = verticalScale(480);

export function gridColWidth(windowWidth = Dimensions.get('window').width) {
  return (windowWidth - GRID_PAD * 2 - GRID_GAP) / 2;
}

export function gridPosterHeight(colWidth = gridColWidth()) {
  return colWidth * GRID_POSTER_ASPECT;
}

/**
 * Column width for an n-up poster row inside an arbitrary content box — used by
 * the live search panel, which is 3-up inside a card that has its own padding
 * rather than 2-up against the screen edges.
 *
 * Floored, and that is load-bearing. `scale()` makes the pads and the gap
 * fractional, so an exact division gives columns whose widths sum to precisely
 * the available width; Yoga then rounds each one out to a whole physical pixel,
 * the row overflows by a fraction of a pixel, and the last column wraps. On the
 * A54 that turned this 3-up grid into a 2-up one with a column of dead space.
 * Flooring buys a few points of slack and costs nothing visible.
 */
export function columnWidth(availableWidth, columns, gap = GRID_GAP) {
  return Math.floor((availableWidth - gap * (columns - 1)) / columns);
}

const WINDOW_W = Dimensions.get('window').width;
/** Shared 2-col poster grid width — single source for rails, grids, and skeletons. */
export const GRID_COL_W = gridColWidth(WINDOW_W);
export const GRID_POSTER_H = gridPosterHeight(GRID_COL_W);

/**
 * Home spotlight: a full-bleed 2:3 portrait poster (title lettered into the art
 * by TMDb, same as the rails). Shared with the loading skeleton so the hero band
 * it reserves is exactly the height the poster lands at — no jump on swap.
 */
export const SPOTLIGHT_POSTER_W = WINDOW_W - GRID_PAD * 2;
export const SPOTLIGHT_POSTER_H = Math.round(SPOTLIGHT_POSTER_W * GRID_POSTER_ASPECT);

/**
 * The live search panel's 3-up poster grid. Shared with the loading skeleton so
 * the placeholder reserves exactly the band the real posters land in.
 */
export const SEARCH_PANEL_COLUMNS = 3;
export const SEARCH_PANEL_PAD = scale(16);
export const SEARCH_PANEL_COL_W = columnWidth(
  WINDOW_W - GRID_PAD * 2 - SEARCH_PANEL_PAD * 2,
  SEARCH_PANEL_COLUMNS,
);
export const SEARCH_PANEL_POSTER_H = SEARCH_PANEL_COL_W * GRID_POSTER_ASPECT;

/** Split items into rows for a 2-column poster grid. */
export function buildGridRows(items, columns = 2) {
  if (!items?.length) return [];
  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}
