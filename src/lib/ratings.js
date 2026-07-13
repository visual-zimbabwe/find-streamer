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
 * @param {{ ratingValue?: number, rating?: string }} item
 * @returns {number}
 */
export function resolveRatingValue(item) {
  if (item?.ratingValue > 0) return item.ratingValue;
  const raw = item?.rating;
  if (raw == null || raw === '' || raw === 'N/A') return 0;
  const n = parseFloat(String(raw).split('/')[0]);
  return Number.isFinite(n) ? n : 0;
}
