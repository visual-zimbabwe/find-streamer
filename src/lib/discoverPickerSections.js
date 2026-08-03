// ─── Discover value-picker sections ────────────────────────────────────────────
// The pure, tested contract behind the Language / Country picker's ordering.
//
// The old picker was a flat A–Z dump of ~180 languages (or ~240 countries), so
// the handful a given user actually filters by were buried under the ones they
// never touch — even though Discover already knows the user's top languages
// (recommendedLanguageCodes) and uses them for Quick Picks. This module puts the
// "yours first, then everything" pattern (iOS Preferred Languages / Netflix
// language browse) in front of that same flat list:
//
//   RECENT      — the codes the user last picked (persisted, see discoverRecentsStorage)
//   SUGGESTED   — recommended ∪ popular, deduped, minus anything already in Recent
//   ALL <noun>  — the full alphabetical tail, minus anything pinned above
//
// While the search box has a query, all of that collapses to a single flat,
// header-less list of matches (order preserved from `items`, i.e. alphabetical),
// so a targeted search is a fast scan, not a scavenger hunt through sections.
//
// Kept pure (no React, no I/O) so the row math is unit-tested in isolation and
// the modal just renders whatever `rows` it's handed.

// TMDb catalogue heavyweights (ISO 639-1). They back the SUGGESTED group when the
// user's watchlist gives few/no language signals, so a first-time user still gets
// a useful short list instead of Afrikaans-first alphabetical.
export const POPULAR_LANGUAGE_CODES = [
  'en', 'es', 'fr', 'ja', 'ko', 'hi', 'zh', 'de', 'it', 'pt', 'ru', 'ar', 'sv', 'da', 'nl',
];

// The countries people actually narrow a global catalogue by (ISO 3166-1).
// Mirrors POPULAR_LANGUAGE_CODES so the Country picker gets a SUGGESTED group too
// (there's no per-user country signal, so this static list is the whole of it).
export const POPULAR_COUNTRY_CODES = [
  'US', 'GB', 'KR', 'JP', 'FR', 'IN', 'DE', 'IT', 'ES', 'CA', 'AU', 'BR', 'MX', 'SE', 'CN',
];

// How many recent picks to remember per picker.
export const RECENTS_MAX = 6;

// Row heights the layout table (and the modal styles) agree on. Kept here so
// getItemLayout stays exact across the mixed header/item heights.
export const ITEM_HEIGHT = 48;
export const HEADER_HEIGHT = 40;

/**
 * Push `code` to the front of a recents list: newest-first, deduped, capped at
 * `max`. Pure — the caller persists the result. A null/undefined code is a no-op
 * (returns the list, capped).
 * @param {string[]} list
 * @param {string} code
 * @param {number} [max]
 * @returns {string[]}
 */
export function pushRecent(list, code, max = RECENTS_MAX) {
  const base = Array.isArray(list) ? list : [];
  if (code == null) return base.slice(0, max);
  return [code, ...base.filter((c) => c !== code)].slice(0, max);
}

function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    if (x == null || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

// Pair the typed rows with a per-index { length, offset, index } table so the
// FlatList's getItemLayout is exact even with two row heights in play.
function withLayout(rows, itemHeight, headerHeight) {
  const layout = [];
  let offset = 0;
  for (let i = 0; i < rows.length; i++) {
    const length = rows[i].type === 'header' ? headerHeight : itemHeight;
    layout.push({ length, offset, index: i });
    offset += length;
  }
  return { rows, layout };
}

/**
 * Build the typed row list (+ layout table) the searchable picker renders.
 *
 * @param {Object} args
 * @param {{code: string|null, label: string}[]} args.items  full option list (a
 *        leading { code: null } "Any" sentinel, if present, is ignored — clearing
 *        now lives in the sheet header, not as a list row).
 * @param {string[]} [args.selectedCodes]   currently-selected codes (unused by the
 *        row math; the modal reads it for the active state — accepted for symmetry).
 * @param {string[]} [args.recentCodes]      persisted recent picks, newest-first.
 * @param {string[]} [args.suggestedCodes]   recommended ∪ popular.
 * @param {string} [args.query]              live search text; non-empty → flat matches.
 * @param {string} [args.allLabel]           header for the alphabetical tail.
 * @param {number} [args.itemHeight]
 * @param {number} [args.headerHeight]
 * @returns {{ rows: Array, layout: Array }}
 *   rows: [{ type: 'header', label } | { type: 'item', code, label }]
 */
export function buildPickerSections({
  items = [],
  // eslint-disable-next-line no-unused-vars
  selectedCodes = [],
  recentCodes = [],
  suggestedCodes = [],
  query = '',
  allLabel = 'ALL',
  itemHeight = ITEM_HEIGHT,
  headerHeight = HEADER_HEIGHT,
} = {}) {
  const options = (Array.isArray(items) ? items : []).filter((it) => it && it.code != null);
  const byCode = new Map(options.map((it) => [it.code, it]));

  const q = String(query || '')
    .toLowerCase()
    .trim();

  // Searching: one flat, header-less list of matches (alphabetical, as `items`
  // already are). No sections — the query IS the filter.
  if (q) {
    const rows = options
      .filter((it) => it.label.toLowerCase().includes(q))
      .map((it) => ({ type: 'item', code: it.code, label: it.label }));
    return withLayout(rows, itemHeight, headerHeight);
  }

  const used = new Set();
  const rows = [];

  const pushSection = (title, codes) => {
    const picked = [];
    for (const code of uniq(codes)) {
      if (used.has(code)) continue;
      const it = byCode.get(code);
      if (!it) continue;
      used.add(code);
      picked.push(it);
    }
    if (picked.length === 0) return;
    rows.push({ type: 'header', label: title });
    for (const it of picked) rows.push({ type: 'item', code: it.code, label: it.label });
  };

  pushSection('RECENT', recentCodes);
  pushSection('SUGGESTED', suggestedCodes);

  // The alphabetical tail, minus anything already pinned above. Its header only
  // appears when something WAS pinned — with nothing pinned this degrades to the
  // plain flat A–Z list the picker had before, no lonely header.
  const tail = options.filter((it) => !used.has(it.code));
  if (rows.length > 0 && tail.length > 0) {
    rows.push({ type: 'header', label: allLabel });
  }
  for (const it of tail) rows.push({ type: 'item', code: it.code, label: it.label });

  return withLayout(rows, itemHeight, headerHeight);
}
