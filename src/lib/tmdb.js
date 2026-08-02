import { recordRateQuota429, recordRateQuotaFromResponse } from './apiRateQuota';
import { fetchOmdbRatings } from './omdb';
import { NON_ENGLISH_CODES } from './languagePresets';
import {
  SMART_FILTER_KEYS,
  smartFilterKeywordIds,
  smartFilterLanguageCodes,
  isExcludedBySmartFilters,
} from './smartFilters';
import { createAppError, isRetryableStatus, retryWithBackoff } from './errors';
import { rankTrailerCandidates } from './trailerPicker';
import { hasAdaptationKeyword, hasSourceMaterialCredit } from './basedOn';
import {
  SEARCH_PANEL_MAX_ROWS,
  SEARCH_RESULTS_MAX,
  isRankablePersonDepartment,
  rankSearchCandidates,
} from './searchRanker';
import {
  ABSOLUTE_MIN_RAIL_VOTES,
  MIN_RAIL_VOTES,
  RAIL_SIZE,
  creditsForPerson,
  rankCompanyCatalog,
  rankPeopleTitles,
  rankSimilarTitles,
  selectRailPeople,
} from './railPicker';
import {
  SERVICE_LABELS,
  availabilityBySeason,
  availabilityFromResults,
  emptyServiceMap,
  intersectSeasonAvailability,
  serviceKey,
} from './providerAvailability';

export { SERVICE_LABELS };

const TMDB_BASE = 'https://api.themoviedb.org/3';
const HARDCODED_BEARER_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZWNkNDE1YWJhY2VmMzYxM2I5NDc1MWQ5OWRhODU2YSIsIm5iZiI6MTc3MTgwMDUzOS45ODU5OTk4LCJzdWIiOiI2OTliODdkYmYwMTE1NmYxNDljNWE1MTgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.oXCB5rLBXE6TwtgHGup4lEEX-dI0uTXGUVP8PQesics';
const TMDB_REQUEST_TIMEOUT_MS = 12000;
const TV_EPISODE_PROVIDER_LOOKUP_ENABLED =
  process.env.EXPO_PUBLIC_TMDB_TV_EPISODE_LOOKUP === 'true';
const TV_EPISODE_PROVIDER_MAX_EPISODES = Number(
  process.env.EXPO_PUBLIC_TMDB_TV_EPISODE_MAX_EPISODES || 60,
);

async function mapWithConcurrency(items, limit, task) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function createTimeoutSignal(timeoutMs) {
  if (typeof AbortController === 'undefined') return {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

class ConcurrencyLimiter {
  constructor(limit) {
    this.limit = limit;
    this.activeCount = 0;
    this.queue = [];
  }

  async run(task) {
    if (this.activeCount >= this.limit) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.activeCount += 1;
    try {
      return await task();
    } finally {
      this.activeCount -= 1;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
}

const tmdbLimiter = new ConcurrencyLimiter(3);
const _tmdbPromiseCache = new Map();
/**
 * The cache used to evict only on failure, so every successful response was
 * retained for the life of the process. Search-as-you-type made that expensive:
 * with no minimum query length, one request fires per typing pause, and prefix
 * responses are the fattest ones we ask for (median 12.1KB measured over 701
 * live prefixes). Typing a title held one of those per prefix, forever.
 *
 * Evicting an entry can at worst cost a duplicate request — the map is a
 * dedupe/short-circuit, never a correctness guarantee — so plain insertion-order
 * eviction is safe. Map preserves insertion order, so the first key is oldest.
 */
const TMDB_PROMISE_CACHE_MAX = 200;

function rememberTmdbPromise(cacheKey, promise) {
  _tmdbPromiseCache.set(cacheKey, promise);
  while (_tmdbPromiseCache.size > TMDB_PROMISE_CACHE_MAX) {
    const oldestKey = _tmdbPromiseCache.keys().next().value;
    if (oldestKey === undefined || oldestKey === cacheKey) break;
    _tmdbPromiseCache.delete(oldestKey);
  }
}

async function tmdbGet(pathname, params = {}) {
  // Sort parameters to ensure consistent cache keys
  const sortedParams = {};
  Object.keys(params)
    .sort()
    .forEach((key) => {
      sortedParams[key] = params[key];
    });

  const cacheKey = JSON.stringify({ pathname, params: sortedParams });

  if (_tmdbPromiseCache.has(cacheKey)) {
    return _tmdbPromiseCache.get(cacheKey);
  }

  const promise = (async () => {
    return retryWithBackoff(
      async () => {
        return tmdbLimiter.run(async () => {
          const url = new URL(`${TMDB_BASE}${pathname}`);
          Object.entries(sortedParams).forEach(([key, value]) =>
            url.searchParams.set(key, String(value)),
          );

          const timeout = createTimeoutSignal(TMDB_REQUEST_TIMEOUT_MS);
          let response;
          try {
            response = await fetch(url.toString(), {
              headers: {
                accept: 'application/json',
                Authorization: `Bearer ${HARDCODED_BEARER_TOKEN}`,
              },
              signal: timeout.signal,
            });
          } catch (error) {
            console.error('[tmdbGet] fetch error for pathname:', pathname, 'error:', error);
            if (error?.name === 'AbortError') {
              throw createAppError('Please check your connection and try again.', 'TIMEOUT', {
                originalError: error,
              });
            }
            throw createAppError('Please check your connection and try again.', 'OFFLINE', {
              originalError: error,
            });
          } finally {
            timeout.clear?.();
          }

          if (!response.ok) {
            const status = response.status;
            if (status === 429) {
              recordRateQuota429('tmdb', response);
            }
            let message = '';
            try {
              message = await response.text();
            } catch {
              message = '';
            }

            if (status === 429) {
              throw createAppError(
                'Our movie database is busy right now. Give it a moment and refresh.',
                'RATE_LIMITED',
                { status },
              );
            }
            if (status >= 500) {
              throw createAppError(
                'Our movie database is taking a quick coffee break. Please try again in a moment.',
                'SERVICE_UNAVAILABLE',
                { status },
              );
            }
            throw createAppError(
              'Something went wrong while loading movie data. Please try again.',
              'TMDB_ERROR',
              { status, rawMessage: message },
            );
          }

          recordRateQuotaFromResponse('tmdb', response);
          return response.json();
        });
      },
      {
        retries: 2,
        shouldRetry: (error) =>
          error?.code === 'OFFLINE' ||
          error?.code === 'TIMEOUT' ||
          isRetryableStatus(error?.status),
      },
    );
  })();

  rememberTmdbPromise(cacheKey, promise);

  // If the request fails, remove it from the cache to allow future retries
  promise.catch(() => {
    _tmdbPromiseCache.delete(cacheKey);
  });

  return promise;
}

/**
 * Map a raw `/search/multi` payload into the app's candidate shape, keeping
 * titles and eligible people together. Shared by both search paths so they can
 * no longer disagree about what the same request means.
 */
function mapSearchPayload(data) {
  return (data.results || [])
    .map((item) => {
      if (item.media_type === 'person') return mapSearchPersonItem(item);
      if (item.media_type === 'movie' || item.media_type === 'tv') return mapSearchMediaItem(item);
      return null;
    })
    .filter(Boolean);
}

/**
 * The submitted search.
 *
 * This used to short-circuit the entire query when TMDb's #1 result happened to
 * be a person with any `known_for_department` at all, pushing a filmography and
 * discarding what was typed. Measured over 701 live prefixes it fired on 43 of
 * them (6.1%, and 23% at two characters) on names like "Av (Production)" and
 * "Happy The Sparrow" — and 19 of those were people the live panel already
 * refused to display. People are now rows in the result list, the way the panel
 * has always treated them, so a person can be the best answer without being the
 * only answer.
 */
export async function searchTitleCandidates(query) {
  const data = await tmdbGet('/search/multi', {
    query,
    include_adult: false,
    language: 'en-US',
    page: 1,
  });

  const candidates = mapSearchPayload(data);
  if (!candidates.length) {
    throw createAppError(`We couldn't find any matches for "${query}".`, 'NO_RESULTS', { query });
  }

  return rankSearchCandidates(candidates, query).slice(0, SEARCH_RESULTS_MAX);
}

function personRoleForDepartment(department) {
  return department === 'Directing' ? 'movie' : 'cast';
}

function personLabelForDepartment(department) {
  return department === 'Directing' ? 'Director' : 'Actor';
}

function knownForSummary(knownFor = []) {
  return knownFor
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map((item) => item.title || item.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
}

function mapSearchMediaItem(item) {
  const dateValue = item.release_date || item.first_air_date || '';
  return {
    resultType: 'media',
    mediaType: item.media_type,
    tmdbId: item.id,
    title: item.title || item.name || '(Untitled)',
    year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
    synopsis: (item.overview || '').trim() || 'No synopsis available.',
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdropUrl: item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : null,
    // `/search/multi` already returns `vote_average`; nothing used to read it,
    // so every search result reached the poster grid with no rating and drew no
    // star badge — while the Recent and Trending rails beside it drew one. Free
    // to carry, and the badge is the only metadata the artwork can't express.
    ratingValue: item.vote_average || 0,
    rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    // Carried so `rankSearchCandidates` can order titles and people in one pool
    // without re-reading the raw payload.
    popularity: item.popularity || 0,
    // ISO 639-1 original language (see discoverTitles) — so saving a search
    // result also feeds the personalized language Quick Picks. Omitted when absent.
    ...(item.original_language
      ? { originalLanguageCode: String(item.original_language).toLowerCase() }
      : {}),
  };
}

function mapSearchPersonItem(item) {
  if (!isRankablePersonDepartment(item.known_for_department)) {
    return null;
  }

  return {
    resultType: 'person',
    personId: item.id,
    tmdbId: item.id,
    personName: item.name || '(Unnamed person)',
    title: item.name || '(Unnamed person)',
    role: personRoleForDepartment(item.known_for_department),
    departmentLabel: personLabelForDepartment(item.known_for_department),
    knownFor: knownForSummary(item.known_for),
    profileUrl: item.profile_path ? `https://image.tmdb.org/t/p/w185${item.profile_path}` : null,
    popularity: item.popularity || 0,
  };
}

function releaseDateValue(item = {}) {
  return item.release_date || item.first_air_date || '';
}

function sortCollectionParts(parts = []) {
  return [...parts].sort((a, b) => {
    const aDate = releaseDateValue(a);
    const bDate = releaseDateValue(b);
    if (!aDate && !bDate) return (a.title || '').localeCompare(b.title || '');
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.localeCompare(bDate);
  });
}

function mapCollectionPart(item) {
  const dateValue = releaseDateValue(item);
  return {
    mediaType: 'movie',
    tmdbId: item.id,
    title: item.title || item.name || '(Untitled)',
    year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
    synopsis: (item.overview || '').trim() || 'No synopsis available.',
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdropUrl: item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : null,
    ratingValue: item.vote_average || 0,
    rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    releaseDate: dateValue || null,
  };
}

/**
 * The cheap half of the franchise feature: the id, name and art that
 * `/movie/{id}` already carries in `belongs_to_collection`. Costs no request, so
 * it rides along with the rest of the metadata and lets the detail screen draw
 * the section header — with the real collection name — at first paint while the
 * parts are still in flight.
 */
function mapCollectionSeed(belongsToCollection) {
  if (!belongsToCollection?.id) return null;
  return {
    id: belongsToCollection.id,
    name: belongsToCollection.name || null,
    posterUrl: belongsToCollection.poster_path
      ? `https://image.tmdb.org/t/p/w500${belongsToCollection.poster_path}`
      : null,
    backdropUrl: belongsToCollection.backdrop_path
      ? `https://image.tmdb.org/t/p/original${belongsToCollection.backdrop_path}`
      : null,
  };
}

/**
 * The expensive half: `/collection/{id}` for the actual parts. Deliberately NOT
 * called from `getTitleMetadata` — see `fetchTitleCollection`.
 *
 * @param {{ id: number, name?: string|null, posterUrl?: string|null, backdropUrl?: string|null }} seed
 */
async function getMovieCollectionInfo(seed, tmdbId) {
  if (!seed?.id) {
    return { isFranchise: false, collection: null };
  }

  const data = await tmdbGet(`/collection/${seed.id}`, { language: 'en-US' });
  const parts = sortCollectionParts(data.parts || [])
    .filter((item) => item?.id)
    .map(mapCollectionPart);
  const relatedParts = parts.filter((item) => item.tmdbId !== tmdbId);

  const collection = {
    id: data.id || seed.id,
    name: data.name || seed.name || null,
    overview: data.overview || null,
    posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : seed.posterUrl || null,
    backdropUrl: data.backdrop_path
      ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
      : seed.backdropUrl || null,
    parts,
  };

  // A "collection" holding only this film is not a franchise worth a section.
  return { isFranchise: relatedParts.length > 0, collection };
}

/**
 * Post-paint franchise fetch.
 *
 * This used to be a bare `await` inside `getTitleMetadata`, which put a measured
 * median 97ms / p90 114ms in front of `getProviderCountries` on 32% of movie
 * detail screens — i.e. in front of the availability answer the app exists to
 * give — for a section that sits fifth down the scroll. Same reasoning (and the
 * same fix) as `fetchTitleRails`. Note that `resolveMatch` is sequential on
 * purpose, so the fix is to defer this call, never to fold it into a
 * `Promise.all` alongside the others.
 */
export async function fetchTitleCollection(result) {
  const seed = result?.collectionSeed;
  if (!seed?.id || !result?.tmdbId) return { isFranchise: false, collection: null };
  return getMovieCollectionInfo(seed, result.tmdbId);
}

/**
 * Search-as-you-type.
 *
 * Note the order: rank the whole payload, *then* cut to the visible rows. TMDb
 * returns 20 and the panel shows a handful; ranking after the slice would throw
 * away the part of the win that comes from pulling the intended title up into
 * the visible rows at all (measured: 77.2% -> 79.0% reachable).
 */
export async function searchLiveCandidates(query) {
  const data = await tmdbGet('/search/multi', {
    query,
    include_adult: false,
    language: 'en-US',
    page: 1,
  });

  return rankSearchCandidates(mapSearchPayload(data), query).slice(0, SEARCH_PANEL_MAX_ROWS);
}

export async function searchPersonByName(name) {
  const data = await tmdbGet('/search/person', {
    query: name,
    include_adult: false,
    language: 'en-US',
    page: 1,
  });
  return data.results?.[0] || null;
}

async function getTitleMetadata(mediaType, tmdbId) {
  // For TV shows, /tv/{id} does NOT include imdb_id — we need external_ids.
  const [data, externalIds] = await Promise.all([
    tmdbGet(`/${mediaType}/${tmdbId}`, {
      language: 'en-US',
      // `keywords` costs no extra round trip and answers "is this an adaptation?"
      // at first paint — the Based On section needs that before Wikidata replies
      // so it doesn't reserve space on every original screenplay and then vanish.
      append_to_response: 'videos,images,keywords',
      // `null` = language-neutral logos (no lettering baked in); `en` = English title treatments.
      include_image_language: 'en,null',
      // Same treatment for videos, which `language=en-US` alone filters down hard
      // (Attack on Titan: 18 videos → 4). The original-language sweep happens below,
      // once the response tells us what that language actually is.
      include_video_language: 'en,null',
    }),
    mediaType === 'tv'
      ? tmdbGet(`/tv/${tmdbId}/external_ids`).catch(() => ({}))
      : Promise.resolve(null),
  ]);

  const dateValue = data.release_date || data.first_air_date || '';
  const year = dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A';
  const genres = (data.genres || [])
    .map((genre) => genre.name)
    .filter(Boolean)
    .sort();
  const rating =
    typeof data.vote_average === 'number' ? `${data.vote_average.toFixed(1)}/10` : 'N/A';
  const runtimeMinutes =
    mediaType === 'tv'
      ? (data.episode_run_time || []).find((value) => typeof value === 'number' && value > 0) ||
        null
      : data.runtime || null;
  const seasons =
    mediaType === 'tv'
      ? (data.seasons || [])
          .filter((season) => season.season_number > 0)
          .map((season) => ({
            id: season.id,
            name: season.name || `Season ${season.season_number}`,
            seasonNumber: season.season_number,
            episodeCount: season.episode_count || 0,
            year: season.air_date ? season.air_date.slice(0, 4) : 'TBA',
            overview: (season.overview || '').trim() || null,
            ratingValue: typeof season.vote_average === 'number' ? season.vote_average : null,
            posterUrl: season.poster_path
              ? `https://image.tmdb.org/t/p/w300${season.poster_path}`
              : null,
          }))
      : [];

  let trailerCandidates = rankTrailerCandidates(data.videos?.results);
  // Measured: 8 of the 29 titles (out of 120 popular) that showed no trailer button at all
  // have a perfectly good *official* trailer that's only tagged in the original language —
  // Jana Nayagan (ta), Kung Fu Soccer (zh), Boulevard (fr). One extra request, and only on
  // the titles that would otherwise render no button.
  const originalLanguage = data.original_language;
  if (!trailerCandidates.length && originalLanguage && originalLanguage !== 'en') {
    const widened = await tmdbGet(`/${mediaType}/${tmdbId}/videos`, {
      include_video_language: `en,null,${originalLanguage}`,
    }).catch(() => null);
    trailerCandidates = rankTrailerCandidates(widened?.results);
  }
  const trailer = trailerCandidates[0] || null;

  // Movies: imdb_id is in the main response. TV: must come from external_ids.
  const imdbId = data.imdb_id || externalIds?.imdb_id || null;
  // TV has no `belongs_to_collection` on TMDb, so the franchise section is a
  // movie-only surface by data, not by choice.
  const collectionSeed =
    mediaType === 'movie' ? mapCollectionSeed(data.belongs_to_collection) : null;

  return {
    year,
    genres: genres.length ? genres.join(', ') : 'N/A',
    rating,
    runtimeMinutes,
    imdbId,
    // ISO 639-1 original language — so saving from the detail screen captures the
    // code for Discover's personalized language Quick Picks (mirrors the discover
    // and search mappers). Distinct from the Wikidata `originalLanguage` NAMES.
    originalLanguageCode: data.original_language
      ? String(data.original_language).toLowerCase()
      : null,
    collectionSeed,
    numberOfSeasons: mediaType === 'tv' ? data.number_of_seasons || seasons.length : null,
    numberOfEpisodes:
      mediaType === 'tv'
        ? data.number_of_episodes ||
          seasons.reduce((total, season) => total + season.episodeCount, 0)
        : null,
    // "Is it over?" — already in the /tv/{id} payload, no extra request.
    seriesStatus: mediaType === 'tv' ? data.status || null : null,
    nextEpisodeAirDate:
      mediaType === 'tv' ? data.next_episode_to_air?.air_date?.slice(0, 10) || null : null,
    createdBy:
      mediaType === 'tv'
        ? (data.created_by || [])
            .map((person) => person.name)
            .filter(Boolean)
            .join(', ') || 'N/A'
        : null,
    createdByPersons:
      mediaType === 'tv'
        ? (data.created_by || [])
            .filter((p) => p.id && p.name)
            .map((p) => ({
              id: p.id,
              name: p.name,
              job: 'Creator',
              profileUrl: personProfileUrl(p.profile_path),
            }))
        : [],
    seasons,
    // Movies nest the array under `keywords`, TV under `results` — the helper
    // takes either. Half of the Based On section's pre-signal; the credits call
    // supplies the other, stronger half and `resolveMatch` ORs the two.
    hasAdaptationKeyword: hasAdaptationKeyword(data.keywords),
    titleLogo: pickTitleLogo(data.images?.logos),
    heroBackdropUrl: pickHeroBackdrop(data.images?.backdrops),
    trailer: trailer ? trailer.url : 'N/A',
    // Drives the button label — a teaser shouldn't be sold as a trailer.
    trailerType: trailer ? trailer.type : null,
    // The player walks these when YouTube rejects the first (age gate, geo-block, takedown).
    trailerCandidates,
    // No `logo_path` filter: the tile leads with the company name, so a company
    // without art still has something to render. Measured on 100 popular titles,
    // filtering on the logo silently deleted 80 of 326 credits (24.5%).
    productionCompanies: (data.production_companies || [])
      .filter((company) => company.id && company.name)
      .map((company) => ({
        id: company.id,
        name: company.name,
        logoUrl: company.logo_path ? `https://image.tmdb.org/t/p/w200${company.logo_path}` : null,
      })),
  };
}

function personProfileUrl(profilePath) {
  return profilePath ? `https://image.tmdb.org/t/p/w185${profilePath}` : null;
}

/**
 * Pick the best title-treatment logo from TMDb's `images.logos`, the way Apple TV /
 * Netflix lead their hero with logo art instead of typeset text. Returns
 * `{ url, aspectRatio }` or null when there's nothing usable.
 *
 * expo-image cannot rasterize SVG, and TMDb serves many logos as `.svg`, so those
 * are filtered out — a missing logo falls back to the (now well-behaved) text title.
 */
function pickTitleLogo(logos) {
  if (!Array.isArray(logos) || !logos.length) return null;
  const raster = logos.filter((l) => l.file_path && !l.file_path.endsWith('.svg'));
  if (!raster.length) return null;
  // Prefer English lettering, then language-neutral, then anything; break ties on TMDb votes.
  const langScore = (l) => (l.iso_639_1 === 'en' ? 2 : l.iso_639_1 === null ? 1 : 0);
  const best = raster.slice().sort((a, b) => {
    const s = langScore(b) - langScore(a);
    if (s !== 0) return s;
    return (b.vote_average || 0) - (a.vote_average || 0);
  })[0];
  const aspectRatio =
    best.aspect_ratio ||
    (best.width && best.height ? best.width / best.height : null) ||
    null;
  return {
    url: `https://image.tmdb.org/t/p/w500${best.file_path}`,
    aspectRatio,
  };
}

/**
 * Pick the hero backdrop the way Apple TV / Netflix pick "background art": a clean,
 * textless film still to sit *behind* the title treatment — not TMDb's community
 * `backdrop_path`, whose most-voted primary is routinely dramatic key-art (title
 * cards, ornate promo art like LOTR's ring inscription) that fights an overlaid
 * title and sometimes bakes the title straight into the image.
 *
 * `iso_639_1 === null` drops language title-cards. Among the rest we rank by
 * community votes — counter-intuitively the right quality signal here: the ornate
 * key-art that fights a title treatment (LOTR's ring inscription) is TMDb's
 * designated *primary* backdrop, NOT the top-voted still, so ranking the null pool
 * by votes both keeps great default stills (D&D's cast shot) and steps around the
 * key-art. A ~16:9 preference drops odd crops; resolution breaks ties. Returns a
 * URL or null (caller falls back to the old backdrop, then the poster).
 */
function pickHeroBackdrop(backdrops) {
  if (!Array.isArray(backdrops) || !backdrops.length) return null;
  const textless = backdrops.filter((b) => b.file_path && b.iso_639_1 == null);
  if (!textless.length) return null;
  const aspectOf = (b) => b.aspect_ratio || (b.width && b.height ? b.width / b.height : 0);
  const isWide = (b) => (Math.abs(aspectOf(b) - 1.778) <= 0.06 ? 1 : 0);
  const best = textless.slice().sort((a, b) => {
    // 1. Prefer standard 16:9 film stills over odd crops / banners.
    if (isWide(a) !== isWide(b)) return isWide(b) - isWide(a);
    // 2. Community votes = the hero-quality signal (see note above).
    if ((b.vote_count || 0) !== (a.vote_count || 0)) return (b.vote_count || 0) - (a.vote_count || 0);
    // 3. Resolution breaks ties — 4K frame-grabs are almost always real stills.
    return (b.width || 0) - (a.width || 0);
  })[0];
  return `https://image.tmdb.org/t/p/original${best.file_path}`;
}

function uniquePeople(people = []) {
  const seen = new Set();
  return people.filter((person) => {
    const key = person.id || person.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const WRITER_CREW_JOBS = new Set([
  'Writer',
  'Screenplay',
  'Story',
  'Teleplay',
  'Novel',
  'Characters',
]);
const COMPOSER_CREW_JOB = 'Original Music Composer';

async function getCredits(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/credits`);

  const crew = data.crew || [];
  const directors = uniquePeople(crew.filter((person) => person.job === 'Director'));
  const director = directors[0] ?? crew.find((person) => person.department === 'Directing');
  const writers = uniquePeople(crew.filter((person) => WRITER_CREW_JOBS.has(person.job))).slice(
    0,
    12,
  );
  const composers = uniquePeople(crew.filter((person) => person.job === COMPOSER_CREW_JOB));
  const fullCast = (data.cast || []).sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  const topCast = fullCast.slice(0, 5);

  return {
    // TMDb credits a source author with the source form as the job title
    // ("Novel", "Graphic Novel", "Book"). The most reliable free answer to
    // "is this an adaptation?" before Wikidata is asked.
    hasSourceCredit: hasSourceMaterialCredit(crew),
    director: director ? director.name : 'N/A',
    directorId: director ? director.id : null,
    directorPersons: directors
      .filter((p) => p.id && p.name)
      .map((p) => ({
        id: p.id,
        name: p.name,
        job: p.job || 'Director',
        profileUrl: personProfileUrl(p.profile_path),
      })),
    writer: writers.map((person) => person.name).join(', ') || 'N/A',
    writerPersons: writers
      .filter((p) => p.name)
      .map((p) => ({
        id: p.id || null,
        name: p.name,
        job: p.job || 'Writer',
        profileUrl: personProfileUrl(p.profile_path),
      })),
    composerPersons: composers
      .filter((p) => p.name)
      .map((p) => ({
        id: p.id || null,
        name: p.name,
        job: p.job || COMPOSER_CREW_JOB,
        profileUrl: personProfileUrl(p.profile_path),
      })),
    starring: topCast.map((person) => person.name).join(', ') || 'N/A',
    starringPersons: topCast
      .filter((p) => p.id && p.name)
      .map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character || '',
        profileUrl: personProfileUrl(p.profile_path),
      })),
    castPersons: fullCast
      .filter((p) => p.id && p.name)
      .map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character || '',
        profileUrl: personProfileUrl(p.profile_path),
      })),
  };
}

/**
 * "More Like This".
 *
 * Uses `/recommendations`, not `/similar`. The two overlap by 1.0% measured
 * across 100 popular titles — `/similar` is a keyword-and-genre match, while
 * `/recommendations` is built from what people actually watch together, which
 * is the signal the rail claims to carry.
 *
 * The results arrive in relevance order and are deliberately left in it.
 */
async function getSimilar(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/recommendations`, {
    language: 'en-US',
    page: 1,
  });
  return rankSimilarTitles(data.results, mediaType, { currentTmdbId: tmdbId });
}

async function getProviderCountries(mediaType, tmdbId) {
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (_providerCountryCache.has(cacheKey)) return _providerCountryCache.get(cacheKey);

  let availability;
  if (mediaType === 'tv') {
    availability = await getTvProviderCountries(tmdbId);
  } else {
    const data = await tmdbGet(`/${mediaType}/${tmdbId}/watch/providers`);
    availability = availabilityFromResults(data.results || {});
  }

  _providerCountryCache.set(cacheKey, availability);
  return availability;
}

const _providerCountryCache = new Map();
let _countryNamesCache = null;
let _watchRegionsCache = null;

/**
 * Per-title streaming availability for the watchlist where-to-watch filter:
 * a map of service key → sorted ISO country codes (see providerAvailability).
 * TV titles resolve at show level unless the episode-lookup flag is enabled,
 * which keeps bulk watchlist checks to one request per title.
 */
export async function fetchTitleProviderCountries(mediaType, tmdbId) {
  return getProviderCountries(mediaType, tmdbId);
}

/**
 * Regions TMDB reports watch-provider data for, as `{ code, label }` sorted by
 * label. Throws on network failure — callers fall back to a static list.
 */
export async function fetchWatchProviderRegions() {
  if (_watchRegionsCache) return _watchRegionsCache;
  const data = await tmdbGet('/watch/providers/regions', { language: 'en-US' });
  const regions = (data.results || [])
    .filter((region) => region.iso_3166_1 && (region.english_name || region.native_name))
    .map((region) => ({
      code: region.iso_3166_1,
      label: region.english_name || region.native_name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (regions.length) _watchRegionsCache = regions;
  return regions;
}

let _serviceLogosCache = null;

/**
 * Official logo URLs for the ten services in `SERVICE_LABELS`, keyed by our
 * service key, harvested once from TMDb's full provider list. This is the chip's
 * counterpart to the country flag: a real brand mark instead of a generic glyph.
 * Returns `{}` on failure so callers just render no icon.
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchServiceLogos() {
  if (_serviceLogosCache) return _serviceLogosCache;
  const data = await tmdbGet('/watch/providers/movie', { language: 'en-US' });
  /** @type {Record<string, string>} */
  const logos = {};
  (data.results || []).forEach((provider) => {
    const key = serviceKey(provider.provider_name || '');
    if (key && !logos[key] && provider.logo_path) {
      logos[key] = `https://image.tmdb.org/t/p/original${provider.logo_path}`;
    }
  });
  if (Object.keys(logos).length) _serviceLogosCache = logos;
  return logos;
}

async function getTvProviderCountries(tmdbId) {
  const showLevelData = await tmdbGet(`/tv/${tmdbId}/watch/providers`);
  const showLevelAvailability = availabilityFromResults(showLevelData.results || {});
  showLevelAvailability.confidence = 'show';

  if (!TV_EPISODE_PROVIDER_LOOKUP_ENABLED) {
    return showLevelAvailability;
  }

  return getCompleteTvProviderCountries(tmdbId, showLevelAvailability);
}

async function getCompleteTvProviderCountries(tmdbId, fallbackAvailability = null) {
  const details = await tmdbGet(`/tv/${tmdbId}`, { language: 'en-US' });
  const episodes = (details.seasons || [])
    .filter((season) => season.season_number > 0)
    .flatMap((season) =>
      Array.from({ length: season.episode_count || 0 }, (_unused, index) => ({
        seasonNumber: season.season_number,
        episodeNumber: index + 1,
      })),
    );

  if (!episodes.length) {
    return fallbackAvailability || { ...emptyServiceMap(() => []), confidence: 'show' };
  }

  if (episodes.length > TV_EPISODE_PROVIDER_MAX_EPISODES) {
    return fallbackAvailability || { ...emptyServiceMap(() => []), confidence: 'show' };
  }

  const episodeResults = await mapWithConcurrency(episodes, 8, (episode) =>
    tmdbGet(
      `/tv/${tmdbId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}/watch/providers`,
    ),
  );

  // Same fan-out as before, folded twice: once per season so the detail screen
  // can answer "which seasons stream where", then across seasons for the
  // show-level answer (mathematically identical to the old single fold).
  const logos = emptyServiceMap(() => null);
  const bySeason = availabilityBySeason(episodes, episodeResults, logos);

  return {
    ...intersectSeasonAvailability(bySeason),
    logos,
    bySeason,
    confidence: 'episode',
  };
}

/**
 * /configuration/countries returns 251 entries but skips a handful of real ISO
 * 3166-1 regions that watch-provider results still land in — Guernsey shows up
 * on Fight Club, for one. Any code missing here falls through to the bare ISO
 * code in every list built from rows, so fill the gap once, at the source.
 */
const EXTRA_COUNTRY_NAMES = {
  AX: 'Åland Islands',
  BL: 'Saint Barthélemy',
  BQ: 'Caribbean Netherlands',
  CW: 'Curaçao',
  GG: 'Guernsey',
  IM: 'Isle of Man',
  JE: 'Jersey',
  MF: 'Saint Martin',
  SX: 'Sint Maarten',
};

async function getCountryNames() {
  if (_countryNamesCache) return _countryNamesCache;
  const data = await tmdbGet('/configuration/countries', { language: 'en-US' });
  // TMDb wins wherever it has an answer; the supplement only fills holes.
  const countryNames = { ...EXTRA_COUNTRY_NAMES };
  data.forEach((item) => {
    if (item.iso_3166_1) {
      countryNames[item.iso_3166_1] =
        item.english_name || item.name || EXTRA_COUNTRY_NAMES[item.iso_3166_1] || item.iso_3166_1;
    }
  });
  _countryNamesCache = countryNames;
  return countryNames;
}

function toRows(availability, countryNames) {
  const allCodes = Array.from(
    new Set(Object.keys(SERVICE_LABELS).flatMap((key) => availability[key] || [])),
  ).sort();
  const serviceCountries = Object.fromEntries(
    Object.keys(SERVICE_LABELS).map((key) => [key, new Set(availability[key] || [])]),
  );

  const rows = allCodes.map((code) => ({
    country: countryNames[code] || code,
    code,
    providers: Object.fromEntries(
      Object.keys(SERVICE_LABELS).map((key) => [key, serviceCountries[key].has(code)]),
    ),
  }));

  rows.sort((a, b) => a.country.localeCompare(b.country) || a.code.localeCompare(b.code));
  return rows;
}

export const SERVICE_FALLBACK_COLORS = {
  netflix: '#E50914',
  amazon_prime_video: '#00A8E1',
  max: '#002BE7',
  paramount_plus: '#0064FF',
  cbc_gem: '#E31B23',
  bbc_iplayer: '#FF4C98',
  channel_4: '#00AEEF',
  itvx: '#DE00FF',
  sbs_on_demand: '#00AEEF',
  abc_iview: '#00A3E0',
};

function buildProviderSummary(rows, logos = {}) {
  return Object.entries(SERVICE_LABELS).map(([key, label]) => ({
    key,
    label,
    count: rows.filter((row) => row.providers[key]).length,
    logoUrl: logos[key] ? `https://image.tmdb.org/t/p/original${logos[key]}` : null,
    fallbackColor: SERVICE_FALLBACK_COLORS[key],
  }));
}

// ─── Discover / Filter API ──────────────────────────────────────────────────

// In-memory genre cache: { movie: [...], tv: [...] }
const _genreCache = {};

export async function fetchGenres(mediaType) {
  if (_genreCache[mediaType]) return _genreCache[mediaType];

  const endpoint = mediaType === 'tv' ? '/genre/tv/list' : '/genre/movie/list';
  const data = await tmdbGet(endpoint, { language: 'en-US' });
  const genres = (data.genres || []).map((g) => ({ id: g.id, name: g.name }));
  _genreCache[mediaType] = genres;
  return genres;
}

// In-memory language/country cache
let _languageCache = null;
let _countryDiscoverCache = null;
const _discoverImdbIdCache = new Map();

export async function fetchLanguages() {
  if (_languageCache) return _languageCache;
  const data = await tmdbGet('/configuration/languages');
  const sorted = (Array.isArray(data) ? data : [])
    .filter((l) => l.english_name && l.english_name.trim())
    .sort((a, b) => a.english_name.localeCompare(b.english_name))
    .map((l) => ({ code: l.iso_639_1, label: l.english_name }));
  _languageCache = [{ code: null, label: 'Any Language' }, ...sorted];
  return _languageCache;
}

export async function fetchDiscoverCountries() {
  if (_countryDiscoverCache) return _countryDiscoverCache;
  const data = await tmdbGet('/configuration/countries', { language: 'en-US' });
  const sorted = (Array.isArray(data) ? data : [])
    .filter((c) => c.english_name && c.english_name.trim())
    .sort((a, b) => a.english_name.localeCompare(b.english_name))
    .map((c) => ({ code: c.iso_3166_1, label: c.english_name }));
  _countryDiscoverCache = [{ code: null, label: 'Any Country' }, ...sorted];
  return _countryDiscoverCache;
}

async function getDiscoverImdbId(mediaType, tmdbId) {
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (_discoverImdbIdCache.has(cacheKey)) return _discoverImdbIdCache.get(cacheKey);

  try {
    const data =
      mediaType === 'tv'
        ? await tmdbGet(`/tv/${tmdbId}/external_ids`)
        : await tmdbGet(`/movie/${tmdbId}`, { language: 'en-US' });
    const imdbId = data.imdb_id || null;
    _discoverImdbIdCache.set(cacheKey, imdbId);
    return imdbId;
  } catch {
    _discoverImdbIdCache.set(cacheKey, null);
    return null;
  }
}

export async function enrichDiscoverResults(items = []) {
  if (!items.length) return [];

  return mapWithConcurrency(items, 4, async (item) => {
    const imdbId = item.imdbId || (await getDiscoverImdbId(item.mediaType, item.tmdbId));
    const omdbRatings = await fetchOmdbRatings(imdbId);

    return {
      ...item,
      imdbId,
      omdbRatings,
      omdbEnriched: true,
    };
  });
}

// ─── Smart Filters ──────────────────────────────────────────────────────────
// Anime, Korean, Japanese, Chinese and Bollywood are curated buckets that don't
// map 1:1 to a TMDB genre. Their definitions (include codes/keywords + exclude
// predicates) live in ./smartFilters so the include and exclude paths can never
// drift apart. This file just wires those definitions into the /discover query.

/**
 * Call /3/discover/movie or /3/discover/tv with a filter object.
 *
 * filters = {
 *   mediaType: 'movie' | 'tv',
 *   genreIds: number[],            // include genres (AND/OR)
 *   genreLogic: 'AND' | 'OR',
 *   excludeGenreIds: number[],     // official TMDB genres to exclude
 *   excludeSmartTags: string[],    // e.g. ['anime'] — removed post-fetch
 *   includeSmartTags: string[],    // e.g. ['anime'] — required via with_keywords
 *   minRating: number | null,      // vote_average.gte
 *   maxRating: number | null,      // vote_average.lte
 *   languageCodes: string[],       // ISO 639-1, e.g. ['en', 'ja']
 *   originCountries: string[],     // ISO 3166-1, TV only, e.g. ['US', 'KR']
 *   fromYear: string | null,       // '2010'
 *   toYear: string | null,         // '2024'
 *   minRuntime: string | null,     // movie only, minutes, e.g. '90'
 *   maxRuntime: string | null,     // movie only, minutes, e.g. '180'
 *   sortBy: string,                // 'popularity.desc' etc.
 *   page: number,
 * }
 *
 * Returns { results, totalResults, totalPages, page }
 */
export async function discoverTitles(filters = {}) {
  const {
    mediaType = 'movie',
    genreIds = [],
    genreLogic = 'AND',
    excludeGenreIds = [],
    excludeSmartTags = [],
    includeSmartTags = [],
    minRating = null,
    maxRating = null,
    languageCodes = [],
    originCountries = [],
    fromYear = null,
    toYear = null,
    minRuntime = null,
    maxRuntime = null,
    sortBy = 'popularity.desc',
    excludeEnglish = false,
    watchRegion = null,
    watchProviders = [],
    page = 1,
  } = filters;

  const params = {
    sort_by: sortBy,
    // "Highest Rated" (vote_average.desc) with a trivial floor surfaces obscure
    // 10-from-20-votes noise — the same defect the rails/company runs fixed. Reuse
    // the rails' 200-vote floor for that sort; every other sort keeps the light
    // discovery floor of 20 so counts stay generous.
    'vote_count.gte': sortBy === 'vote_average.desc' ? MIN_RAIL_VOTES : 20,
    include_adult: false,
    page,
  };

  if (watchRegion && watchProviders.length > 0) {
    params.watch_region = watchRegion;
    params.with_watch_providers = watchProviders.join('|');
  }

  // ── Include genres ──────────────────────────────────────────────────────────
  if (genreIds.length > 0) {
    const separator = genreLogic === 'OR' ? '|' : ',';
    params.with_genres = genreIds.join(separator);
  }

  // ── Exclude genres (TMDB native support) ───────────────────────────────────
  if (excludeGenreIds.length > 0) {
    // TMDB: without_genres accepts comma-separated IDs (always AND-exclusion)
    params.without_genres = excludeGenreIds.join(',');
  }

  // ── Include smart tags (native filters) ────────────────────────────────────
  // Keyword-kind smart filters (Anime) map to `with_keywords`; language-kind
  // ones (Korean/Japanese/Chinese/Bollywood) fold into `with_original_language`
  // below, alongside the manual Language picker. All native, so counts stay exact.
  const keywordIds = smartFilterKeywordIds(includeSmartTags);
  if (keywordIds.length > 0) {
    params.with_keywords = keywordIds.join(',');
  }

  if (minRating != null && minRating > 0) {
    params['vote_average.gte'] = minRating;
  }

  if (maxRating != null && maxRating > 0) {
    params['vote_average.lte'] = maxRating;
  }

  // Manual Language picker ∪ any included language-kind smart filters, so a
  // Smart Filter and a picked language never silently overwrite one another.
  const mergedLanguageCodes = Array.from(
    new Set([...languageCodes, ...smartFilterLanguageCodes(includeSmartTags)]),
  );
  if (mergedLanguageCodes.length > 0) {
    params.with_original_language = mergedLanguageCodes.join('|');
  } else if (excludeEnglish) {
    // TMDB has no native `without_original_language` parameter.
    // We use NON_ENGLISH_CODES — a curated, stable union of all major
    // non-English language codes across our region presets.
    // This avoids the URL-length issues caused by joining all 180+ TMDB
    // language codes and keeps the query semantically meaningful.
    params.with_original_language = NON_ENGLISH_CODES.join('|');
  }

  if (mediaType === 'tv' && originCountries.length > 0) {
    params.with_origin_country = originCountries.join('|');
  }

  if (mediaType === 'movie') {
    if (fromYear) params['primary_release_date.gte'] = `${fromYear}-01-01`;
    if (toYear) params['primary_release_date.lte'] = `${toYear}-12-31`;

    const minRuntimeMinutes = parseInt(minRuntime, 10);
    const maxRuntimeMinutes = parseInt(maxRuntime, 10);
    if (minRuntime && !isNaN(minRuntimeMinutes) && minRuntimeMinutes > 0) {
      params['with_runtime.gte'] = minRuntimeMinutes;
    }
    if (maxRuntime && !isNaN(maxRuntimeMinutes) && maxRuntimeMinutes > 0) {
      params['with_runtime.lte'] = maxRuntimeMinutes;
    }
  } else {
    if (fromYear) params['first_air_date.gte'] = `${fromYear}-01-01`;
    if (toYear) params['first_air_date.lte'] = `${toYear}-12-31`;
  }

  const data = await tmdbGet(`/discover/${mediaType}`, params);

  // Exclude-kind smart filters are applied post-fetch (TMDB has no native
  // "without_original_language"/"without_keyword-that-we-want" for these), the
  // same shape the Anime exclude always used — now generalized to every filter.
  const excludeKeys = excludeSmartTags.filter((key) => SMART_FILTER_KEYS.includes(key));

  const rawItems = data.results || [];
  const filtered =
    excludeKeys.length > 0
      ? rawItems.filter((item) => !isExcludedBySmartFilters(item, excludeKeys))
      : rawItems;

  const results = filtered.map((item) => {
    const dateValue = item.release_date || item.first_air_date || '';
    return {
      mediaType,
      tmdbId: item.id,
      title: item.title || item.name || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path
        ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
        : null,
      ratingValue: item.vote_average || 0,
      rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
      // ISO 639-1 original language, captured so a saved title carries the code
      // that powers Discover's personalized language Quick Picks. Absent → the
      // field is omitted (not null) so the watchlist backfill can spot the gap.
      ...(item.original_language
        ? { originalLanguageCode: String(item.original_language).toLowerCase() }
        : {}),
    };
  });

  // Post-fetch exclusion may have removed items from the page, so adjust the
  // reported count to avoid misleading the user.
  const removedCount = rawItems.length - filtered.length;
  const adjustedTotal = Math.max(0, (data.total_results || 0) - removedCount);

  return {
    results,
    totalResults: adjustedTotal,
    totalPages: data.total_pages || 1,
    page: data.page || 1,
  };
}

/**
 * The ISO 639-1 original-language code for a single title, or null. Used by the
 * watchlist backfill to fill in language data for titles saved before the app
 * started capturing `originalLanguageCode` at save time. Best-effort: never throws.
 * @param {'movie'|'tv'} mediaType
 * @param {number|string} tmdbId
 * @returns {Promise<string|null>}
 */
export async function fetchOriginalLanguageCode(mediaType, tmdbId) {
  try {
    const data = await tmdbGet(`/${mediaType}/${tmdbId}`, { language: 'en-US' });
    const code = (data.original_language || '').toLowerCase().trim();
    return code || null;
  } catch {
    return null;
  }
}

/** Next scheduled episode for a TV series (`next_episode_to_air`), if present. */
export async function getTvShowNextEpisode(tmdbId) {
  const data = await tmdbGet(`/tv/${tmdbId}`, { language: 'en-US' });
  const airDate = data.next_episode_to_air?.air_date;
  if (!airDate) return null;
  return {
    airDate: airDate.slice(0, 10),
    seasonNumber: data.next_episode_to_air.season_number,
    episodeNumber: data.next_episode_to_air.episode_number,
  };
}

// ─── Now Playing ─────────────────────────────────────────────────────────────

/**
 * Fetch movies currently in theatres from TMDB, sorted by rating (highest first).
 * Merges page 1 and page 2 to give a richer result set (~40 titles).
 */
/**
 * Movies currently in theatres.
 *
 * `region` decides whose theatres — TMDb silently answers for the US when it is
 * omitted, which is a fine default but a bad accident. Callers that show the
 * list to the user should pass one and name it in the UI.
 *
 * Still returns the list sorted by rating for the callers that relied on it;
 * `popularity` and `voteCount` are carried through so a caller can impose its
 * own ordering instead.
 *
 * @param {{ region?: string }} [options]
 */
export async function fetchNowPlayingMovies({ region = 'US' } = {}) {
  const [page1, page2] = await Promise.all([
    tmdbGet('/movie/now_playing', { language: 'en-US', region, page: 1 }),
    tmdbGet('/movie/now_playing', { language: 'en-US', region, page: 2 }),
  ]);

  const raw = [...(page1.results || []), ...(page2.results || [])];

  // Deduplicate by id
  const seen = new Set();
  const unique = raw.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Sort highest rating first
  unique.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

  return unique.map((item) => {
    const dateValue = item.release_date || '';
    return {
      mediaType: 'movie',
      tmdbId: item.id,
      title: item.title || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path
        ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
        : null,
      ratingValue: item.vote_average || 0,
      rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
      popularity: item.popularity || 0,
      voteCount: item.vote_count || 0,
    };
  });
}

async function getHomeCollectionRowFromSeed(seed) {
  try {
    const detail = await tmdbGet(`/movie/${seed.tmdbId}`, { language: 'en-US' });
    if (!detail.belongs_to_collection?.id) return null;

    const collectionInfo = await getMovieCollectionInfo(
      mapCollectionSeed(detail.belongs_to_collection),
      seed.tmdbId,
    );
    if (!collectionInfo.isFranchise || !collectionInfo.collection?.parts?.length) return null;

    const firstMovie = collectionInfo.collection.parts[0] || seed;

    return {
      id: collectionInfo.collection.id,
      title:
        collectionInfo.collection.name || detail.belongs_to_collection.name || 'Movie Collection',
      firstMovie,
      firstMovieRatingValue: firstMovie.ratingValue || 0,
      items: collectionInfo.collection.parts,
    };
  } catch {
    return null;
  }
}

export async function fetchTopMovieCollectionRows(limit = 20) {
  const pages = await Promise.all(
    [1, 2, 3, 4, 5].map((page) =>
      tmdbGet('/discover/movie', {
        language: 'en-US',
        sort_by: 'vote_average.desc',
        'vote_count.gte': 100,
        include_adult: false,
        page,
      }),
    ),
  );

  const seenMovieIds = new Set();
  const seeds = pages
    .flatMap((page) => page.results || [])
    .filter((item) => {
      if (!item?.id || seenMovieIds.has(item.id)) return false;
      seenMovieIds.add(item.id);
      return true;
    })
    .map((item) => {
      const dateValue = item.release_date || '';
      return {
        mediaType: 'movie',
        tmdbId: item.id,
        title: item.title || '(Untitled)',
        year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
        synopsis: (item.overview || '').trim() || 'No synopsis available.',
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdropUrl: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : null,
        ratingValue: item.vote_average || 0,
        rating:
          typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
      };
    })
    .sort((a, b) => (b.ratingValue || 0) - (a.ratingValue || 0));

  const collectionRows = await mapWithConcurrency(
    seeds.slice(0, 100),
    3,
    getHomeCollectionRowFromSeed,
  );

  const seenCollectionIds = new Set();
  const uniqueRows = [];
  for (const row of collectionRows) {
    if (!row?.id || seenCollectionIds.has(row.id)) continue;
    seenCollectionIds.add(row.id);
    uniqueRows.push(row);
  }

  return uniqueRows
    .sort((a, b) => (b.firstMovieRatingValue || 0) - (a.firstMovieRatingValue || 0))
    .slice(0, limit);
}

// ─── Resolution ─────────────────────────────────────────────────────────────

/**
 * "More From Cast & Crew".
 *
 * One `/person/{id}/combined_credits` request per person instead of a single
 * `/discover/movie?with_people=a|b|c` OR-join. Three things fall out of that:
 *
 *  - Attribution. The OR-join structurally cannot say which of the ten people
 *    matched, so the rail could never explain why 12 Years a Slave sat under a
 *    horror short. A per-person call knows.
 *  - No blockbuster magnet. "Highest-rated film sharing any of ten people"
 *    kept landing on the same handful of titles — Infinity War appeared on 11
 *    of 100 pages measured. Filmographies have no such pull.
 *  - TV. `combined_credits` spans both, so a series page no longer shows an
 *    unlabelled movies-only rail.
 *
 * Also 4 requests instead of 26: the old path fanned 12 external-id lookups
 * and 12 OMDb calls out just to re-sort five cards.
 */
async function getMoreFromCastAndCrew(people, currentTmdbId, size = RAIL_SIZE) {
  if (!people || people.length === 0) return [];
  try {
    const groups = await mapWithConcurrency(people, 3, async (person) => {
      try {
        const credits = await tmdbGet(`/person/${person.id}/combined_credits`, {
          language: 'en-US',
        });
        return { person, items: creditsForPerson(person, credits, { currentTmdbId }) };
      } catch {
        // One dead filmography shouldn't empty the rail.
        return { person, items: [] };
      }
    });

    return rankPeopleTitles(groups, { size });
  } catch {
    return [];
  }
}

/**
 * Both foot-of-page rails, fetched together after the screen has painted.
 *
 * Deliberately not part of `resolveMatch`: these are the last two sections of
 * the scroll and used to gate "where can I watch this" — the cast/crew rail
 * alone cost ~800ms of TMDb time before anything rendered.
 */
export async function fetchTitleRails(result) {
  if (!result?.tmdbId || !result?.mediaType) return { similar: [], fromPeople: [] };

  const people = selectRailPeople(result);
  const [similar, peoplePool] = await Promise.all([
    getSimilar(result.mediaType, result.tmdbId).catch(() => []),
    // Over-fetch so the cross-rail dedupe below can drop collisions without
    // leaving the people rail short.
    getMoreFromCastAndCrew(people, result.tmdbId, RAIL_SIZE * 3).catch(() => []),
  ]);

  const onSimilarRail = new Set(similar.map((item) => `${item.mediaType}:${item.tmdbId}`));
  const fromPeople = peoplePool
    .filter((item) => !onSimilarRail.has(`${item.mediaType}:${item.tmdbId}`))
    .slice(0, RAIL_SIZE);

  return { similar, fromPeople };
}

/**
 * Hang per-season availability rows off each season. Absent when the
 * episode-level lookup is disabled or the show exceeded the episode cap, in
 * which case seasons pass through untouched and the UI falls back to the
 * show-level Where To Watch answer.
 */
function withSeasonAvailability(seasons, bySeason, countryNames, serviceLogos) {
  if (!Array.isArray(seasons) || !seasons.length || !bySeason) return seasons;

  return seasons.map((season) => {
    const seasonAvailability = bySeason[season.seasonNumber];
    if (!seasonAvailability) return season;

    const seasonRows = toRows(seasonAvailability, countryNames);
    return {
      ...season,
      availabilityRows: seasonRows,
      providerSummary: buildProviderSummary(seasonRows, serviceLogos),
    };
  });
}

/**
 * Build a search-shaped `match` from nothing but an id — the entry point a deep
 * link has. `getTitleMetadata` deliberately omits title/poster/synopsis because
 * every other caller already carries them on the match object it picked, so
 * handing `resolveMatch` a bare `{ tmdbId, mediaType }` renders a detail screen
 * titled "undefined" with no artwork.
 */
export async function getTitleMatchById(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}`, { language: 'en-US' });
  const dateValue = data.release_date || data.first_air_date || '';
  return {
    mediaType,
    tmdbId: data.id,
    title: data.title || data.name || '(Untitled)',
    year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
    synopsis: (data.overview || '').trim() || 'No synopsis available.',
    posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    backdropUrl: data.backdrop_path
      ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
      : null,
    ratingValue: data.vote_average || 0,
    releaseDate: dateValue || null,
  };
}

export async function resolveMatch(query, match) {
  // Execute detail requests sequentially to prevent OkHttp / Cloudflare from dropping concurrent sockets
  const metadata = await getTitleMetadata(match.mediaType, match.tmdbId);
  const countryNames = await getCountryNames();
  const credits = await getCredits(match.mediaType, match.tmdbId);
  const availability = await getProviderCountries(match.mediaType, match.tmdbId);

  // The two foot-of-page rails are NOT awaited here — `fetchTitleRails` runs
  // from the screen after first paint. They are the last thing the user scrolls
  // to and used to gate the availability answer the app exists to give.
  const omdbRatings = await fetchOmdbRatings(metadata.imdbId || null);

  const rows = toRows(availability, countryNames);
  const serviceLogos = availability.logos || {};

  return {
    query,
    ...match,
    ...metadata,
    ...credits,
    seasons: withSeasonAvailability(
      metadata.seasons,
      availability.bySeason,
      countryNames,
      serviceLogos,
    ),
    rows,
    providerSummary: buildProviderSummary(rows, serviceLogos),
    serviceLogos: Object.fromEntries(
      Object.entries(serviceLogos).map(([key, path]) => [
        key,
        path ? `https://image.tmdb.org/t/p/original${path}` : null,
      ]),
    ),
    providerAvailabilityConfidence: availability.confidence || 'show',
    // Either signal is enough to reserve space for the Based On section before
    // Wikidata replies. Neither is a promise there is a P144 statement to show —
    // when the fetch comes back empty the section still renders nothing.
    isAdaptation: Boolean(metadata.hasAdaptationKeyword || credits.hasSourceCredit),
    omdbRatings,
  };
}

// ─── Filmography ─────────────────────────────────────────────────────────────

/**
 * Fetch filmography for a TMDB person.
 * @param {number} personId  TMDB person ID
 * @param {string} personName Display name
 * @param {'movie'|'tv'|'cast'|'writer'|'composer'} role  Director (movie), TV creator, actor, writer, or composer credits
 */
export async function fetchPersonFilmography(personId, personName, role) {
  // role: 'movie' (director), 'tv' (creator), 'cast' (actor), 'writer', or 'composer'
  let items;
  let resolvedMediaType; // used to set mediaType on result items

  if (role === 'cast') {
    // Combined credits covers both movies and TV the actor appeared in
    const data = await tmdbGet(`/person/${personId}/combined_credits`, { language: 'en-US' });
    const castCredits = (data.cast || [])
      .filter((c) => c.media_type === 'movie' || c.media_type === 'tv')
      .filter((c) => c.vote_count >= 5); // skip obscure entries

    // Deduplicate by id
    const seen = new Set();
    const unique = castCredits.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Sort by rating descending (highest to lowest)
    unique.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

    const results = unique.map((item) => {
      const dateValue = item.release_date || item.first_air_date || '';
      return {
        mediaType: item.media_type,
        tmdbId: item.id,
        title: item.title || item.name || '(Untitled)',
        year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
        synopsis: (item.overview || '').trim() || 'No synopsis available.',
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdropUrl: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : null,
        ratingValue: item.vote_average || 0,
        rating:
          typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
        character: item.character || '',
      };
    });

    // Get profile image
    const personData = await tmdbGet(`/person/${personId}`, { language: 'en-US' });
    const profileUrl = personData.profile_path
      ? `https://image.tmdb.org/t/p/w185${personData.profile_path}`
      : null;

    return { personName, role: 'cast', results, profileUrl };
  }

  if (role === 'writer') {
    const data = await tmdbGet(`/person/${personId}/combined_credits`, { language: 'en-US' });
    const crewCredits = (data.crew || [])
      .filter((c) => WRITER_CREW_JOBS.has(c.job))
      .filter((c) => c.media_type === 'movie' || c.media_type === 'tv')
      .filter((c) => (c.vote_count ?? 0) >= 5);

    const seen = new Set();
    const unique = crewCredits.filter((item) => {
      const key = `${item.media_type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

    const results = unique.map((item) => {
      const dateValue = item.release_date || item.first_air_date || '';
      return {
        mediaType: item.media_type,
        tmdbId: item.id,
        title: item.title || item.name || '(Untitled)',
        year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
        synopsis: (item.overview || '').trim() || 'No synopsis available.',
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdropUrl: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : null,
        ratingValue: item.vote_average || 0,
        rating:
          typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
      };
    });

    const personData = await tmdbGet(`/person/${personId}`, { language: 'en-US' });
    const profileUrl = personData.profile_path
      ? `https://image.tmdb.org/t/p/w185${personData.profile_path}`
      : null;

    return { personName, role: 'writer', results, profileUrl };
  }

  if (role === 'composer') {
    const data = await tmdbGet(`/person/${personId}/combined_credits`, { language: 'en-US' });
    const crewCredits = (data.crew || [])
      .filter((c) => c.job === COMPOSER_CREW_JOB)
      .filter((c) => c.media_type === 'movie' || c.media_type === 'tv')
      .filter((c) => (c.vote_count ?? 0) >= 5);

    const seen = new Set();
    const unique = crewCredits.filter((item) => {
      const key = `${item.media_type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

    const results = unique.map((item) => {
      const dateValue = item.release_date || item.first_air_date || '';
      return {
        mediaType: item.media_type,
        tmdbId: item.id,
        title: item.title || item.name || '(Untitled)',
        year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
        synopsis: (item.overview || '').trim() || 'No synopsis available.',
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdropUrl: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : null,
        ratingValue: item.vote_average || 0,
        rating:
          typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
      };
    });

    const personData = await tmdbGet(`/person/${personId}`, { language: 'en-US' });
    const profileUrl = personData.profile_path
      ? `https://image.tmdb.org/t/p/w185${personData.profile_path}`
      : null;

    return { personName, role: 'composer', results, profileUrl };
  }

  // Director / Creator path
  const endpoint =
    role === 'movie' ? `/person/${personId}/movie_credits` : `/person/${personId}/tv_credits`;

  const data = await tmdbGet(endpoint, { language: 'en-US' });
  resolvedMediaType = role;

  if (role === 'movie') {
    items = (data.crew || []).filter((c) => c.job === 'Director');
  } else {
    items = (data.crew || []).filter((c) => c.job === 'Creator');
    if (!items.length) items = data.crew || [];
  }

  // Deduplicate by id
  const seen = new Set();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Sort by rating descending (highest to lowest)
  unique.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

  const results = unique.map((item) => {
    const dateValue = item.release_date || item.first_air_date || '';
    return {
      mediaType: resolvedMediaType,
      tmdbId: item.id,
      title: item.title || item.name || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path
        ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
        : null,
      ratingValue: item.vote_average || 0,
      rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    };
  });

  // Get profile image
  const personData = await tmdbGet(`/person/${personId}`, { language: 'en-US' });
  const profileUrl = personData.profile_path
    ? `https://image.tmdb.org/t/p/w185${personData.profile_path}`
    : null;

  return { personName, role, results, profileUrl };
}

/**
 * Movies and TV where the given company appears in production_companies.
 *
 * Ordered by popularity, not rating. A studio page should open with what the
 * studio is *known for*; rating-sorting a catalogue is what put "Radio Disney
 * Music Awards" (9.6 from 7 votes) at the top of Walt Disney Pictures and a
 * 1991 stand-up set third on Universal Pictures. The vote floors are the same
 * two-tier pair the recommendation rails already use — this function carried
 * the identical `vote_average.desc` + `vote_count.gte: 5` defect that
 * `rankSimilarTitles` was written to cure, in the file next door.
 *
 * `total` is TMDb's own count for the same query. The screen used to print the
 * length of this page-1 slice as if it were the catalogue, which is how
 * Columbia Pictures came to claim 22 titles against a real 1,544.
 */
export async function fetchProductionCompanyCatalog(companyId, companyName, logoUrl) {
  const baseParams = {
    with_companies: companyId,
    language: 'en-US',
    sort_by: 'popularity.desc',
    'vote_count.gte': ABSOLUTE_MIN_RAIL_VOTES,
    include_adult: false,
    page: 1,
  };

  const [movieData, tvData] = await Promise.all([
    tmdbGet('/discover/movie', baseParams),
    tmdbGet('/discover/tv', baseParams),
  ]);

  const mapRow = (item, mediaType) => {
    const dateValue = item.release_date || item.first_air_date || '';
    const vote = item.vote_average;
    return {
      mediaType,
      tmdbId: item.id,
      title: item.title || item.name || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path
        ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
        : null,
      ratingValue: vote || 0,
      rating: typeof vote === 'number' ? `${vote.toFixed(1)}/10` : 'N/A',
      // Captured so the floors below can be applied at all — the old mapRow
      // dropped both of these, the same gap the rails fix had to close first.
      voteCount: item.vote_count || 0,
      popularity: item.popularity || 0,
    };
  };

  const movies = (movieData.results || []).map((item) => mapRow(item, 'movie'));
  const shows = (tvData.results || []).map((item) => mapRow(item, 'tv'));
  const combined = [...movies, ...shows];

  combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const results = rankCompanyCatalog(combined);

  return {
    personName: companyName,
    role: 'company',
    results,
    profileUrl: logoUrl || null,
    total: (movieData.total_results || 0) + (tvData.total_results || 0),
  };
}

// ─── Trakt Enrichment ─────────────────────────────────────────────────────────

/**
 * Enrich a list of raw Trakt items with TMDB poster/backdrop/synopsis/rating.
 * Input shape:  [{ mediaType, tmdbId, imdbId, title, year, watchers, trendingRank }]
 * Output shape: same + { posterUrl, backdropUrl, synopsis, rating, ratingValue, genres }
 */
export async function enrichTraktItems(items = []) {
  if (!items.length) return [];

  return mapWithConcurrency(items, 4, async (item) => {
    try {
      const data = await tmdbGet(`/${item.mediaType}/${item.tmdbId}`, {
        language: 'en-US',
      });
      return {
        ...item,
        synopsis: (data.overview || '').trim() || 'No synopsis available.',
        posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
        backdropUrl: data.backdrop_path
          ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
          : null,
        ratingValue: data.vote_average || 0,
        rating:
          typeof data.vote_average === 'number' ? `${data.vote_average.toFixed(1)}/10` : 'N/A',
        genres: (data.genres || []).map((g) => g.name).join(', ') || null,
      };
    } catch {
      // TMDB enrichment is best-effort — return the bare Trakt item on failure
      return item;
    }
  });
}
