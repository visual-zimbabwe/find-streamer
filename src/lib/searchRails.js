// ─── Search idle-state rails ──────────────────────────────────────────────────
//
// Ordering and selection for the two discovery rails on the Search screen. Kept
// pure and network-free so the ordering rules — the part that was actually
// wrong — are testable without a fetch.

/** Items shown in a rail. */
export const RAIL_LIMIT = 10;

/** Items shown on the "See all" screen behind a rail. */
export const RAIL_FULL_LIMIT = 40;

/**
 * Theatrical listings are US-only by product decision — the rail answers "what
 * can I go see", and the only theatres that question is being asked about are
 * American ones. TMDb's release data has no finer granularity than the country,
 * so the header says "US" and not a city.
 */
export const NOW_PLAYING_REGION = 'US';

/**
 * TMDb's now-playing window is full of one-screen limited releases carrying a
 * 9.0 off fourteen votes. Without a floor those outrank the wide release the
 * user is actually asking about.
 */
export const NOW_PLAYING_MIN_VOTES = 150;

function railKey(item) {
  return `${item.mediaType || 'movie'}:${item.tmdbId}`;
}

/** Drop repeats and anything without a TMDb id, preserving order. */
export function dedupeRailItems(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item?.tmdbId) continue;
    const key = railKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Zip Trakt's movie and show lists together by their own rank — movie #1, show
 * #1, movie #2, show #2 …
 *
 * The rail used to concatenate the two and re-sort the whole thing by TMDb
 * rating, which both broke the promise in the header and, because TMDb rates
 * prestige TV above wide-release film as a matter of course, quietly turned a
 * mixed rail into a mostly-TV one. Interleaving keeps the blend deliberate and
 * keeps Trakt's ordering intact, which is the only reason to call Trakt at all.
 */
export function interleaveByTrendingRank(movies = [], shows = []) {
  const byRank = (list) =>
    [...list].sort(
      (a, b) =>
        (a?.trendingRank ?? Number.MAX_SAFE_INTEGER) - (b?.trendingRank ?? Number.MAX_SAFE_INTEGER),
    );

  const rankedMovies = byRank(movies);
  const rankedShows = byRank(shows);
  const out = [];

  for (let i = 0; i < Math.max(rankedMovies.length, rankedShows.length); i += 1) {
    if (rankedMovies[i]) out.push(rankedMovies[i]);
    if (rankedShows[i]) out.push(rankedShows[i]);
  }

  return out;
}

/**
 * Interleave two popularity-ranked lists — the fallback ordering when Trakt is
 * down and the rail is served from TMDb popularity instead, which carries no
 * `trendingRank`. Same movie-then-show cadence as {@link interleaveByTrendingRank}
 * so the rail reads the same whichever source filled it.
 *
 * TMDb already returns each list in `popularity.desc` order, so when the items
 * carry no `popularity` field the stable sort is a no-op that preserves that
 * order; the explicit sort only matters if a caller passes the field through.
 */
export function interleaveByPopularity(movies = [], shows = []) {
  const byPop = (list) => [...list].sort((a, b) => (b?.popularity || 0) - (a?.popularity || 0));

  const rankedMovies = byPop(movies);
  const rankedShows = byPop(shows);
  const out = [];

  for (let i = 0; i < Math.max(rankedMovies.length, rankedShows.length); i += 1) {
    if (rankedMovies[i]) out.push(rankedMovies[i]);
    if (rankedShows[i]) out.push(rankedShows[i]);
  }

  return out;
}

/**
 * Order the theatrical rail: drop the long tail of thinly-voted limited
 * releases, then sort by popularity — "what is drawing an audience right now"
 * is the question a Now Playing rail answers, not "what has the highest mean".
 *
 * If the floor would leave the rail short, it is dropped rather than shipping a
 * three-poster rail; an under-voted rail still beats an empty one.
 */
export function selectNowPlaying(items = [], limit = RAIL_LIMIT, minVotes = NOW_PLAYING_MIN_VOTES) {
  const usable = dedupeRailItems(items);
  const meetsFloor = usable.filter((item) => (item.voteCount || 0) >= minVotes);
  const pool = meetsFloor.length >= limit ? meetsFloor : usable;

  return [...pool].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, limit);
}

/**
 * Trakt's live watcher count, short enough for a badge on artwork.
 * Returns null when there is nothing worth showing.
 */
export function formatWatchers(count) {
  const value = Number(count) || 0;
  if (value <= 0) return null;
  if (value < 1000) return `${value} watching`;

  const thousands = value / 1000;
  const rendered =
    thousands >= 10 ? String(Math.round(thousands)) : thousands.toFixed(1).replace(/\.0$/, '');
  return `${rendered}k watching`;
}
