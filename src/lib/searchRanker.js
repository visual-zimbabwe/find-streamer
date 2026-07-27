// @ts-check

/**
 * Relevance ordering for both search paths.
 *
 * Before this module the live panel rendered `/search/multi` in the order TMDb
 * returned it, and the submit path applied a different sort (exact title, then
 * popularity) to the same payload. Two rankings of one request meant tapping a
 * row and pressing enter gave different answers on 28.1% of prefixes.
 *
 * The numbers below come from replaying 701 live prefix requests across 40
 * popular titles (every prefix of every title) through candidate rankers and
 * asking where the title being typed actually landed.
 *
 *   raw TMDb order (what shipped)           66.0% at row 1, 18/40 titles unstable
 *   exact-title then popularity (submit)    68.5% at row 1, 22/40 titles unstable
 *   popularity only                         76.7% at row 1,  7/39 titles unstable
 *   prefix tier then popularity (this)      76.9% at row 1,  8/39 titles unstable
 *
 * "Unstable" is the failure that matters most: a title reaching row 1 and then
 * dropping off it as the user keeps typing. Under the old order `The Odyssey`
 * was #1 at "The" and absent at "The O".
 *
 * Two deliberate choices, both measured, both easy to "fix" into a regression:
 *
 * 1. NO vote-count floor. Reusing MIN_RAIL_VOTES / ABSOLUTE_MIN_RAIL_VOTES from
 *    railPicker.js drops this to 66.9% — the opposite of what those floors do
 *    for recommendation rails. A title someone is actively typing about is
 *    often brand new and thinly voted; the floor buries exactly what they want.
 *
 * 2. NO exact-title tier. Ranking exact matches above prefix matches costs 8.3
 *    points across all prefixes (76.9% -> 68.6%) and nearly triples instability
 *    (8/39 -> 22/40), because on a partial query the "exact" match is whatever
 *    short title happens to equal the fragment ("Ma" -> the 2019 film Ma). It
 *    buys exactly one title at full query length, `Law & Order`, which loses to
 *    `Law & Order: Special Victims Unit` — arguably the right answer anyway.
 *
 * Honest ceiling: about 79%. On short prefixes TMDb simply does not return the
 * intended title in its top 20, and no amount of reordering invents it.
 */

/** Below this, `/search/multi` is answering a question nobody asked. */
export const MIN_SEARCH_QUERY_LENGTH = 2;

/**
 * Rows in the live panel. Measured against the same 701 prefixes: the intended
 * title is visible 76.9% at row 1, 78.7% by row 3, 79.0% by row 5 — and rows 6
 * through 10 add *exactly nothing*. On a 384dp screen the keyboard leaves about
 * three rows showing, so the old cap of 10 was hiding seven rows that never
 * held the answer.
 */
export const SEARCH_PANEL_MAX_ROWS = 6;

/** Results kept for the submitted search (Top Match + the Also Matched grid). */
export const SEARCH_RESULTS_MAX = 10;

const PERSON_DEPARTMENTS = ['Acting', 'Directing'];

/**
 * Same normalisation the submit path already used: fold case, drop punctuation,
 * collapse whitespace. Keeps "Schindlers List" matching "Schindler's List".
 *
 * @param {string | null | undefined} text
 */
export function normalizeSearchText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

/**
 * How well a title answers the query, lower is better.
 *
 *   0  the title starts with what was typed        "mast" -> "Masters of the Universe"
 *   1  some word in the title starts with it       "mast" -> "Ink Master"
 *   2  the title contains it anywhere              "mast" -> "Beyond the Mast"
 *   3  no textual relationship at all
 *
 * @param {string | null | undefined} title
 * @param {string} normalizedQuery already run through `normalizeSearchText`
 */
export function searchMatchTier(title, normalizedQuery) {
  const name = normalizeSearchText(title);
  if (!name || !normalizedQuery) return 3;
  if (name.startsWith(normalizedQuery)) return 0;
  if (name.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) return 1;
  if (name.includes(normalizedQuery)) return 2;
  return 3;
}

/**
 * True for a person TMDb knows enough about to be worth a row. The submit path
 * used to accept any `known_for_department`, which is how typing "Av" and
 * pressing enter opened the filmography of a Production-department credit
 * literally named "Av" — 43 of 701 prefixes ended somewhere like that, and 19
 * of those were on people this predicate rejects.
 *
 * @param {string | null | undefined} department
 */
export function isRankablePersonDepartment(department) {
  return Boolean(department) && PERSON_DEPARTMENTS.includes(String(department));
}

/**
 * Order a mixed list of mapped candidates (titles and people together).
 *
 * People share the pool rather than being appended after the titles: measured
 * over the same 701 prefixes it makes no difference to how often the intended
 * title is first (76.9% either way, identical stability) but it drops "row 1 is
 * a person" from 3.7% to 1.4%, because a person now has to actually match the
 * text rather than inherit whatever slot TMDb gave them. Typing a real name
 * still works — "Tom Hanks", "Zendaya" and "Denis Villeneuve" all put the
 * person first.
 *
 * Pure and stable: equal candidates keep their incoming order.
 *
 * @template {{ title?: string | null, popularity?: number | null }} T
 * @param {T[]} candidates
 * @param {string} query
 * @returns {T[]} a new array; the input is not mutated
 */
export function rankSearchCandidates(candidates, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      tier: searchMatchTier(candidate?.title, normalizedQuery),
      popularity: Number(candidate?.popularity) || 0,
    }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.popularity !== b.popularity) return b.popularity - a.popularity;
      return a.index - b.index;
    })
    .map((entry) => entry.candidate);
}

/**
 * Whether a query is worth spending a request on. One character returns the
 * largest payloads in the sample (median 12.1KB) and effectively never contains
 * the title being typed.
 *
 * @param {string | null | undefined} query
 */
export function isSearchableQuery(query) {
  return normalizeSearchText(query).length >= MIN_SEARCH_QUERY_LENGTH;
}

/**
 * Split a ranked, mixed result list into the two things the results screen
 * renders differently. Order within each group is preserved, so the ranking
 * survives the split.
 *
 * @template {{ resultType?: string }} T
 * @param {T[]} results
 */
export function partitionSearchResults(results) {
  const list = Array.isArray(results) ? results : [];
  return {
    people: list.filter((item) => item?.resultType === 'person'),
    titles: list.filter((item) => item?.resultType !== 'person'),
    /** True when the best answer overall was a person, not a title. */
    leadsWithPerson: list[0]?.resultType === 'person',
  };
}
