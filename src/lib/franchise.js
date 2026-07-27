/**
 * Franchise (TMDb collection) presentation logic.
 *
 * TMDb's `/collection/{id}` `parts` array is a list of *entries*, not a list of
 * films you can watch: across 100 popular movies, 18.4% of the parts rendered on
 * screen were unreleased or had no date at all — "Avatar 5 (2031)", "Untitled
 * Michael Sequel", "Mortal Kombat III". The rail used to count and style those
 * identically to the films that exist, so a badge reading "5 films" sat above a
 * set of which three were real. Everything here exists to keep that distinction
 * visible: what has come out, what is dated but not out, and what is only
 * announced.
 *
 * Release state is derived at RENDER time, never at fetch time — a part cached
 * or resolved before its release date would otherwise stay "upcoming" forever.
 */

export const RELEASED = 'released';
export const UPCOMING = 'upcoming';
export const UNSCHEDULED = 'unscheduled';

/** How many tiles the inline rail shows before deferring to the See-all screen. */
export const FRANCHISE_RAIL_CAP = 10;

/** Tiles of leading context kept before the current title when the rail is windowed. */
const WINDOW_LEAD = 2;

function plural(count, singular, suffix = 's') {
  return `${count} ${count === 1 ? singular : singular + suffix}`;
}

/**
 * Local calendar date as `YYYY-MM-DD`, which is the shape TMDb uses for
 * `release_date`. Compared as strings so no timezone parsing is involved.
 */
export function isoDay(now = Date.now()) {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * @param {{ releaseDate?: string | null }} part
 * @returns {'released' | 'upcoming' | 'unscheduled'}
 */
export function releaseStateFor(part, now = Date.now()) {
  const releaseDate = part?.releaseDate;
  if (typeof releaseDate !== 'string' || releaseDate.length < 10) return UNSCHEDULED;
  return releaseDate > isoDay(now) ? UPCOMING : RELEASED;
}

/**
 * @returns {{ total: number, released: number, upcoming: number, unscheduled: number, pending: number }}
 */
export function summarizeFranchise(parts = [], now = Date.now()) {
  const summary = { total: 0, released: 0, upcoming: 0, unscheduled: 0, pending: 0 };
  (parts || []).forEach((part) => {
    summary.total += 1;
    summary[releaseStateFor(part, now)] += 1;
  });
  summary.pending = summary.upcoming + summary.unscheduled;
  return summary;
}

/**
 * The header count. Announced-but-undated entries are folded in with the dated
 * ones here ("upcoming" covers both) — the tile itself is where the difference
 * between "2029" and "no date at all" is worth the words.
 */
export function franchiseCountLabel(parts = [], now = Date.now()) {
  const { released, pending } = summarizeFranchise(parts, now);
  if (!released && !pending) return '';
  if (!released) return `${plural(pending, 'upcoming film')}`;
  if (!pending) return plural(released, 'film');
  return `${plural(released, 'film')} · ${pending} upcoming`;
}

/**
 * The line under a tile's title. The current title keeps its "Current" marker —
 * it is the only orienting signal in a rail that can be 27 tiles long, and the
 * gold outline plus the muted order badge already carry the release state.
 */
export function franchiseTileMeta({ year, state, isCurrent }) {
  const hasYear = year && year !== 'N/A';
  if (isCurrent) return hasYear ? `${year} · Current` : 'Current';
  if (state === UPCOMING) return hasYear ? `${year} · Upcoming` : 'Upcoming';
  if (state === UNSCHEDULED) return 'Date TBA';
  return hasYear ? String(year) : '';
}

/**
 * TalkBack reads a collapsed TouchableOpacity as one node, so the order badge
 * and the year — both plain text children — are invisible to it unless they are
 * folded in here.
 */
export function franchiseTileA11yLabel({ title, order, total, year, state, isCurrent }) {
  const position = `${order} of ${total}.`;
  const hasYear = year && year !== 'N/A';
  if (isCurrent) {
    return `${position} ${title}${hasYear ? `, ${year}` : ''}. Current title.`;
  }
  if (state === UPCOMING) {
    return `${position} ${title}, upcoming${hasYear ? ` ${year}` : ''}. Open details.`;
  }
  if (state === UNSCHEDULED) {
    return `${position} ${title}, release date to be announced. Open details.`;
  }
  return `${position} ${title}${hasYear ? `, ${year}` : ''}. Open details.`;
}

/**
 * A window of at most `cap` tiles that ALWAYS contains the current title.
 *
 * Head-truncating a long collection would have hidden the one tile the user is
 * standing on: the James Bond collection is 27 entries and Skyfall is the 24th,
 * so a plain `slice(0, 10)` would show Dr. No through Moonraker and nothing the
 * reader came for. Each item keeps `order` — its position in the FULL
 * collection — so the badges stay honest when the window is offset.
 */
export function franchiseRailWindow(parts = [], currentTmdbId, cap = FRANCHISE_RAIL_CAP) {
  const list = parts || [];
  const total = list.length;
  const currentIndex = list.findIndex((part) => part?.tmdbId === currentTmdbId);

  let start = 0;
  if (total > cap) {
    const anchor = currentIndex >= 0 ? currentIndex : 0;
    start = Math.max(0, Math.min(anchor - WINDOW_LEAD, total - cap));
  }

  const items = list.slice(start, start + cap).map((part, index) => ({
    ...part,
    order: start + index + 1,
  }));

  return {
    items,
    start,
    total,
    hasMore: total > items.length,
    /** Index of the current title WITHIN the window, or -1. */
    currentWindowIndex: currentIndex >= 0 ? currentIndex - start : -1,
  };
}
