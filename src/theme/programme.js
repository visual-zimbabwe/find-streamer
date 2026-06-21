import { Dimensions } from 'react-native';
import { scale } from '../utils/responsive';

export const GOLD_ACCENT = '#D4A853';
export const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';
export const GRID_PAD = scale(22);
export const GRID_GAP = scale(14);
export const FADE_MS = 320;
/** Bottom nav shell height + breathing room for scroll content. */
export const SCROLL_BOTTOM_PAD = 112;

export function gridColWidth(windowWidth = Dimensions.get('window').width) {
  return (windowWidth - GRID_PAD * 2 - GRID_GAP) / 2;
}
