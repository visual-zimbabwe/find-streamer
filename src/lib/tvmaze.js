// TVmaze — free, keyless episode-schedule source (https://www.tvmaze.com/api).
//
// TMDb carries `next_episode_to_air`, but it is frequently null even for shows
// that are actively airing, and it never carries an air *time*. TVmaze fills
// both gaps: a reliable "what airs next" link and, for network shows, the local
// broadcast time. We look a show up by the IMDb id the detail resolve already
// has, then follow the show's `nextepisode` link to the episode payload.
//
// This is view-only enrichment: the next episode is time-sensitive and is never
// written into the watchlist store, only merged into the live Detail result.

const TVMAZE_BASE = 'https://api.tvmaze.com';

/** How long a single TVmaze leg may run before we give up (fire-and-forget). */
const TVMAZE_TIMEOUT_MS = 8000;

/**
 * imdbId → resolved next episode (or null). Cached for the session so revisiting
 * a title, or opening several with the same id, costs no extra requests. `null`
 * is cached too: a show with nothing scheduled shouldn't be re-fetched on every
 * open.
 * @type {Map<string, TvmazeNextEpisode | null>}
 */
const _nextEpisodeCache = new Map();

/**
 * @typedef {Object} TvmazeNextEpisode
 * @property {string|null} airstamp  Full ISO instant with offset, e.g. '2026-08-06T03:35:00+00:00'.
 * @property {string|null} airdate   Network-local calendar date 'YYYY-MM-DD'.
 * @property {string|null} airtime   Network-local 'HH:MM', or '' for streaming drops with no slot.
 * @property {number|null} season
 * @property {number|null} number
 * @property {string|null} name
 */

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TVMAZE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shape a raw TVmaze episode payload into our compact record, or null when the
 * payload is missing the fields that make it worth showing.
 * @param {any} episode
 * @returns {TvmazeNextEpisode | null}
 */
export function normalizeTvmazeEpisode(episode) {
  if (!episode || (!episode.airstamp && !episode.airdate)) return null;
  return {
    airstamp: typeof episode.airstamp === 'string' ? episode.airstamp : null,
    airdate: typeof episode.airdate === 'string' ? episode.airdate : null,
    airtime: typeof episode.airtime === 'string' ? episode.airtime : null,
    season: Number.isFinite(episode.season) ? episode.season : null,
    number: Number.isFinite(episode.number) ? episode.number : null,
    name: typeof episode.name === 'string' && episode.name.trim() ? episode.name : null,
  };
}

/**
 * The next scheduled episode for a TV series, looked up by IMDb id. Two legs:
 * resolve the show (`/lookup/shows?imdb=…`, which 301s to the canonical show and
 * exposes a `nextepisode` link only when one is scheduled), then fetch that
 * episode. Returns null — never throws — for shows with nothing upcoming, an
 * unknown id, or any network trouble; enrichment is best-effort.
 *
 * @param {string|null|undefined} imdbId  e.g. 'tt3444938'
 * @returns {Promise<TvmazeNextEpisode | null>}
 */
export async function fetchTvmazeNextEpisode(imdbId) {
  if (!imdbId) return null;
  if (_nextEpisodeCache.has(imdbId)) return _nextEpisodeCache.get(imdbId);

  const show = await fetchJson(`${TVMAZE_BASE}/lookup/shows?imdb=${encodeURIComponent(imdbId)}`);
  const nextHref = show?._links?.nextepisode?.href;
  if (!nextHref) {
    _nextEpisodeCache.set(imdbId, null);
    return null;
  }

  const episode = await fetchJson(nextHref);
  const normalized = normalizeTvmazeEpisode(episode);
  _nextEpisodeCache.set(imdbId, normalized);
  return normalized;
}

/** Test-only: drop the session cache so cases don't leak into each other. */
export function _clearTvmazeCache() {
  _nextEpisodeCache.clear();
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Parse a 'YYYY-MM-DD' string as a local calendar date (no timezone shift). */
function parseLocalDate(isoDate) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** Today / Tomorrow / weekday within a week / 'Mon D' (with year if not this year). */
function relativeDayLabel(dayStart, now) {
  const today = startOfLocalDay(now);
  const diffDays = Math.round((dayStart.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays < 7) {
    return dayStart.toLocaleDateString(undefined, { weekday: 'long' });
  }
  const sameYear = dayStart.getFullYear() === now.getFullYear();
  return dayStart.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * A compact "Next …" label for a series summary line, or null when there is
 * nothing datable. Network shows (a real `airtime`) get their local broadcast
 * time from the precise `airstamp`; streaming drops (blank `airtime`, whose
 * `airstamp` is only a placeholder noon-UTC) show the calendar day alone so we
 * never print an invented time.
 *
 * @param {TvmazeNextEpisode | null | undefined} nextEpisode
 * @param {Date} [now]
 * @returns {string | null}  e.g. 'Next Thu, 9:35 PM' or 'Next Tomorrow'
 */
export function formatNextEpisodeLabel(nextEpisode, now = new Date()) {
  if (!nextEpisode) return null;
  const { airstamp, airdate, airtime } = nextEpisode;
  const hasTime = typeof airtime === 'string' && /^\d{1,2}:\d{2}$/.test(airtime.trim());

  if (hasTime && airstamp) {
    const instant = new Date(airstamp);
    if (!Number.isNaN(instant.getTime())) {
      const dayLabel = relativeDayLabel(startOfLocalDay(instant), now);
      const timeLabel = instant.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `Next ${dayLabel}, ${timeLabel}`;
    }
  }

  const dayStart = airdate ? parseLocalDate(airdate) : null;
  if (dayStart) return `Next ${relativeDayLabel(dayStart, now)}`;
  return null;
}
