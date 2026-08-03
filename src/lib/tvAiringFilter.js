export const AIR_DATE_SORT = 'air_date.asc';

// How many days the "Airing this week" window spans, counting today. A rolling
// 7-day horizon (today + 6) so "this week" always means a week — it no longer
// shrinks to a single day as the calendar week runs out (the old today→Sunday
// window collapsed to "today only" every Sunday).
const AIRING_WINDOW_DAYS = 7;

function parseLocalDateString(isoDate) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `YYYY-MM-DD` in the device's local calendar (no UTC shift from toISOString). */
export function formatLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today through the next 6 days (a rolling 7-day week), device local time. */
export function getAiringWindow(now = new Date()) {
  const start = startOfLocalDay(now);
  const end = new Date(start);
  end.setDate(end.getDate() + (AIRING_WINDOW_DAYS - 1));
  return { start, end };
}

export function isInAiringWindow(airDateStr, now = new Date()) {
  if (!airDateStr || airDateStr.length < 10) return false;

  const air = parseLocalDateString(airDateStr);
  const { start, end } = getAiringWindow(now);
  return air >= start && air <= end;
}

export function formatAirDayLabel(airDateStr, now = new Date()) {
  const air = parseLocalDateString(airDateStr);
  const today = startOfLocalDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (air.getTime() === today.getTime()) return 'Today';
  if (air.getTime() === tomorrow.getTime()) return 'Tomorrow';
  // Within a 7-day horizon every day maps to a distinct weekday, so the bare
  // weekday name is unambiguous.
  return air.toLocaleDateString(undefined, { weekday: 'long' });
}

export function sortByAirDateAsc(items = []) {
  return [...items].sort((a, b) => {
    const airDateCompare = (a.airDate || '').localeCompare(b.airDate || '');
    if (airDateCompare !== 0) return airDateCompare;
    return (a.title || '').localeCompare(b.title || '');
  });
}

async function mapWithConcurrency(items, limit, task) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Best-effort day-label enrichment for an already-airing-filtered page.
 *
 * The airing-this-week SET is now decided server-side via TMDb's
 * `air_date.gte`/`air_date.lte` on /discover/tv (catalog-complete, real count,
 * native pagination) — see discoverTitles. This pass no longer GATES inclusion;
 * it only stamps a friendly `airDay` ("Today" / "Tomorrow" / weekday) so the
 * grid can read like a schedule. It's fired non-blocking, exactly like the OMDb
 * ratings enrichment, so results paint instantly and the day labels fill in.
 *
 * Every input item is returned (enriched or untouched); items whose next
 * episode can't be resolved, or whose next episode falls outside the window,
 * simply keep no `airDay` and fall back to their release year in the UI.
 */
export async function enrichResultsWithAirDay(items = [], now = new Date()) {
  if (!items.length) return items;

  const { getTvShowNextEpisode } = await import('./tmdb');

  return mapWithConcurrency(items, 3, async (item) => {
    if (item.mediaType !== 'tv') return item;

    try {
      const nextEpisode = await getTvShowNextEpisode(item.tmdbId);
      if (!nextEpisode?.airDate || !isInAiringWindow(nextEpisode.airDate, now)) {
        return item;
      }

      return {
        ...item,
        airDate: nextEpisode.airDate,
        airDay: formatAirDayLabel(nextEpisode.airDate, now),
      };
    } catch {
      return item;
    }
  });
}

export function effectiveDiscoverSortBy(sortBy) {
  if (sortBy === AIR_DATE_SORT) return 'popularity.desc';
  return sortBy;
}
