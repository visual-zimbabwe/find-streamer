/**
 * The Detail screen used to be pushed only once `resolveMatch` had finished all
 * five of its serial legs — measured at 648ms of completely unmarked dead time
 * on the tapped list, 402ms median for the network alone. The screen now opens
 * on the tap and fills in, which means it has to render from the row the user
 * tapped before the real payload exists.
 *
 * `seedDetailResult` builds that stand-in. It is deliberately *shape-complete*:
 * every field `resolveMatch` eventually returns is present with an empty value,
 * so ResultView's existing "nothing to show → render nothing" guards do the work
 * and no section has to learn about a half-built object. The one exception is
 * `rows`, which is left null rather than `[]` — `hasAvailabilityData` keys off
 * `Array.isArray(rows)`, and an empty array would render "Not free to stream
 * anywhere right now", a wrong answer, for the length of the fetch.
 */

/** Fields a search / discover / rail row already carries into the tap. */
const CARRIED_FROM_MATCH = [
  'mediaType',
  'tmdbId',
  'title',
  'year',
  'synopsis',
  'posterUrl',
  'backdropUrl',
  'ratingValue',
  'releaseDate',
];

/**
 * TMDb's own score, formatted the way `getTitleMetadata` formats it, so the
 * TMDb badge in the hero is readable at first paint instead of one network
 * round trip later. Every row the app can open carries `ratingValue`.
 */
function seedRating(ratingValue) {
  return typeof ratingValue === 'number' && ratingValue > 0
    ? `${ratingValue.toFixed(1)}/10`
    : 'N/A';
}

/**
 * A shape-complete stand-in for `resolveMatch`'s payload, built from the list
 * row that was tapped.
 *
 * @param {string} query the search query that surfaced this match, or its title
 * @param {object} match the row object (mediaType/tmdbId/title/poster/…)
 * @returns {object} a result object safe to render a Detail screen from
 */
export function seedDetailResult(query, match) {
  const carried = {};
  CARRIED_FROM_MATCH.forEach((key) => {
    if (match?.[key] !== undefined) carried[key] = match[key];
  });

  return {
    query,
    ...carried,
    // Marks the object as provisional for anything that needs to know without
    // being handed the screen's `loading` flag (share capture, watchlist sync).
    isSeed: true,

    // ── getTitleMetadata ──
    genres: 'N/A',
    rating: seedRating(match?.ratingValue),
    runtimeMinutes: null,
    imdbId: null,
    collectionSeed: null,
    numberOfSeasons: null,
    numberOfEpisodes: null,
    seriesStatus: null,
    nextEpisodeAirDate: null,
    createdBy: null,
    createdByPersons: [],
    seasons: [],
    hasAdaptationKeyword: false,
    titleLogo: null,
    heroBackdropUrl: null,
    trailer: 'N/A',
    trailerType: null,
    trailerCandidates: [],
    productionCompanies: [],

    // ── getCredits ──
    hasSourceCredit: false,
    director: 'N/A',
    directorId: null,
    directorPersons: [],
    writer: 'N/A',
    writerPersons: [],
    composerPersons: [],
    starring: 'N/A',
    starringPersons: [],
    castPersons: [],

    // ── availability ──
    // null, NOT [] — see the note at the top of this file.
    rows: null,
    providerSummary: [],
    serviceLogos: {},
    providerAvailabilityConfidence: 'show',

    isAdaptation: false,
    omdbRatings: null,
  };
}

/** True while a Detail screen is rendering the tapped row rather than real data. */
export function isSeedResult(result) {
  return Boolean(result?.isSeed);
}

/**
 * Bound the open. Each leg of `resolveMatch` allows a 12s timeout and two
 * retries, so five legs can in principle keep a user on a half-built screen for
 * minutes. This caps the whole operation instead of tightening the shared fetch
 * policy, which other callers depend on.
 */
export const DETAIL_RESOLVE_DEADLINE_MS = 20000;

/**
 * Ignore-window for a second open request. Two touch events dispatched in the
 * same frame used to push two Detail screens — measured on device with taps
 * 250ms apart on different posters, which pushed two screens both showing the
 * later title and silently discarded the first choice.
 *
 * 500ms comfortably covers a double-tap (typically under 300ms) while leaving
 * room for a deliberate second navigation: the Detail screen is pushed on the
 * tap now, so a user really can tap a rail card on the new screen quickly.
 */
export const OPEN_DETAIL_DEBOUNCE_MS = 500;
