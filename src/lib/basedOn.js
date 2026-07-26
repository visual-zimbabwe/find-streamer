/**
 * Source-material ("Based On") logic, lifted out of ResultView so it can be
 * tested without a renderer.
 *
 * Two jobs live here:
 *   1. Deciding whether a title is an adaptation *before* Wikidata answers, from
 *      TMDb keywords that ship in the detail payload already. The section used to
 *      draw an eyebrow plus a skeleton on every title and then unmount itself for
 *      every original screenplay, jumping the whole page up — the same bug the
 *      awards rail fixed with the OMDb string.
 *   2. Turning SPARQL bindings into cards: which source work, what kind of work,
 *      who made it, what it looks like, and what else was made from it.
 */

import {
  commonsCoverUrl,
  labelOrNull,
  lookupCommonsThumb,
  resolveCommonsThumbUrls,
  yearFromWikidataDate,
} from './wikidataSoundtracks.js';

const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';
const WIKIDATA_USER_AGENT = 'Trova/1.0 (juwimana.database@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

function isEntityUri(value) {
  return typeof value === 'string' && value.startsWith(ENTITY_URI_PREFIX);
}

export function wikidataIdFromUri(uri) {
  const match = String(uri || '').match(/\/entity\/(Q\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

// ─── 1. The pre-signal ───────────────────────────────────────────────────────

/**
 * TMDb tags adaptations with a family of keywords that all start with the same
 * two words — "based on novel or book", "based on comic", "based on video game",
 * "based on play or musical", "based on memoir or autobiography". Matching the
 * prefix rather than a list of ids means a keyword TMDb adds next year counts too.
 *
 * Two members of that family are excluded, both measured rather than guessed:
 * "based on true story" (Chernobyl) and "based on short film" (Whiplash) name no
 * discrete source work, so Wikidata has no P144 to show and the section would
 * reserve space it then has to give back. Oppenheimer carries "based on true
 * story" as well, but it also carries a Book credit, so the credit signal below
 * keeps it.
 */
const ADAPTATION_KEYWORD = /^based on\b/i;
const UNSOURCEABLE_KEYWORD = /true (story|events)|short film/i;

export function isAdaptationKeyword(name) {
  const text = String(name || '').trim();
  return ADAPTATION_KEYWORD.test(text) && !UNSOURCEABLE_KEYWORD.test(text);
}

/**
 * `true` when TMDb thinks this title is adapted from something. Accepts either
 * shape TMDb returns from `append_to_response=keywords`: movies nest the array
 * under `keywords`, TV under `results`.
 */
export function hasAdaptationKeyword(keywordsPayload) {
  const list = Array.isArray(keywordsPayload)
    ? keywordsPayload
    : keywordsPayload?.keywords || keywordsPayload?.results || [];
  return list.some((keyword) => isAdaptationKeyword(keyword?.name));
}

/**
 * The stronger half of the pre-signal, and free: TMDb credits the source author
 * in the writing department with the source form as the job title. Measured over
 * 20 titles, this alone was right 18 times where keywords managed 11 of 15 —
 * Dune (2021), The Return of the King, The Witcher and Oppenheimer all carry the
 * credit while missing the keyword entirely.
 *
 * "Adaptation" is deliberately absent: on Parasite it credits the person who
 * adapted the screenplay, not a source work, and it was this list's only false
 * positive.
 */
const SOURCE_CREDIT_JOBS = new Set([
  'novel',
  'book',
  'comic book',
  'graphic novel',
  'short story',
  'novella',
  'theatre play',
  'play',
  'musical',
  'opera',
  'author',
]);

export function isSourceCreditJob(job) {
  return SOURCE_CREDIT_JOBS.has(String(job || '').trim().toLowerCase());
}

export function hasSourceMaterialCredit(crew) {
  return (Array.isArray(crew) ? crew : []).some((person) => isSourceCreditJob(person?.job));
}

// ─── 2. Source-work typing ───────────────────────────────────────────────────

/**
 * A work's P31 values arrive as an unordered set, and most books carry several
 * ("novel", "science fiction novel", "1968 book"). The old code took the first
 * one that wasn't on a generic blocklist, which meant the gold label on the card
 * changed with SPARQL binding order — same film, same data, different word.
 *
 * Ranked preference makes it deterministic and picks the word a reader would
 * use. Lower rank wins; anything unrecognised sorts after everything here and
 * ties break alphabetically so even the unknown case is stable.
 */
const SOURCE_TYPE_RANK = [
  [/^novel$/i, 1],
  [/\bnovel\b/i, 2],
  [/^novella$/i, 3],
  [/^graphic novel$/i, 4],
  [/^manga$/i, 5],
  [/\bcomic\b/i, 6],
  [/^short story$/i, 7],
  [/^(stage )?play$/i, 8],
  [/^musical$/i, 9],
  [/^(auto)?biography$/i, 10],
  [/^memoir$/i, 11],
  [/^(non-fiction|nonfiction) book$/i, 12],
  [/^(video ?game|game)$/i, 13],
  [/^(fairy tale|folk tale|legend|myth)$/i, 14],
  [/^poem$/i, 15],
  [/^article$/i, 16],
  [/^(television series|tv series|film|television film)$/i, 17],
  [/^screenplay$/i, 40],
  [/^book$/i, 41],
];

const GENERIC_TYPES = new Set([
  'literary work',
  'written work',
  'creative work',
  'work',
  'media franchise',
  'intellectual property',
  'version, edition or translation',
]);

const UNRANKED = 30;

function typeRank(type) {
  const text = String(type || '').trim();
  if (!text) return Number.POSITIVE_INFINITY;
  if (GENERIC_TYPES.has(text.toLowerCase())) return 60;
  const hit = SOURCE_TYPE_RANK.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : UNRANKED;
}

/**
 * The single word to lead the card with. Deterministic for a given type set, and
 * null when every type Wikidata carries is a container word.
 *
 * Measured on real titles: Blade Runner's novel, The Shining and Shōgun all come
 * back with P31 = "literary work" and nothing else. "Literary work: The Shining"
 * is database vocabulary in a gold badge — the cover, the byline and the year
 * already say "book" to a reader, so the label is dropped rather than filled
 * with the least useful word available.
 */
export function pickSourceType(types) {
  const list = (Array.isArray(types) ? types : []).map((t) => String(t || '').trim()).filter(Boolean);
  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => {
    const diff = typeRank(a) - typeRank(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
  const best = sorted[0];
  return GENERIC_TYPES.has(best.toLowerCase()) ? null : best;
}

/** A source work whose own P144 we should follow — the film credits the script. */
const SCRIPT_TYPES = /^(screenplay|script|film script|teleplay|scenario)$/i;

export function isScriptType(types) {
  return (Array.isArray(types) ? types : []).some((t) => SCRIPT_TYPES.test(String(t || '').trim()));
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── 3. Card copy ────────────────────────────────────────────────────────────

/**
 * The byline, as a separate line from the title. These used to share one
 * `numberOfLines={2}` Text, so a long title ate the attribution outright —
 * "The Lord of the Rings: The Fellowship of the Ring by J. R. R. Tolkien"
 * truncated mid-author on a phone.
 *
 * Illustrators are named because a graphic novel adaptation that credits only
 * the writer is a half-credit, and manga sources frequently carry P110 alone.
 */
export function formatCreators(work) {
  const authors = (work?.authors || []).filter(Boolean);
  const illustrators = (work?.illustrators || []).filter(
    (name) => name && !authors.includes(name),
  );

  const parts = [];
  if (authors.length) parts.push(`by ${joinNames(authors)}`);
  if (illustrators.length) parts.push(`illustrated by ${joinNames(illustrators)}`);
  return parts.join(', ') || null;
}

function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The dimmed line under the title: relation, creators, year.
 *
 * The relation is only worth printing when the section header doesn't already
 * say it. On Stranger Things — nine P941 statements, so the eyebrow reads
 * "INSPIRED BY" — every card then repeated "Inspired by" under its own title.
 * Callers pass `showRelation` when the section is mixed and the card needs to
 * mark itself as the weaker claim.
 */
export function buildSourceMetaLine(work, { showRelation = true } = {}) {
  const parts = [];
  if (showRelation && work?.relation === 'inspiredBy') parts.push('Inspired by');
  const creators = formatCreators(work);
  if (creators) parts.push(creators);
  if (work?.year) parts.push(String(work.year));
  return parts.join(' · ') || null;
}

/**
 * "Based On" is a lie when every card is a P941 "inspired by" claim, which is a
 * meaningfully weaker statement — Wikidata uses it for the loose cases.
 */
export function sourceSectionEyebrow(works) {
  const list = Array.isArray(works) ? works : [];
  if (!list.length) return 'Based On';
  return list.every((work) => work.relation === 'inspiredBy') ? 'Inspired By' : 'Based On';
}

// ─── 4. Parsing ──────────────────────────────────────────────────────────────

/**
 * Fold SPARQL bindings into source-work cards.
 *
 * `P144` (based on) and `P941` (inspired by) both land here, tagged by relation
 * and sorted so the stronger claim leads. A work the film credits as its
 * *screenplay* is replaced by that screenplay's own source when there is one:
 * "based on the screenplay by X" is a credit, not an answer, and the chain
 * film → screenplay → novel is common enough on Wikidata to be worth one hop.
 */
export function parseBasedOnFromBindings(bindings) {
  const byUri = new Map();

  for (const binding of Array.isArray(bindings) ? bindings : []) {
    for (const relation of ['basedOn', 'inspiredBy']) {
      const uri = binding[relation]?.value;
      const name = labelOrNull(binding[`${relation}Label`]?.value);
      // Unlike a soundtrack there's nothing playable behind an unnamed source
      // work, so a nameless card is dropped rather than labelled.
      if (!isEntityUri(uri) || !name) continue;

      if (!byUri.has(uri)) {
        byUri.set(uri, {
          id: wikidataIdFromUri(uri),
          name,
          relation,
          authors: new Set(),
          illustrators: new Set(),
          types: new Set(),
          year: null,
          coverValue: null,
          rootId: null,
          rootName: null,
        });
      }
      const work = byUri.get(uri);

      const author = labelOrNull(binding[`${relation}AuthorLabel`]?.value);
      if (author) work.authors.add(author);
      const illustrator = labelOrNull(binding[`${relation}IllustratorLabel`]?.value);
      if (illustrator) work.illustrators.add(illustrator);
      const type = labelOrNull(binding[`${relation}TypeLabel`]?.value);
      if (type) work.types.add(type);
      if (!work.year) work.year = yearFromWikidataDate(binding[`${relation}Date`]?.value);
      if (!work.coverValue) work.coverValue = binding[`${relation}Image`]?.value || null;

      if (relation === 'basedOn') {
        const rootUri = binding.basedOnRoot?.value;
        const rootName = labelOrNull(binding.basedOnRootLabel?.value);
        if (isEntityUri(rootUri) && rootName && !work.rootId) {
          work.rootId = wikidataIdFromUri(rootUri);
          work.rootName = rootName;
        }
      }
    }
  }

  const works = Array.from(byUri.values()).map((work) => {
    const types = Array.from(work.types);
    // The film credits a script, and the script credits a book — show the book.
    const followRoot = isScriptType(types) && work.rootId;
    return {
      id: followRoot ? work.rootId : work.id,
      name: followRoot ? work.rootName : work.name,
      relation: work.relation,
      // Sorted for the same reason the type label is ranked: a Set filled in
      // SPARQL binding order made Watchmen read "by Dave Gibbons and Alan Moore"
      // on one fetch and the other way round on the next. Wikidata's P50 carries
      // no authorship order to honour, so a stable order beats an arbitrary one.
      authors: sortNames(work.authors),
      illustrators: sortNames(work.illustrators),
      // The root work's own types weren't fetched (one hop is already an extra
      // OPTIONAL); dropping the script's type is better than mislabelling a
      // novel "Screenplay".
      types: followRoot ? [] : types,
      year: followRoot ? null : work.year,
      coverValue: followRoot ? null : work.coverValue,
      coverUrl: followRoot ? null : commonsCoverUrl(work.coverValue),
    };
  });

  return sortSourceWorks(dedupeById(works));
}

function sortNames(names) {
  return Array.from(names).sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }),
  );
}

function dedupeById(works) {
  const seen = new Map();
  for (const work of works) {
    if (!work.id) continue;
    // Following a script hop can collapse two entries onto the same root.
    if (!seen.has(work.id)) seen.set(work.id, work);
  }
  return Array.from(seen.values());
}

/**
 * Stranger Things carries nine P941 "inspired by" statements — Jaws, E.T.,
 * Poltergeist, Firestarter, Stand by Me and more. All true, all interesting, and
 * nine cards deep it stops being a section and becomes a wall two scrolls tall.
 * Three cards plus an honest count of the rest.
 */
export const BASED_ON_CARD_CAP = 3;

export function overflowSourceCount(works) {
  return Math.max(0, (Array.isArray(works) ? works.length : 0) - BASED_ON_CARD_CAP);
}

export function sortSourceWorks(works) {
  const relationRank = (work) => (work.relation === 'inspiredBy' ? 1 : 0);
  return [...works].sort((a, b) => {
    const rel = relationRank(a) - relationRank(b);
    if (rel !== 0) return rel;
    const yearA = a.year ?? Number.POSITIVE_INFINITY;
    const yearB = b.year ?? Number.POSITIVE_INFINITY;
    if (yearA !== yearB) return yearA - yearB;
    return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
  });
}

/**
 * Swap Commons originals for 250px thumbnails, exactly as the soundtrack and
 * awards paths already do. A no-op costing no request when no source work
 * carries an image, which is the common case.
 */
export async function resolveBasedOnCovers(works) {
  const list = Array.isArray(works) ? works : [];
  const coverValues = list.map((work) => work.coverValue).filter(Boolean);
  if (coverValues.length === 0) return list;

  const thumbMap = await resolveCommonsThumbUrls(coverValues);
  return list.map((work) =>
    work.coverValue
      ? { ...work, coverUrl: lookupCommonsThumb(work.coverValue, thumbMap) || work.coverUrl }
      : work,
  );
}

// ─── 5. Other adaptations of the same source ─────────────────────────────────

/**
 * Everything else Wikidata knows was made from the same source work, filtered to
 * what Trova can actually open — an entity carrying a TMDb id (P4947 film /
 * P4983 series). A row without one is a dead end in this app, so it's dropped
 * rather than shown as an inert line.
 */
export function buildAdaptationsQuery(sourceIds) {
  const ids = (Array.isArray(sourceIds) ? sourceIds : []).filter((id) => /^Q\d+$/i.test(id || ''));
  if (!ids.length) return null;

  const values = ids.map((id) => `wd:${id}`).join(' ');
  return `
    SELECT DISTINCT ?work ?workLabel ?tmdbMovie ?tmdbTv ?date WHERE {
      VALUES ?source { ${values} }
      ?work wdt:P144 ?source .
      OPTIONAL { ?work wdt:P4947 ?tmdbMovie . }
      OPTIONAL { ?work wdt:P4983 ?tmdbTv . }
      OPTIONAL { ?work wdt:P577 ?date . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }
    LIMIT 60
  `;
}

export function parseAdaptationsFromBindings(bindings, { excludeTmdbId, excludeMediaType } = {}) {
  const byKey = new Map();

  for (const binding of Array.isArray(bindings) ? bindings : []) {
    const movieId = binding.tmdbMovie?.value?.trim();
    const tvId = binding.tmdbTv?.value?.trim();
    const mediaType = movieId ? 'movie' : tvId ? 'tv' : null;
    const tmdbId = movieId || tvId;
    if (!mediaType || !/^\d+$/.test(tmdbId || '')) continue;

    // The title you're already looking at is not a recommendation.
    if (String(tmdbId) === String(excludeTmdbId) && mediaType === excludeMediaType) continue;

    const key = `${mediaType}:${tmdbId}`;
    if (byKey.has(key)) continue;

    byKey.set(key, {
      key,
      mediaType,
      tmdbId: Number(tmdbId),
      name: labelOrNull(binding.workLabel?.value),
      year: yearFromWikidataDate(binding.date?.value),
    });
  }

  // Oldest first — the adaptation history reads as a timeline.
  return Array.from(byKey.values()).sort((a, b) => {
    const yearA = a.year ?? Number.POSITIVE_INFINITY;
    const yearB = b.year ?? Number.POSITIVE_INFINITY;
    if (yearA !== yearB) return yearA - yearB;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
      sensitivity: 'base',
    });
  });
}

export const OTHER_ADAPTATIONS_CAP = 10;

/**
 * Runs only when the peek sheet opens, never on page load — the detail screen
 * already spends a SPARQL round trip before first paint and this is a second
 * one nobody has asked for until they tap the card.
 */
export async function fetchOtherAdaptations(sourceIds, options = {}) {
  const query = buildAdaptationsQuery(sourceIds);
  if (!query) return [];

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': WIKIDATA_USER_AGENT,
      Accept: 'application/sparql-results+json',
    },
  });
  if (!response.ok) {
    throw new Error(`Wikidata adaptations request failed with status ${response.status}`);
  }

  const json = await response.json();
  return parseAdaptationsFromBindings(json?.results?.bindings || [], options).slice(
    0,
    OTHER_ADAPTATIONS_CAP,
  );
}
