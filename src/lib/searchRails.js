// ─── Search idle-state rails ──────────────────────────────────────────────────
//
// Ordering and selection for the two discovery rails on the Search screen. Kept
// pure and network-free so the ordering rules — the part that was actually
// wrong — are testable without a fetch.

import {
  MAJOR_THEATRICAL_DISTRIBUTOR_REGEX,
  STREAMING_ONLY_DISTRIBUTOR_REGEX,
  VALID_MPA_RATINGS,
} from './wikidataTheatrical.js';

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
 * Fallback vote threshold for un-enriched items.
 */
export const NOW_PLAYING_MIN_VOTES = 150;

/** Minimum days between US theatrical premiere and digital/streaming release for normal runs. */
export const MIN_THEATRICAL_WINDOW_DAYS = 28;

/** Maximum age in days from today for an active wide theatrical release. */
export const MAX_THEATRICAL_AGE_DAYS = 60;

/** Maximum age in days from today for a movie's primary release date (eliminates re-releases). */
export const MAX_PRIMARY_AGE_DAYS = 90;

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

/** Helper to calculate offset date string in YYYY-MM-DD. */
export function getOffsetDateYmd(baseYmd, offsetDays) {
  const d = new Date(baseYmd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Evaluate whether a candidate title represents a genuine, high-quality
 * normal or long US theatrical release, filtering out streaming originals,
 * short/day-and-date digital drops, catalog re-releases, and unverified micro-releases.
 *
 * @param {object} item               TMDb candidate item
 * @param {object} [tmdbDetail]       Full TMDb movie detail including release_dates and watch/providers
 * @param {object} [wikidataDetail]   Wikidata metadata (distributors, netflixId, appleId, mpaCert, budget, etc.)
 * @param {object} [options]          Tuning thresholds (today, minWindowDays, wideLookbackDays, region)
 * @returns {{
 *   passed: boolean,
 *   reason?: string,
 *   usWideDate?: string,
 *   earliestDigitalDate?: string | null,
 *   windowDays?: number | null,
 *   inExclusiveTheatricalWindow?: boolean,
 *   budget?: number,
 *   revenue?: number,
 *   mpaCert?: string | null,
 * }}
 */
export function evaluateTheatricalCandidate(
  item = {},
  tmdbDetail = {},
  wikidataDetail = {},
  options = {},
) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const wideLookback =
    options.wideLookback ||
    getOffsetDateYmd(today, -(options.wideLookbackDays || MAX_THEATRICAL_AGE_DAYS));
  const primaryLookback =
    options.primaryLookback ||
    getOffsetDateYmd(today, -(options.primaryLookbackDays || MAX_PRIMARY_AGE_DAYS));
  const minWindowDays = options.minWindowDays ?? MIN_THEATRICAL_WINDOW_DAYS;

  // 1. Primary release date must be within primary lookback and not in the future
  const primaryDate = item.releaseDate || item.release_date || tmdbDetail.release_date || '';
  if (primaryDate && (primaryDate < primaryLookback || primaryDate > today)) {
    return { passed: false, reason: 'primary_out_of_window', primaryDate };
  }

  // 2. Extract US release dates
  const region = options.region || NOW_PLAYING_REGION;
  const usReleases =
    (tmdbDetail.release_dates?.results || []).find((r) => r.iso_3166_1 === region)
      ?.release_dates || [];

  const type3Dates = usReleases
    .filter((r) => r.type === 3)
    .map((r) => (r.release_date || '').slice(0, 10))
    .filter(Boolean)
    .sort();

  const usWideDate = type3Dates.find((dt) => dt >= wideLookback && dt <= today) || null;
  if (!usWideDate) {
    return { passed: false, reason: 'no_recent_wide_theatrical' };
  }

  // 3. Exclude if already on US subscription streaming (flatrate)
  const usWp =
    tmdbDetail['watch/providers']?.results?.[region] || tmdbDetail.watchProviders || {};
  const flatrate = (usWp.flatrate || []).map((p) => p.provider_name || p).filter(Boolean);
  if (flatrate.length > 0) {
    return { passed: false, reason: 'on_subscription_streaming', flatrate };
  }

  // 4. Wikidata streaming check
  const wdDistributors = wikidataDetail.distributors || [];
  const prodCompanies = (tmdbDetail.production_companies || []).map((c) => c.name || '');
  const hasMajorTheatricalDist =
    wdDistributors.some((d) => MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test(d)) ||
    prodCompanies.some((c) => MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test(c));

  const hasStreamerOnlyDist =
    wdDistributors.length > 0 &&
    wdDistributors.every((d) => STREAMING_ONLY_DISTRIBUTOR_REGEX.test(d));

  const hasStreamerIdWithoutMajor = Boolean(
    (wikidataDetail.netflixId || wikidataDetail.appleId || wikidataDetail.disneyId) &&
      !hasMajorTheatricalDist,
  );

  if (hasStreamerOnlyDist || hasStreamerIdWithoutMajor) {
    return { passed: false, reason: 'streaming_original' };
  }

  // 5. Short theatrical window check
  const digitalEntries = usReleases.filter((r) => r.type === 4 || r.type === 5);
  const digitalDates = digitalEntries
    .map((r) => (r.release_date || '').slice(0, 10))
    .filter(Boolean)
    .sort();

  const earliestDigitalDate =
    digitalDates.find((dt) => dt >= usWideDate) || digitalDates[0] || null;
  const windowDays =
    usWideDate && earliestDigitalDate
      ? Math.round(
          (new Date(earliestDigitalDate + 'T00:00:00Z') -
            new Date(usWideDate + 'T00:00:00Z')) /
            86400000,
        )
      : null;

  if (windowDays !== null && windowDays < minWindowDays) {
    return { passed: false, reason: 'short_theatrical_window', windowDays };
  }

  // 6. Old festival holdovers on Wikidata
  const currentYear = parseInt(today.slice(0, 4), 10);
  if (wikidataDetail.minPubYear && wikidataDetail.minPubYear < currentYear - 1) {
    return {
      passed: false,
      reason: 'old_festival_holdover',
      minPubYear: wikidataDetail.minPubYear,
    };
  }

  // 7. Scale & legitimacy verification
  const hasUsMpaRating = usReleases.some((r) =>
    VALID_MPA_RATINGS.has(String(r.certification || '').toUpperCase()),
  );
  const budget = Math.max(tmdbDetail.budget || 0, wikidataDetail.budget || 0, item.budget || 0);
  const revenue = Math.max(
    tmdbDetail.revenue || 0,
    wikidataDetail.boxOffice || 0,
    item.revenue || 0,
  );
  const voteCount = item.voteCount ?? item.vote_count ?? tmdbDetail.vote_count ?? 0;

  const isVerifiedTheatrical = Boolean(
    wikidataDetail.mpaCert ||
      hasMajorTheatricalDist ||
      (hasUsMpaRating && (budget >= 2_000_000 || revenue >= 1_000_000 || voteCount >= 50)) ||
      voteCount >= 150,
  );

  if (!isVerifiedTheatrical) {
    return { passed: false, reason: 'unverified_theatrical_scale' };
  }

  // 8. Determine if currently in exclusive theatrical window
  const rent = (usWp.rent || []).map((p) => p.provider_name || p).filter(Boolean);
  const inExclusiveTheatricalWindow = Boolean(
    (!earliestDigitalDate || earliestDigitalDate > today) && rent.length === 0,
  );

  return {
    passed: true,
    usWideDate,
    earliestDigitalDate,
    windowDays,
    inExclusiveTheatricalWindow,
    budget,
    revenue,
    mpaCert: wikidataDetail.mpaCert || null,
  };
}

/**
 * Rank theatrical items: exclusive theatrical window first, then by popularity.
 */
export function rankTheatricalItems(items = [], limit = RAIL_LIMIT) {
  const usable = dedupeRailItems(items);
  return [...usable]
    .sort((a, b) => {
      const aExclusive = Boolean(a.inExclusiveTheatricalWindow);
      const bExclusive = Boolean(b.inExclusiveTheatricalWindow);
      if (aExclusive !== bExclusive) return aExclusive ? -1 : 1;
      return (b.popularity || 0) - (a.popularity || 0);
    })
    .slice(0, limit);
}

/**
 * Order the theatrical rail: drop the long tail of thinly-voted limited
 * releases, then sort by popularity — "what is drawing an audience right now"
 * is the question a Now Playing rail answers, not "what has the highest mean".
 *
 * If items carry theatrical verification flags (inExclusiveTheatricalWindow),
 * uses rankTheatricalItems.
 *
 * If the floor would leave the rail short, it is dropped rather than shipping a
 * three-poster rail; an under-voted rail still beats an empty one.
 */
export function selectNowPlaying(items = [], limit = RAIL_LIMIT, minVotes = NOW_PLAYING_MIN_VOTES) {
  const usable = dedupeRailItems(items);

  if (usable.some((item) => item.inExclusiveTheatricalWindow !== undefined)) {
    return rankTheatricalItems(usable, limit);
  }

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
