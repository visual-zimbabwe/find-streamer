// @ts-check
import { resolveRatingValue } from './ratings.js';

/** @typedef {'rating' | 'year'} RailSortMode */

export const DEFAULT_RAIL_SORT = 'rating';
export const VALID_RAIL_SORTS = Object.freeze(['rating', 'year']);

/**
 * Extracts a comparable 4-digit release or award year from a media item.
 *
 * Checks awardYear, year, releaseDate, and firstAirDate in order of specificity.
 * Returns 0 if no valid 4-digit year is found.
 *
 * @param {any} item
 * @returns {number}
 */
export function resolveYearValue(item) {
  if (!item || typeof item !== 'object') return 0;

  if (typeof item.awardYear === 'number' && Number.isFinite(item.awardYear)) {
    return item.awardYear;
  }
  if (typeof item.awardYear === 'string') {
    const match = item.awardYear.match(/\b(19\d\d|20\d\d)\b/);
    if (match) return parseInt(match[1], 10);
  }

  if (typeof item.year === 'number' && Number.isFinite(item.year)) {
    return item.year;
  }
  if (typeof item.year === 'string') {
    const match = item.year.match(/\b(19\d\d|20\d\d)\b/);
    if (match) return parseInt(match[1], 10);
  }

  const dateStr = item.releaseDate || item.firstAirDate;
  if (typeof dateStr === 'string') {
    const match = dateStr.match(/\b(19\d\d|20\d\d)\b/);
    if (match) return parseInt(match[1], 10);
  }

  return 0;
}

/**
 * Sorts a list of media items by TMDB rating or release year.
 *
 * - 'year': Descending by release year (newest first); tie-breaker is rating descending.
 * - 'rating' (default): Descending by rating (highest first); tie-breaker is year descending.
 *
 * Returns a new array; does not mutate input.
 *
 * @param {any[]} items
 * @param {RailSortMode} [sortMode='rating']
 * @returns {any[]}
 */
export function sortRailItems(items, sortMode = 'rating') {
  if (!Array.isArray(items)) return [];
  const copy = [...items];

  if (sortMode === 'year') {
    return copy.sort((a, b) => {
      const yearDiff = resolveYearValue(b) - resolveYearValue(a);
      if (yearDiff !== 0) return yearDiff;
      return resolveRatingValue(b) - resolveRatingValue(a);
    });
  }

  return copy.sort((a, b) => {
    const ratingDiff = resolveRatingValue(b) - resolveRatingValue(a);
    if (ratingDiff !== 0) return ratingDiff;
    return resolveYearValue(b) - resolveYearValue(a);
  });
}

/**
 * Toggles a rail sort mode between 'rating' and 'year'.
 *
 * @param {string | null | undefined} currentMode
 * @returns {RailSortMode}
 */
export function toggleRailSortMode(currentMode) {
  return currentMode === 'year' ? 'rating' : 'year';
}
