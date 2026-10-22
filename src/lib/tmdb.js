import { recordRateQuota429, recordRateQuotaFromResponse } from './apiRateQuota';
import { fetchOmdbRatings } from './omdb';
import {
  buildDiscoverQueryParams,
  isExcludedBySmartFilters,
} from './smartFilters';
import { matchesSeasonsRange } from './discoverRanges';
import { createAppError, isRetryableStatus, retryWithBackoff } from './errors';
import { rankTrailerCandidates } from './trailerPicker';
import { hasAdaptationKeyword, hasSourceMaterialCredit } from './basedOn';
import {
  SEARCH_PANEL_MAX_ROWS,
  SEARCH_RESULTS_MAX,
  buildCompoundPersonTitleSplits,
  isRankablePersonDepartment,
  normalizeSearchText,
  parseCompoundSearchQuery,
  rankSearchCandidates,
  searchMatchTier,
} from './searchRanker';
import {
  ABSOLUTE_MIN_RAIL_VOTES,
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
import { partitionFilmographyCredits } from './actorFilmographyModel';
import { getOffsetDateYmd, interleaveByPopularity, dedupeRailItems } from './searchRails';

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

const tmdbLimiter = new ConcurrencyLimiter(6);
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

function dedupeSearchCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const item of candidates) {
    if (!item) continue;
    const key =
      item.resultType === 'person'
        ? `person:${item.personId ?? item.tmdbId}`
        : `media:${item.mediaType}:${item.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Resolve compound `Title + Person` or `Person + Title` queries (e.g.,
 * `"Mutiny Jason Statham"`, `"Jason Statham Mutiny"`, `"Mutiny Statham"`)
 * when TMDb's `/search/multi` returns no direct matches.
 */
async function resolveCompoundPersonTitleCandidates(query) {
  const splits = buildCompoundPersonTitleSplits(query);
  if (!splits.length) return [];

  const splitMatches = await Promise.all(
    splits.slice(0, 4).map(async ({ titlePart, personPart, yearHint }) => {
      try {
        const personSearch = await tmdbGet('/search/person', {
          query: personPart,
          include_adult: false,
          language: 'en-US',
          page: 1,
        });
        const normalizedPersonPart = normalizeSearchText(personPart);
        const topPersonRaw = (personSearch?.results || []).find(
          (p) =>
            isRankablePersonDepartment(p?.known_for_department) &&
            searchMatchTier(p?.name, normalizedPersonPart) <= 1,
        );
        if (!topPersonRaw?.id) return null;

        const credits = await tmdbGet(`/person/${topPersonRaw.id}/combined_credits`, {
          language: 'en-US',
        });
        const allCredits = [
          ...(Array.isArray(credits?.cast) ? credits.cast : []),
          ...(Array.isArray(credits?.crew) ? credits.crew : []),
        ];
        const normalizedTitlePart = normalizeSearchText(titlePart);
        const matchedCredits = [];
        const seenCreditKeys = new Set();

        for (const raw of allCredits) {
          const mediaType = raw?.media_type;
          if (mediaType !== 'movie' && mediaType !== 'tv') continue;
          const rawTitle = raw?.title || raw?.name || '';
          const tier = searchMatchTier(rawTitle, normalizedTitlePart);
          if (tier > 2) continue;
          const key = `${mediaType}:${raw.id}`;
          if (seenCreditKeys.has(key)) continue;
          seenCreditKeys.add(key);
          const mapped = mapSearchMediaItem(raw);
          const matchesYear = Boolean(yearHint) && String(mapped.year) === String(yearHint);
          matchedCredits.push({
            mapped,
            tier,
            matchesYear: matchesYear ? 1 : 0,
            popularity: Number(mapped.popularity) || 0,
            voteCount: Number(raw.vote_count) || 0,
          });
        }

        if (!matchedCredits.length) return null;

        matchedCredits.sort((a, b) => {
          if (a.matchesYear !== b.matchesYear) return b.matchesYear - a.matchesYear;
          if (a.tier !== b.tier) return a.tier - b.tier;
          if (a.popularity !== b.popularity) return b.popularity - a.popularity;
          return b.voteCount - a.voteCount;
        });

        const personCandidate = mapSearchPersonItem(topPersonRaw);
        return {
          bestTier: matchedCredits[0].tier,
          bestYearMatch: matchedCredits[0].matchesYear,
          personPopularity: Number(topPersonRaw.popularity) || 0,
          items: [
            ...matchedCredits.map((entry) => entry.mapped),
            ...(personCandidate ? [personCandidate] : []),
          ],
        };
      } catch {
        return null;
      }
    }),
  );

  const validSplits = splitMatches.filter(Boolean);
  if (!validSplits.length) return [];

  validSplits.sort((a, b) => {
    if (a.bestYearMatch !== b.bestYearMatch) return b.bestYearMatch - a.bestYearMatch;
    if (a.bestTier !== b.bestTier) return a.bestTier - b.bestTier;
    return b.personPopularity - a.personPopularity;
  });

  return dedupeSearchCandidates(validSplits.flatMap((entry) => entry.items));
}

async function fetchAndRankSearchCandidates(query) {
  const { titleQuery, yearHint } = parseCompoundSearchQuery(query);

  const requests = [
    tmdbGet('/search/multi', {
      query,
      include_adult: false,
      language: 'en-US',
      page: 1,
    }),
  ];

  // When the user includes a release year (e.g. "Mutiny 2026"), TMDb's
  // `/search/multi` returns 0 results for the combined string. Query the
  // stripped title in parallel and let `rankSearchCandidates` promote the
  // matching year to #1.
  if (yearHint && titleQuery && titleQuery.toLowerCase() !== query.trim().toLowerCase()) {
    requests.push(
      tmdbGet('/search/multi', {
        query: titleQuery,
        include_adult: false,
        language: 'en-US',
        page: 1,
      }).catch(() => ({ results: [] })),
    );
  }

  const payloads = await Promise.all(requests);
  const directCandidates = dedupeSearchCandidates(
    payloads.flatMap((payload) => mapSearchPayload(payload)),
  );

  const normalizedCheck = normalizeSearchText(titleQuery || query);
  const hasStrongDirectMatch = directCandidates.some(
    (c) => searchMatchTier(c?.title, normalizedCheck) <= 2,
  );

  if (directCandidates.length > 0 && hasStrongDirectMatch) {
    return rankSearchCandidates(directCandidates, query);
  }

  // Fallback for "Title + Actor" / "Actor + Title" queries (e.g. "Mutiny Jason Statham")
  const compoundCandidates = await resolveCompoundPersonTitleCandidates(query);
  if (compoundCandidates.length > 0) {
    return dedupeSearchCandidates([
      ...compoundCandidates,
      ...rankSearchCandidates(directCandidates, query),
    ]);
  }

  return rankSearchCandidates(directCandidates, query);
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
  const ranked = await fetchAndRankSearchCandidates(query);
  if (!ranked.length) {
    throw createAppError(`We couldn't find any matches for "${query}".`, 'NO_RESULTS', { query });
  }

  return ranked.slice(0, SEARCH_RESULTS_MAX);
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
  const ranked = await fetchAndRankSearchCandidates(query);
  return ranked.slice(0, SEARCH_PANEL_MAX_ROWS);
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
  const originalTitle =
    data.original_name || data.original_title || data.name || data.title || null;
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
    originalTitle,
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
const _discoverDetailsCache = new Map();

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

async function getDiscoverDetails(mediaType, tmdbId) {
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (_discoverDetailsCache.has(cacheKey)) return _discoverDetailsCache.get(cacheKey);

  try {
    const data =
      mediaType === 'tv'
        ? await tmdbGet(`/tv/${tmdbId}`, {
            language: 'en-US',
            append_to_response: 'external_ids',
          })
        : await tmdbGet(`/movie/${tmdbId}`, { language: 'en-US' });
    const imdbId = data.imdb_id || data.external_ids?.imdb_id || null;
    const runtimeMinutes =
      mediaType === 'tv'
        ? (data.episode_run_time || []).find((v) => typeof v === 'number' && v > 0) || null
        : typeof data.runtime === 'number' && data.runtime > 0
          ? data.runtime
          : null;
    const rawSeasons =
      mediaType === 'tv'
        ? typeof data.number_of_seasons === 'number' && data.number_of_seasons > 0
          ? data.number_of_seasons
          : Array.isArray(data.seasons)
            ? data.seasons.filter((s) => s.season_number > 0).length
            : null
        : null;
    const numberOfSeasons = rawSeasons && rawSeasons > 0 ? rawSeasons : null;
    const details = { imdbId, runtimeMinutes, numberOfSeasons };
    _discoverDetailsCache.set(cacheKey, details);
    return details;
  } catch {
    const fallback = { imdbId: null, runtimeMinutes: null, numberOfSeasons: null };
    _discoverDetailsCache.set(cacheKey, fallback);
    return fallback;
  }
}

export async function enrichDiscoverResults(items = []) {
  if (!items.length) return [];

  return mapWithConcurrency(items, 4, async (item) => {
    const details = await getDiscoverDetails(item.mediaType, item.tmdbId);
    const imdbId = item.imdbId || details.imdbId;
    const runtimeMinutes = item.runtimeMinutes ?? details.runtimeMinutes;
    const numberOfSeasons = item.numberOfSeasons ?? details.numberOfSeasons ?? null;
    const omdbRatings = await fetchOmdbRatings(imdbId);

    return {
      ...item,
      imdbId,
      runtimeMinutes,
      ...(numberOfSeasons != null ? { numberOfSeasons } : {}),
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
 *   originCountries: string[],     // ISO 3166-1, movie + TV, e.g. ['US', 'KR']
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
function mapDiscoverRawItem(item, mediaType, extra = {}) {
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
    ...(item.original_language
      ? { originalLanguageCode: String(item.original_language).toLowerCase() }
      : {}),
    ...extra,
  };
}

export async function discoverTitles(filters = {}) {
  const { mediaType = 'movie' } = filters;
  const {
    params,
    excludedLanguageCodes,
    excludedOriginCountries,
    excludeKeys,
  } = buildDiscoverQueryParams(filters);

  const hasPostFetchExclude =
    excludeKeys.length > 0 ||
    excludedLanguageCodes.length > 0 ||
    excludedOriginCountries.length > 0;

  const filterRawItems = (items) =>
    hasPostFetchExclude
      ? items.filter(
          (item) =>
            !isExcludedBySmartFilters(item, excludeKeys, {
              excludedLanguageCodes,
              excludedOriginCountries,
            }),
        )
      : items;

  const minSeasons =
    mediaType === 'tv' && filters.minSeasons != null && String(filters.minSeasons).trim() !== ''
      ? parseInt(filters.minSeasons, 10)
      : null;
  const maxSeasons =
    mediaType === 'tv' && filters.maxSeasons != null && String(filters.maxSeasons).trim() !== ''
      ? parseInt(filters.maxSeasons, 10)
      : null;
  const hasSeasonsFilter =
    mediaType === 'tv' &&
    ((Number.isFinite(minSeasons) && minSeasons > 0) ||
      (Number.isFinite(maxSeasons) && maxSeasons > 0));

  if (!hasSeasonsFilter) {
    const data = await tmdbGet(`/discover/${mediaType}`, params);
    const filtered = filterRawItems(data.results || []);
    const results = filtered.map((item) => mapDiscoverRawItem(item, mediaType));
    const totalPages = data.total_pages || 1;
    const adjustedTotal =
      totalPages <= 1 ? results.length : Math.max(results.length, data.total_results || 0);

    return {
      results,
      totalResults: adjustedTotal,
      totalPages,
      page: data.page || 1,
    };
  }

  // ── TV Number-of-Seasons Filter Pipeline ──────────────────────────────────
  // TMDb's /discover/tv list endpoint does not expose a server-side season-count
  // parameter or include `number_of_seasons` on list items. We harvest 2 raw pages
  // per logical Discover page (and expand to 4 raw pages on page 1 if the initial
  // batch yields fewer than 6 matches), resolve `/tv/{id}` details in parallel via
  // the in-memory `_discoverDetailsCache`, filter by `[minSeasons, maxSeasons]`,
  // and compute an honest sample-scaled `totalResults`.
  const requestedPage = Number(filters.page) || 1;
  const rawPageStart = (requestedPage - 1) * 2 + 1;

  const firstPageData = await tmdbGet(`/discover/tv`, { ...params, page: rawPageStart });
  const rawTotalPages = firstPageData.total_pages || 1;
  const rawTotalResults = firstPageData.total_results || 0;

  let rawPagesScanned = 1;
  const rawCandidates = [...(firstPageData.results || [])];

  if (rawPageStart + 1 <= rawTotalPages) {
    const secondPageData = await tmdbGet(`/discover/tv`, {
      ...params,
      page: rawPageStart + 1,
    }).catch(() => ({ results: [] }));
    rawCandidates.push(...(secondPageData.results || []));
    rawPagesScanned += 1;
  }

  const seenIds = new Set();
  const dedupeRaw = (list) =>
    list.filter((item) => {
      if (!item?.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

  let candidates = filterRawItems(dedupeRaw(rawCandidates));
  let matched = [];

  const evaluateBatch = async (batch) => {
    const enrichedBatch = await mapWithConcurrency(batch, 6, async (item) => {
      const details = await getDiscoverDetails('tv', item.id);
      return { item, details };
    });
    for (const { item, details } of enrichedBatch) {
      if (matchesSeasonsRange(details.numberOfSeasons, minSeasons, maxSeasons)) {
        matched.push(
          mapDiscoverRawItem(item, 'tv', {
            ...(details.numberOfSeasons != null ? { numberOfSeasons: details.numberOfSeasons } : {}),
            ...(details.imdbId ? { imdbId: details.imdbId } : {}),
            ...(details.runtimeMinutes != null ? { runtimeMinutes: details.runtimeMinutes } : {}),
          }),
        );
      }
    }
  };

  await evaluateBatch(candidates);

  // On page 1, if a narrow season count (e.g. exact 3 seasons or 10+ seasons)
  // yielded fewer than 6 items in the first 2 raw pages and more pages exist,
  // scan up to 2 additional raw pages so the grid is well-populated.
  if (requestedPage === 1 && matched.length < 6 && rawTotalPages > rawPagesScanned) {
    const extraPageNums = [3, 4].filter((p) => p <= rawTotalPages);
    if (extraPageNums.length > 0) {
      const extraPages = await Promise.all(
        extraPageNums.map((p) =>
          tmdbGet(`/discover/tv`, { ...params, page: p }).catch(() => ({ results: [] })),
        ),
      );
      rawPagesScanned += extraPageNums.length;
      const extraCandidates = filterRawItems(
        dedupeRaw(extraPages.flatMap((p) => p.results || [])),
      );
      candidates = [...candidates, ...extraCandidates];
      await evaluateBatch(extraCandidates);
    }
  }

  const checkedCount = candidates.length;
  let estimatedTotal = matched.length;
  if (rawPagesScanned < rawTotalPages && checkedCount > 0) {
    if (matched.length > 0) {
      const matchRatio = matched.length / checkedCount;
      estimatedTotal = Math.max(matched.length, Math.round(rawTotalResults * matchRatio));
    } else {
      estimatedTotal = 0;
    }
  }

  const logicalTotalPages =
    rawPagesScanned >= rawTotalPages ? 1 : Math.max(1, Math.ceil(rawTotalPages / 2));

  return {
    results: matched,
    totalResults: estimatedTotal,
    totalPages: logicalTotalPages,
    page: requestedPage,
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
const TMDB_EXCLUDED_TV_GENRES = new Set([10767, 10763, 10764, 10766]); // Talk, News, Reality, Soap

function mapTmdbItem(item, mediaType = 'movie') {
  const dateValue = item.release_date || item.first_air_date || '';
  return {
    mediaType: item.media_type || mediaType,
    tmdbId: item.id,
    title: item.title || item.name || '(Untitled)',
    year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
    releaseDate: dateValue || null,
    synopsis: (item.overview || '').trim() || 'No synopsis available.',
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdropUrl: item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : null,
    ratingValue: item.vote_average || 0,
    rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    popularity: item.popularity || 0,
    voteCount: item.vote_count || 0,
    genreIds: item.genre_ids || [],
  };
}

/**
 * Fetch candidate movies playing in theatres for the given region.
 * Combines TMDb's /movie/now_playing with /discover/movie (filtered to wide release_type=3),
 * deduplicating and pre-filtering to drop catalog re-releases (> 90 days old) and unreleased titles.
 *
 * @param {{ region?: string, wideLookbackDays?: number, primaryLookbackDays?: number }} [options]
 */
export async function fetchNowPlayingCandidates({
  region = 'US',
  wideLookbackDays = 60,
  primaryLookbackDays = 90,
} = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const wideLookback = getOffsetDateYmd(today, -wideLookbackDays);
  const primaryLookback = getOffsetDateYmd(today, -primaryLookbackDays);

  const [np1, np2, disc1, disc2] = await Promise.all([
    tmdbGet('/movie/now_playing', { language: 'en-US', region, page: 1 }).catch(() => ({
      results: [],
    })),
    tmdbGet('/movie/now_playing', { language: 'en-US', region, page: 2 }).catch(() => ({
      results: [],
    })),
    tmdbGet('/discover/movie', {
      language: 'en-US',
      region,
      with_release_type: 3,
      'release_date.gte': wideLookback,
      'release_date.lte': today,
      'primary_release_date.gte': primaryLookback,
      sort_by: 'popularity.desc',
      include_adult: false,
      page: 1,
    }).catch(() => ({ results: [] })),
    tmdbGet('/discover/movie', {
      language: 'en-US',
      region,
      with_release_type: 3,
      'release_date.gte': wideLookback,
      'release_date.lte': today,
      'primary_release_date.gte': primaryLookback,
      sort_by: 'popularity.desc',
      include_adult: false,
      page: 2,
    }).catch(() => ({ results: [] })),
  ]);

  const raw = [
    ...(np1.results || []),
    ...(np2.results || []),
    ...(disc1.results || []),
    ...(disc2.results || []),
  ];

  const seen = new Set();
  const preFiltered = raw
    .filter((item) => {
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      if (!item.poster_path) return false;
      const relDate = item.release_date || '';
      if (relDate && (relDate < primaryLookback || relDate > today)) return false;
      return true;
    })
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return preFiltered.map((item) => mapTmdbItem(item, 'movie'));
}

/**
 * Fetch full movie detail including US release_dates and watch/providers.
 * Cached automatically via tmdbGet.
 *
 * @param {number|string} tmdbId
 */
export async function fetchMovieTheatricalDetail(tmdbId) {
  return tmdbGet(`/movie/${tmdbId}`, {
    language: 'en-US',
    append_to_response: 'release_dates,watch/providers',
  });
}

/**
 * Fetch high-velocity trending titles from TMDb for the week.
 * Filters out talk shows, news, reality, and soap operas from the TV side
 * to prevent daily episode churn from flooding the trending rail.
 *
 * @param {{ mediaType?: 'all'|'movie'|'tv', timeWindow?: 'day'|'week', limit?: number }} [options]
 */
export async function fetchTmdbTrendingTitles({
  mediaType = 'all',
  timeWindow = 'week',
  limit = 20,
} = {}) {
  if (mediaType === 'movie') {
    const data = await tmdbGet(`/trending/movie/${timeWindow}`, { language: 'en-US' });
    return (data.results || [])
      .map((m) => mapTmdbItem(m, 'movie'))
      .filter((x) => x.posterUrl)
      .slice(0, limit);
  }

  if (mediaType === 'tv') {
    const data = await tmdbGet(`/trending/tv/${timeWindow}`, { language: 'en-US' });
    const clean = (data.results || []).filter(
      (show) => !show.genre_ids?.some((g) => TMDB_EXCLUDED_TV_GENRES.has(g)),
    );
    return clean
      .map((t) => mapTmdbItem(t, 'tv'))
      .filter((x) => x.posterUrl)
      .slice(0, limit);
  }

  const perSide = Math.ceil(limit / 2) + 2;
  const [movieData, tvData] = await Promise.all([
    tmdbGet(`/trending/movie/${timeWindow}`, { language: 'en-US' }).catch(() => ({ results: [] })),
    tmdbGet(`/trending/tv/${timeWindow}`, { language: 'en-US' }).catch(() => ({ results: [] })),
  ]);

  const cleanShows = (tvData.results || []).filter(
    (show) => !show.genre_ids?.some((g) => TMDB_EXCLUDED_TV_GENRES.has(g)),
  );

  const movies = (movieData.results || []).map((m) => mapTmdbItem(m, 'movie'));
  const shows = cleanShows.map((t) => mapTmdbItem(t, 'tv'));

  const interleaved = dedupeRailItems(
    interleaveByPopularity(movies.slice(0, perSide), shows.slice(0, perSide)),
  );

  return interleaved.filter((item) => item.posterUrl).slice(0, limit);
}

/**
 * Backward-compatible helper for callers expecting now-playing candidates.
 */
export async function fetchNowPlayingMovies(options = {}) {
  return fetchNowPlayingCandidates(options);
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
    originalTitle: data.original_name || data.original_title || null,
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
  // Fetch combined credits and profile info concurrently
  const [creditsData, personData] = await Promise.all([
    tmdbGet(`/person/${personId}/combined_credits`, { language: 'en-US' }),
    tmdbGet(`/person/${personId}`, { language: 'en-US' }).catch(() => null),
  ]);

  const profileUrl = personData?.profile_path
    ? `https://image.tmdb.org/t/p/w185${personData.profile_path}`
    : null;

  const { rails, totalCreditsCount } = partitionFilmographyCredits(creditsData, role, 30);

  // Flatten unique credits across all rails for backward compatibility with results
  const results = [];
  const seen = new Set();
  for (const rail of rails) {
    for (const item of (rail.data || rail.credits || [])) {
      const key = `${item.mediaType}:${item.tmdbId}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
  }

  return {
    personName,
    role,
    results,
    rails,
    profileUrl,
    total: totalCreditsCount || results.length,
  };
}

/**
 * Fetches combined credits (/person/{personId}/combined_credits) along with person profile.
 * Used for partitioning filmography into role rails (Acting, Directing, Writing).
 *
 * @param {number} personId TMDB person ID
 * @param {string} [personName] Display name
 * @returns {Promise<{ personId: number, personName: string, profileUrl: string | null, cast: Array, crew: Array }>}
 */
export async function fetchPersonCombinedCredits(personId, personName) {
  const data = await tmdbGet(`/person/${personId}/combined_credits`, { language: 'en-US' });
  let profileUrl = null;
  try {
    const personData = await tmdbGet(`/person/${personId}`, { language: 'en-US' });
    profileUrl = personData?.profile_path
      ? `https://image.tmdb.org/t/p/w185${personData.profile_path}`
      : null;
  } catch {
    // Non-fatal if person profile endpoint fails
  }

  return {
    personId,
    personName,
    profileUrl,
    cast: Array.isArray(data?.cast) ? data.cast : [],
    crew: Array.isArray(data?.crew) ? data.crew : [],
  };
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

/**
 * Fetch full episode list for a specific season of a TV series.
 * @param {number | string} seriesId
 * @param {number | string} seasonNumber
 * @returns {Promise<Array<{
 *   id: number;
 *   episodeNumber: number;
 *   name: string;
 *   overview: string;
 *   airDate: string | null;
 *   runtimeMinutes: number | null;
 *   stillUrl: string | null;
 *   rating: string | null;
 * }>>}
 */
export async function fetchSeasonEpisodes(seriesId, seasonNumber) {
  if (!seriesId || seasonNumber == null) return [];
  try {
    const data = await tmdbGet(`/tv/${seriesId}/season/${seasonNumber}`, { language: 'en-US' });
    if (!data || !Array.isArray(data.episodes)) return [];
    return data.episodes.map((ep) => ({
      id: ep.id,
      episodeNumber: ep.episode_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: (ep.overview || '').trim(),
      airDate: ep.air_date || null,
      runtimeMinutes: ep.runtime || null,
      stillUrl: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
      rating:
        typeof ep.vote_average === 'number' && ep.vote_average > 0
          ? ep.vote_average.toFixed(1)
          : null,
    }));
  } catch {
    return [];
  }
}

