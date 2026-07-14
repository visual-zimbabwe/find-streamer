/**
 * Resolve a comparable numeric rating for a media item.
 *
 * Items can carry a numeric `ratingValue` (e.g. TMDB vote_average) and/or a
 * display `rating` string (e.g. "7.8/10"). These can diverge: an item may have
 * a `rating` string but a missing/zero `ratingValue`. The poster badge falls
 * back to parsing the string, so sorting must use the same fallback or the
 * on-screen order won't match the visible ratings.
 *
 * Prefers `ratingValue` when > 0, otherwise parses the leading number from the
 * `rating` string. Returns 0 when neither yields a finite value.
 *
 * The `rating` strings produced in-app are always on a `/10` scale (TMDB
 * `vote_average` formatted as "8.8/10"). As a defensive guard against a
 * percentage-scaled string (e.g. a Rotten Tomatoes "90%") ever reaching this
 * path, a trailing `%` is detected and rescaled from /100 to /10 so it can't
 * sort above every /10-rated title.
 *
 * @param {{ ratingValue?: number, rating?: string }} item
 * @returns {number}
 */
export function resolveRatingValue(item) {
  if (item?.ratingValue > 0) return item.ratingValue;
  const raw = item?.rating;
  if (raw == null || raw === '' || raw === 'N/A') return 0;
  const str = String(raw);
  const n = parseFloat(str.split('/')[0]);
  if (!Number.isFinite(n)) return 0;
  // Rescale a percentage (0–100) value onto the /10 scale used everywhere else.
  return str.includes('%') ? n / 10 : n;
}
