// ─── Genre / Smart-filter tri-state grammar ───────────────────────────────────
// One control, two gestures: TAP toggles "want it" (neutral ↔ include), HOLD
// toggles "don't want it" (any state ↔ exclude). This is the contract that
// replaces the old tap-to-cycle mechanic where reaching EXCLUDE forced a
// transient INCLUDE of the exact genre being rejected. Pure module so the state
// machine is unit-tested independently of React and the view model.

export const GENRE_STATE = {
  NEUTRAL: 'neutral',
  INCLUDE: 'include',
  EXCLUDE: 'exclude',
};

/**
 * Current tri-state of a genre id given the live filters.
 * @param {number|string} id
 * @param {{ genreIds?: any[], excludeGenreIds?: any[] }} filters
 * @returns {'neutral'|'include'|'exclude'}
 */
export function genreStateFor(id, filters = {}) {
  if (Array.isArray(filters.genreIds) && filters.genreIds.includes(id)) return GENRE_STATE.INCLUDE;
  if (Array.isArray(filters.excludeGenreIds) && filters.excludeGenreIds.includes(id)) {
    return GENRE_STATE.EXCLUDE;
  }
  return GENRE_STATE.NEUTRAL;
}

/**
 * Current tri-state of a smart-filter key given the live filters.
 * @param {string} key
 * @param {{ includeSmartTags?: any[], excludeSmartTags?: any[] }} filters
 * @returns {'neutral'|'include'|'exclude'}
 */
export function smartTagStateFor(key, filters = {}) {
  if (Array.isArray(filters.includeSmartTags) && filters.includeSmartTags.includes(key)) {
    return GENRE_STATE.INCLUDE;
  }
  if (Array.isArray(filters.excludeSmartTags) && filters.excludeSmartTags.includes(key)) {
    return GENRE_STATE.EXCLUDE;
  }
  return GENRE_STATE.NEUTRAL;
}

/**
 * The next state for a gesture. Tap toggles include (and clears an exclude);
 * hold toggles exclude (from any state, and clears back to neutral). Exclude is
 * therefore always ONE hold away — never routed through include first.
 * @param {'neutral'|'include'|'exclude'} current
 * @param {'tap'|'hold'} gesture
 * @returns {'neutral'|'include'|'exclude'}
 */
export function reduceTriState(current, gesture) {
  if (gesture === 'tap') {
    return current === GENRE_STATE.INCLUDE || current === GENRE_STATE.EXCLUDE
      ? GENRE_STATE.NEUTRAL
      : GENRE_STATE.INCLUDE;
  }
  // hold
  return current === GENRE_STATE.EXCLUDE ? GENRE_STATE.NEUTRAL : GENRE_STATE.EXCLUDE;
}
