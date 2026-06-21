import { Dimensions } from 'react-native';
import { scale } from '../utils/responsive';

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

export function gridColWidth(windowWidth = Dimensions.get('window').width) {
  return (windowWidth - GRID_PAD * 2 - GRID_GAP) / 2;
}

export function gridPosterHeight(colWidth = gridColWidth()) {
  return colWidth * GRID_POSTER_ASPECT;
}

const WINDOW_W = Dimensions.get('window').width;
/** Shared 2-col poster grid width — single source for rails, grids, and skeletons. */
export const GRID_COL_W = gridColWidth(WINDOW_W);
export const GRID_POSTER_H = gridPosterHeight(GRID_COL_W);

/** Split items into rows for a 2-column poster grid. */
export function buildGridRows(items, columns = 2) {
  if (!items?.length) return [];
  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}
