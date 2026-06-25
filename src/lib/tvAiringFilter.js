export const AIR_DATE_SORT = 'air_date.asc';

function parseLocalDateString(isoDate) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Today through Sunday of the current week (device local time). */
export function getAiringWindow(now = new Date()) {
  const start = startOfLocalDay(now);
  const day = start.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const end = new Date(start);
  end.setDate(end.getDate() + daysUntilSunday);
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

export async function filterDiscoverResultsByAiring(items = [], now = new Date()) {
  if (!items.length) return [];

  const { getTvShowNextEpisode } = await import('./tmdb');

  const enriched = await mapWithConcurrency(items, 3, async (item) => {
    if (item.mediaType !== 'tv') return null;

    try {
      const nextEpisode = await getTvShowNextEpisode(item.tmdbId);
      if (!nextEpisode?.airDate || !isInAiringWindow(nextEpisode.airDate, now)) {
        return null;
      }

      return {
        ...item,
        airDate: nextEpisode.airDate,
        airDay: formatAirDayLabel(nextEpisode.airDate, now),
      };
    } catch {
      return null;
    }
  });

  return enriched.filter(Boolean);
}

export function effectiveDiscoverSortBy(sortBy) {
  if (sortBy === AIR_DATE_SORT) return 'popularity.desc';
  return sortBy;
}
