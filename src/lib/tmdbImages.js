// @ts-check

/**
 * Re-point a TMDb image URL at a different rendition.
 *
 * Every mapper in `tmdb.js` bakes `w500` into `posterUrl` because that is the
 * right size for the 2-column grid. It is the wrong size everywhere else: the
 * live search grid draws the same poster at roughly a third of the width, and
 * the Top Match card draws it at nearly double. Rewriting the path costs
 * nothing and keeps a single poster field on the model.
 *
 * Anything that isn't a TMDb image path is returned untouched, so callers can
 * pass through Wikidata/Commons art and local fallbacks without checking first.
 *
 * @param {string | null | undefined} url
 * @param {'w185'|'w342'|'w500'|'w780'|'original'} size
 * @returns {string | null}
 */
export function tmdbImageAtSize(url, size) {
  if (!url) return null;
  return url.replace(/(https:\/\/image\.tmdb\.org\/t\/p\/)(w\d+|original)(\/)/, `$1${size}$3`);
}
