// ─── Discover numeric range helpers ──────────────────────────────────────────
// Pure mapping + formatting between the Discover view-model's string filter
// model (minRating '7', fromYear '', …) and the numeric world a slider works in,
// plus the human-readable readouts the section headers show so the current bound
// is always legible (the "hidden 7.0 floor" fix).
//
// Kept pure and separate so DiscoverScreen stays lean and this is unit-testable,
// matching the house pattern (railPicker / franchise / titleMeta / searchRanker).

export const RATING_MIN = 0;
export const RATING_MAX = 10;
export const RATING_STEP = 0.5;
export const RATING_CUSTOM_STEP = 0.1;

export const YEAR_MIN = 1900;
// One year past "now" so genuinely upcoming titles are reachable, but not the
// +5 slop validate() tolerates for hand-typed years — a slider can't fat-finger.
export function yearMax(now = new Date()) {
  return now.getFullYear() + 1;
}

export const RUNTIME_MIN = 0;
export const RUNTIME_MAX = 360; // 6h covers the entire practical catalogue
export const RUNTIME_STEP = 5;

export const SEASONS_MIN = 1;
export const SEASONS_MAX = 25;
export const SEASONS_STEP = 1;

// ── Rating ────────────────────────────────────────────────────────────────────
// Rating always has a range (0–10); there is no "unset" thumb. An empty/zero
// low maps to the RATING_MIN extreme, an empty/high-max maps to RATING_MAX.

function toNum(value) {
  if (value == null || String(value).trim() === '') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function ratingLowFromFilters(minRating) {
  const n = toNum(minRating);
  if (n == null) return RATING_MIN;
  return clamp(n, RATING_MIN, RATING_MAX);
}

export function ratingHighFromFilters(maxRating) {
  const n = toNum(maxRating);
  if (n == null) return RATING_MAX;
  return clamp(n, RATING_MIN, RATING_MAX);
}

// Write back as strings the existing normalizeAppliedRating pipeline understands.
// Low at the floor → '0' (→ null → no vote_average.gte). High at the ceiling →
// '10.0' (harmless no-op lte, and matches the shipped default so the count is
// unchanged when the user never touches rating).
export function ratingFiltersFromRange(low, high) {
  return {
    minRating: low <= RATING_MIN ? '0' : low.toFixed(1),
    maxRating: high >= RATING_MAX ? '10.0' : high.toFixed(1),
  };
}

// ── Year ──────────────────────────────────────────────────────────────────────
// Thumb-at-extreme = unbounded, so a full-width slider is "Any year" and the API
// query stays unconstrained (matching the empty-string default).

export function yearLowFromFilters(fromYear) {
  const n = toNum(fromYear);
  if (n == null) return YEAR_MIN;
  return clamp(Math.round(n), YEAR_MIN, yearMax());
}

export function yearHighFromFilters(toYear) {
  const n = toNum(toYear);
  if (n == null) return yearMax();
  return clamp(Math.round(n), YEAR_MIN, yearMax());
}

export function yearFiltersFromRange(low, high, now = new Date()) {
  const hi = yearMax(now);
  return {
    fromYear: low <= YEAR_MIN ? '' : String(Math.round(low)),
    toYear: high >= hi ? '' : String(Math.round(high)),
  };
}

// ── Runtime ─────────────────────────────────────────────────────────────────
export function runtimeLowFromFilters(minRuntime) {
  const n = toNum(minRuntime);
  if (n == null) return RUNTIME_MIN;
  return clamp(Math.round(n), RUNTIME_MIN, RUNTIME_MAX);
}

export function runtimeHighFromFilters(maxRuntime) {
  const n = toNum(maxRuntime);
  if (n == null) return RUNTIME_MAX;
  return clamp(Math.round(n), RUNTIME_MIN, RUNTIME_MAX);
}

export function runtimeFiltersFromRange(low, high) {
  return {
    minRuntime: low <= RUNTIME_MIN ? '' : String(Math.round(low)),
    maxRuntime: high >= RUNTIME_MAX ? '' : String(Math.round(high)),
  };
}

// ── Seasons (TV only) ───────────────────────────────────────────────────────
export function seasonsLowFromFilters(minSeasons) {
  const n = toNum(minSeasons);
  if (n == null || n <= 0) return SEASONS_MIN;
  return clamp(Math.round(n), SEASONS_MIN, SEASONS_MAX);
}

export function seasonsHighFromFilters(maxSeasons) {
  const n = toNum(maxSeasons);
  if (n == null || n <= 0) return SEASONS_MAX;
  return clamp(Math.round(n), SEASONS_MIN, SEASONS_MAX);
}

export function seasonsFiltersFromRange(low, high) {
  const lo = Math.max(SEASONS_MIN, Math.round(low));
  const hi = Math.max(SEASONS_MIN, Math.round(high));
  if (lo <= SEASONS_MIN && hi >= SEASONS_MAX) {
    return { minSeasons: '', maxSeasons: '' };
  }
  return {
    minSeasons: String(lo),
    maxSeasons: hi >= SEASONS_MAX ? '' : String(hi),
  };
}

// ── Readouts (the legible active-state the section headers show) ──────────────

// Trim a one-decimal rating for display: 7.0 → "7", 6.5 → "6.5", 7.3 → "7.3".
export function ratingText(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatRatingRange(minRating, maxRating) {
  const low = ratingLowFromFilters(minRating);
  const high = ratingHighFromFilters(maxRating);
  if (low <= RATING_MIN && high >= RATING_MAX) return 'Any rating';
  if (minRating && maxRating && String(minRating) === String(maxRating)) {
    return `${ratingText(low)}`;
  }
  if (high >= RATING_MAX) return `${ratingText(low)}+`;
  if (low <= RATING_MIN) return `Up to ${ratingText(high)}`;
  return `${ratingText(low)} – ${ratingText(high)}`;
}

export function formatYearRange(fromYear, toYear, now = new Date()) {
  const low = yearLowFromFilters(fromYear);
  const high = yearHighFromFilters(toYear);
  const hi = yearMax(now);
  if (low <= YEAR_MIN && high >= hi) return 'Any year';
  if (fromYear && toYear && String(fromYear) === String(toYear)) {
    return `${fromYear}`;
  }
  if (high >= hi) return `${low} – now`;
  if (low <= YEAR_MIN) return `Up to ${high}`;
  return `${low} – ${high}`;
}

export function formatRuntimeRange(minRuntime, maxRuntime) {
  const low = runtimeLowFromFilters(minRuntime);
  const high = runtimeHighFromFilters(maxRuntime);
  if (low <= RUNTIME_MIN && high >= RUNTIME_MAX) return 'Any length';
  if (minRuntime && maxRuntime && String(minRuntime) === String(maxRuntime)) {
    return `${minRuntime} min`;
  }
  if (high >= RUNTIME_MAX) return `${low}+ min`;
  if (low <= RUNTIME_MIN) return `Up to ${high} min`;
  return `${low} – ${high} min`;
}

export function formatSeasonsRange(minSeasons, maxSeasons) {
  const minVal = toNum(minSeasons);
  const maxVal = toNum(maxSeasons);
  const hasMin = minVal != null && minVal > 0;
  const hasMax = maxVal != null && maxVal > 0;
  if (!hasMin && !hasMax) return 'Any seasons';

  const low = hasMin ? Math.round(minVal) : SEASONS_MIN;
  const high = hasMax ? Math.round(maxVal) : SEASONS_MAX;

  if (hasMin && hasMax && low === high) {
    return low === 1 ? '1 season' : `${low} seasons`;
  }
  if (hasMin && !hasMax) {
    return `${low}+ seasons`;
  }
  if (!hasMin && hasMax) {
    return high === 1 ? '1 season' : `Up to ${high} seasons`;
  }
  return `${low} – ${high} seasons`;
}

export function formatSeasonsCountLabel(numberOfSeasons) {
  const n = toNum(numberOfSeasons);
  if (n == null || n <= 0) return null;
  const count = Math.round(n);
  return count === 1 ? '1 season' : `${count} seasons`;
}

/** Format minutes into human-readable hours and minutes (e.g. 105 -> "1h 45m", 90 -> "1h 30m", 120 -> "2h") */
export function formatRuntimeHours(mins) {
  const m = parseInt(mins, 10);
  if (isNaN(m) || m <= 0) return '';
  const hours = Math.floor(m / 60);
  const remaining = m % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

// ── Operator Modes ──────────────────────────────────────────────────────────

export const YEAR_MODES = [
  { id: 'ANY', label: 'Any' },
  { id: 'AFTER', label: 'After' },
  { id: 'BEFORE', label: 'Before' },
  { id: 'BETWEEN', label: 'Between' },
  { id: 'EXACT', label: 'Exact' },
];

export function getYearMode(fromYear, toYear) {
  const hasFrom = fromYear != null && String(fromYear).trim() !== '';
  const hasTo = toYear != null && String(toYear).trim() !== '';
  if (!hasFrom && !hasTo) return 'ANY';
  if (hasFrom && hasTo && String(fromYear).trim() === String(toYear).trim()) return 'EXACT';
  if (hasFrom && !hasTo) return 'AFTER';
  if (!hasFrom && hasTo) return 'BEFORE';
  return 'BETWEEN';
}

export const RUNTIME_MODES = [
  { id: 'ANY', label: 'Any' },
  { id: 'UNDER', label: 'Under' },
  { id: 'OVER', label: 'Over' },
  { id: 'BETWEEN', label: 'Between' },
];

export function getRuntimeMode(minRuntime, maxRuntime) {
  const hasMin = minRuntime != null && String(minRuntime).trim() !== '';
  const hasMax = maxRuntime != null && String(maxRuntime).trim() !== '';
  if (!hasMin && !hasMax) return 'ANY';
  if (!hasMin && hasMax) return 'UNDER';
  if (hasMin && !hasMax) return 'OVER';
  return 'BETWEEN';
}

export const RATING_PRESETS = [
  { id: 'ANY', label: 'Any', min: '0', max: '10.0' },
  { id: '6.0+', label: '6+', min: '6.0', max: '10.0' },
  { id: '7.0+', label: '7+', min: '7.0', max: '10.0' },
  { id: '8.0+', label: '8+', min: '8.0', max: '10.0' },
  { id: 'CUSTOM', label: 'Custom', min: null, max: null },
];

export function getRatingMode(minRating, maxRating) {
  const min = toNum(minRating);
  const max = toNum(maxRating);
  const isFloor = min == null || min <= RATING_MIN;
  const isCeil = max == null || max >= RATING_MAX;

  if (isFloor && isCeil) return 'ANY';
  if (min === 6.0 && isCeil) return '6.0+';
  if ((min === 7.0 || min === 7) && isCeil) return '7.0+';
  if (min === 8.0 && isCeil) return '8.0+';
  return 'CUSTOM';
}

export const SEASONS_PRESETS = [
  { id: 'ANY', label: 'Any', min: '', max: '' },
  { id: '1', label: '1', min: '1', max: '1' },
  { id: '2', label: '2', min: '2', max: '2' },
  { id: '3', label: '3', min: '3', max: '3' },
  { id: '5+', label: '5+ (Long)', min: '5', max: '' },
  { id: 'CUSTOM', label: 'Custom', min: null, max: null },
];

export const TV_STATUS_PRESETS = [
  { id: 'ANY', label: 'Any', value: '' },
  { id: 'RETURNING', label: 'Returning', value: 'returning' },
  { id: 'ENDED', label: 'Ended', value: 'ended' },
];

export function getTvStatusMode(tvStatus) {
  const s = String(tvStatus || '').toLowerCase();
  if (s === 'returning' || s === '0') return 'RETURNING';
  if (s === 'ended' || s === '3') return 'ENDED';
  return 'ANY';
}

export function formatTvStatus(tvStatus) {
  const mode = getTvStatusMode(tvStatus);
  if (mode === 'RETURNING') return 'Returning series';
  if (mode === 'ENDED') return 'Ended';
  return 'Any status';
}

export const SEASONS_SUB_MODES = [
  { id: 'EXACT', label: 'Exact' },
  { id: 'OVER', label: 'At least' },
  { id: 'UNDER', label: 'Up to' },
  { id: 'BETWEEN', label: 'Between' },
];

export function getSeasonsMode(minSeasons, maxSeasons) {
  const minVal = toNum(minSeasons);
  const maxVal = toNum(maxSeasons);
  const hasMin = minVal != null && minVal > 0;
  const hasMax = maxVal != null && maxVal > 0;

  if (!hasMin && !hasMax) return 'ANY';
  const min = hasMin ? Math.round(minVal) : null;
  const max = hasMax ? Math.round(maxVal) : null;

  if (min === 1 && max === 1) return '1';
  if (min === 2 && max === 2) return '2';
  if (min === 3 && max === 3) return '3';
  if (min === 5 && !hasMax) return '5+';
  return 'CUSTOM';
}

export function getSeasonsSubMode(minSeasons, maxSeasons) {
  const minVal = toNum(minSeasons);
  const maxVal = toNum(maxSeasons);
  const hasMin = minVal != null && minVal > 0;
  const hasMax = maxVal != null && maxVal > 0;

  if (hasMin && hasMax && Math.round(minVal) === Math.round(maxVal)) return 'EXACT';
  if (hasMin && !hasMax) return 'OVER';
  if (!hasMin && hasMax) return 'UNDER';
  if (hasMin && hasMax) return 'BETWEEN';
  return 'EXACT';
}

export function matchesSeasonsRange(numberOfSeasons, minSeasons, maxSeasons) {
  const min = toNum(minSeasons);
  const max = toNum(maxSeasons);
  const hasMin = min != null && min > 0;
  const hasMax = max != null && max > 0;
  if (!hasMin && !hasMax) return true;
  const count = toNum(numberOfSeasons);
  if (count == null || count <= 0) return false;
  if (hasMin && count < Math.round(min)) return false;
  if (hasMax && count > Math.round(max)) return false;
  return true;
}

// ── Ambient distributions (rec 5) ─────────────────────────────────────────────
// Static, approximate normalized weights for the histogram drawn behind the
// rating and year sliders. These are deliberately NOT live per-filter counts —
// TMDb has no cheap distribution endpoint, so these are a fixed orientation curve
// (where the catalogue's mass sits). The in-range highlight IS live; the curve is
// not. Shapes reflect the well-known TMDb skew: ratings cluster ~6–7, the
// catalogue skews heavily to recent decades.
export const RATING_DISTRIBUTION = [
  0.02, 0.02, 0.03, 0.04, 0.06, 0.09, 0.14, 0.22, 0.34, 0.5, 0.68, 0.86, 1.0, 0.92, 0.66, 0.42,
  0.24, 0.12, 0.05, 0.02,
]; // 20 buckets across 0–10 (0.5 wide)

export const YEAR_DISTRIBUTION = [
  0.03, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.14, 0.2, 0.32, 0.55, 0.85, 1.0,
]; // 13 buckets across YEAR_MIN–yearMax (~decade wide)

// ── util ──────────────────────────────────────────────────────────────────────
export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(n, hi));
}
