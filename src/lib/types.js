// @ts-check
//
// Central JSDoc typedefs for the data shapes that flow through many transforms.
// This file exports nothing at runtime — it exists purely so other modules can
// reference these shapes via `@typedef {import('./types.js').Foo} Foo` and get
// editor/`tsc` checking without renaming files or adding a build step.

/**
 * Media kind used everywhere a title is represented.
 * @typedef {'movie' | 'tv'} MediaType
 */

/**
 * Lifecycle status of a library entry.
 * @typedef {'saved' | 'watching' | 'watched' | 'dropped'} WatchlistStatus
 */

/**
 * A normalized title stored in the user's library. Produced by
 * `normalizeWatchlistItem` and persisted via `storage.js`. Extra fields from
 * the source result (cast, ratings, etc.) may ride along, so this shape is
 * intentionally open-ended.
 *
 * @typedef {Object} WatchlistItem
 * @property {MediaType} mediaType
 * @property {number} tmdbId
 * @property {string} title
 * @property {WatchlistStatus} status
 * @property {string} watchlistCategoryId
 * @property {string} watchlistCategoryLabel
 * @property {string[]} collectionIds
 * @property {number} schemaVersion
 * @property {string} [year]
 * @property {string} [synopsis]
 * @property {string | null} [posterUrl]
 * @property {string | null} [backdropUrl]
 * @property {string} [rating]
 * @property {number} [ratingValue]
 * @property {string} [source]
 * @property {OmdbRatings} [omdbRatings]
 */

/**
 * A user- or system-defined grouping of watchlist items. Produced by
 * `normalizeWatchlistCollections` and the built-in default/legacy definitions.
 *
 * @typedef {Object} WatchlistCollection
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} icon
 * @property {boolean} immutable
 * @property {'default' | 'legacy' | 'custom'} source
 * @property {string} [createdAt]
 */

/**
 * A lightweight search hit for a movie or TV title, as returned by the TMDB
 * search mapping before a full detail resolve.
 *
 * @typedef {Object} SearchResult
 * @property {'media'} resultType
 * @property {MediaType} mediaType
 * @property {number} tmdbId
 * @property {string} title
 * @property {string} year
 * @property {string} synopsis
 * @property {string | null} posterUrl
 * @property {string | null} backdropUrl
 */

/**
 * OMDb rating bundle attached to resolved details and (optionally) stored rows.
 *
 * @typedef {Object} OmdbRatings
 * @property {string} [imdb]
 * @property {string} [rottenTomatoes]
 * @property {string} [metacritic]
 * @property {string} [plot]
 */

/**
 * The fully resolved detail object that backs `ResultView`. It spreads the
 * search `match`, fetched `metadata`, `credits`, and provider data together, so
 * it is a superset of {@link SearchResult} with many optional extras.
 *
 * @typedef {SearchResult & {
 *   query?: string,
 *   rows?: object[],
 *   similar?: object[],
 *   moreFromCastAndCrew?: object[],
 *   providerSummary?: object,
 *   serviceLogos?: ProviderLogoMap,
 *   providerAvailabilityConfidence?: string,
 *   omdbRatings?: OmdbRatings,
 *   imdbId?: string | null,
 * }} ResolvedDetailResult
 */

/**
 * Per-service TMDB logo paths (or null when unknown), keyed by service id.
 * @typedef {Object.<string, string | null>} ProviderLogoMap
 */

/**
 * Per-service streaming availability, keyed by service id (see
 * `SERVICE_LABELS`). Each service maps to a sorted list of ISO country codes
 * where it is available. The companion `logos` map carries the per-service
 * logo path, and `confidence` (when present) reflects show- vs episode-level
 * resolution.
 *
 * @typedef {Object} ProviderAvailability
 * @property {ProviderLogoMap} logos
 * @property {string} [confidence]
 */

export {};
