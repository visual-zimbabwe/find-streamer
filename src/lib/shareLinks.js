/**
 * Single source of truth for the URLs Trova puts *into the world* — the QR code
 * on the share card and the deep link the app answers to.
 *
 * The share card's QR used to encode `trova://…`, which nothing could open: a
 * recipient without Trova got a dead scan, and a recipient with it got an app
 * that ignored the path. Until Trova has a web presence, the scannable payload
 * is the TMDb title page — it resolves in any browser, for anyone, and shows
 * the right title. Swap `buildTitleWebUrl` when a Trova domain exists; nothing
 * else needs to change.
 */

const MEDIA_PATH = { tv: 'tv', movie: 'movie' };

function mediaSegment(mediaType) {
  return MEDIA_PATH[mediaType] || MEDIA_PATH.movie;
}

/**
 * The URL encoded in the share card's QR. Must stay under QR_MAX_BYTES —
 * `https://www.themoviedb.org/movie/1234567` is 40 bytes against a 53 budget.
 */
export function buildTitleWebUrl(result) {
  if (!result?.tmdbId) return null;
  return `https://www.themoviedb.org/${mediaSegment(result.mediaType)}/${result.tmdbId}`;
}

/** The in-app deep link. Handled by useDeepLink(). */
export function buildTitleDeepLink(result) {
  if (!result?.tmdbId) return null;
  return `trova://title/${mediaSegment(result.mediaType)}/${result.tmdbId}`;
}

/**
 * Parse an inbound URL into the title it refers to. Accepts Trova's own scheme
 * and TMDb title URLs (so an Android App Link can be added later without
 * touching the handler).
 *
 * @returns {{ mediaType: 'movie' | 'tv', tmdbId: string } | null}
 */
export function parseTitleUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const trova = url.match(/^trova:\/\/(?:\/)?title\/(movie|tv)\/(\d+)/i);
  if (trova) {
    return { mediaType: trova[1].toLowerCase(), tmdbId: trova[2] };
  }

  const tmdb = url.match(/^https?:\/\/(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)/i);
  if (tmdb) {
    return { mediaType: tmdb[1].toLowerCase(), tmdbId: tmdb[2] };
  }

  return null;
}
