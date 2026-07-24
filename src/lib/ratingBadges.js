/**
 * Presentation + linking helpers for the hero ratings strip on the detail view.
 *
 * Pulled out of ResultView so the slug and threshold logic is unit-testable —
 * and so the four badges stop misrepresenting the score: a hardcoded fresh
 * tomato, a permanently-green Metascore box, and two "sources" that linked to a
 * search form instead of the title's own page.
 */

/** Parse the leading number from a score string ("8.1/10", "91%", "74"). */
export function parseScore(value) {
  if (value == null) return null;
  const n = parseFloat(String(value).split('/')[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Rotten Tomatoes' brand binary: >= 60% is Fresh (red tomato), below is Rotten
 * (the green splat). A hardcoded tomato shows "Fresh" on films the score calls
 * rotten, which is the opposite of what the number says.
 */
export function rottenTomatoesFresh(percentValue) {
  const n = parseScore(percentValue);
  // No parseable score -> keep the neutral tomato rather than assert "rotten".
  return n == null ? true : n >= 60;
}

export function rottenTomatoesEmoji(percentValue) {
  return rottenTomatoesFresh(percentValue) ? '🍅' : '🤢';
}

/**
 * Metacritic's score-box color carries as much meaning as the number: green
 * >= 61, yellow 40-60, red <= 39. Users read the color before the digits, so a
 * green box on a 31 reads as "good" no matter what the number says.
 * Yellow takes dark text; green and red take white.
 */
export function metacriticBadge(metascore) {
  const n = parseScore(metascore);
  if (n == null || n >= 61) return { bg: '#66CC33', fg: '#ffffff' };
  if (n >= 40) return { bg: '#FFCC33', fg: '#141414' };
  return { bg: '#FF6874', fg: '#ffffff' };
}

/** Lowercase, strip diacritics/punctuation, join words with `separator`. */
function slugify(title, separator) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, separator);
}

/**
 * Best-effort deterministic deep link to the title's own page. Neither site is
 * keyed by our imdb/tmdb id, so a clean title slug is all we have offline -- RT
 * slugs with underscores (/m/the_batman), Metacritic with hyphens
 * (/movie/the-batman). This is strictly better than the old always-search
 * behavior, which dumped every tap on a results page.
 *
 * Known limit: remakes the sites disambiguate with a year suffix (/m/it_2017)
 * can still miss. The site's own "not found" page is the floor; a bare title
 * with no slug falls back to search, the only genuinely non-derivable case.
 */
export function rottenTomatoesUrl({ title, mediaType }) {
  const slug = slugify(title, '_');
  if (!slug) {
    return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title || '')}`;
  }
  const kind = mediaType === 'tv' ? 'tv' : 'm';
  return `https://www.rottentomatoes.com/${kind}/${slug}`;
}

export function metacriticUrl({ title, mediaType }) {
  const slug = slugify(title, '-');
  if (!slug) {
    return `https://www.metacritic.com/search/all/${encodeURIComponent(title || '')}/results`;
  }
  const kind = mediaType === 'tv' ? 'tv' : 'movie';
  return `https://www.metacritic.com/${kind}/${slug}`;
}
