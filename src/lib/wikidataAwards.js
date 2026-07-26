import { lookupCommonsThumb, resolveCommonsThumbUrls } from './wikidataSoundtracks.js';

const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';
const WIKIDATA_USER_AGENT = 'Trova/1.0 (juwimana.database@gmail.com)';

/**
 * Ceremonies we can recognise by name. `rank` orders the rail by prestige —
 * without it the sort falls back to alphabetical, which put a Kids' Choice Award
 * ahead of The Simpsons' Peabody and Emmys. `fallbackFile` is a Commons filename
 * used when neither the award nor its parent ceremony carries an image.
 */
const CEREMONY_PATTERNS = [
  // The plural forms matter: OMDb labels its groups "Oscars" and "Emmys", and
  // \bemmy\b does not match "Emmys" — the trailing s is a word character.
  { key: 'oscar', rank: 1, pattern: /academy award|\boscars?\b/i, fallbackFile: 'Oscar-free-version.svg' },
  // No fallback for the Emmy: Commons hosts no free image of the statuette, and
  // "Golden Globe trophy.png" / "Emmy Statuette.jpg" / "BAFTA mask.svg" /
  // "Hugo Award rocket.svg" — the names this list shipped with — do not exist, so
  // every fallback but the Oscar was dead. These are verified to resolve.
  { key: 'emmy', rank: 2, pattern: /\bemmys?\b/i },
  { key: 'globe', rank: 3, pattern: /golden globe/i, fallbackFile: 'Golden Globe icon (gold).svg' },
  { key: 'bafta', rank: 4, pattern: /\bbafta\b/i, fallbackFile: 'BAFTA Mask at BAFTA HQ in London (2009).jpg' },
  { key: 'palme', rank: 5, pattern: /palme d'or|cannes film festival/i },
  { key: 'goldenbear', rank: 6, pattern: /golden bear|silver bear/i },
  { key: 'goldenlion', rank: 7, pattern: /golden lion/i },
  { key: 'peabody', rank: 8, pattern: /peabody/i },
  { key: 'sag', rank: 9, pattern: /screen actors guild/i, fallbackFile: 'The Actor Statuette (SAG Awards).jpg' },
  { key: 'dga', rank: 10, pattern: /directors guild/i, fallbackFile: 'DGAAwards.jpg' },
  { key: 'wga', rank: 11, pattern: /writers guild/i },
  { key: 'pga', rank: 12, pattern: /producers guild/i },
  { key: 'critics', rank: 13, pattern: /critics'? choice/i },
  { key: 'nbr', rank: 14, pattern: /national board of review/i },
  { key: 'hugo', rank: 15, pattern: /hugo award/i, fallbackFile: '1991 Hugo award (with variant base).jpg' },
  { key: 'annie', rank: 16, pattern: /annie award/i },
  { key: 'naacp', rank: 17, pattern: /naacp/i },
  { key: 'tca', rank: 18, pattern: /\btca\b/i },
  { key: 'satellite', rank: 19, pattern: /satellite award/i },
  { key: 'saturn', rank: 20, pattern: /saturn award/i },
];

/** Ceremonies we don't recognise sort after every one we do, but before nothing. */
const DEFAULT_CEREMONY_RANK = 50;

function ceremonyDefFor(label) {
  const text = String(label || '');
  return CEREMONY_PATTERNS.find((ceremony) => ceremony.pattern.test(text)) || null;
}

export function ceremonyRank(label) {
  return ceremonyDefFor(label)?.rank ?? DEFAULT_CEREMONY_RANK;
}

function isEntityUri(val) {
  return typeof val === 'string' && val.startsWith(ENTITY_URI_PREFIX);
}

/**
 * Provenance matters as much as presence. P2910 (icon) and P154 (logo) are
 * emblems; P18 (image) on an award entity is frequently a photograph of a
 * laureate holding it — fine as a last resort on a category row, wrong as the
 * face of a ceremony tile. Lower rank wins.
 */
const LOGO_RANK = { icon: 0, logo: 1, image: 2 };

function awardLogoFromBinding(icon, logo, image, parentIcon, parentLogo, parentImage, thumbMap) {
  const candidates = [
    [lookupCommonsThumb(icon, thumbMap), 'icon'],
    [lookupCommonsThumb(parentIcon, thumbMap), 'icon'],
    [lookupCommonsThumb(logo, thumbMap), 'logo'],
    [lookupCommonsThumb(parentLogo, thumbMap), 'logo'],
    [lookupCommonsThumb(image, thumbMap), 'image'],
    [lookupCommonsThumb(parentImage, thumbMap), 'image'],
  ];

  const hit = candidates.find(([url]) => Boolean(url));
  return hit ? { url: hit[0], source: hit[1] } : null;
}

function collectAwardMediaValues(bindings) {
  const values = [];
  for (const binding of [...bindings.wins, ...bindings.nominations]) {
    values.push(
      binding.awardIcon?.value,
      binding.awardLogo?.value,
      binding.awardImage?.value,
      binding.awardParentIcon?.value,
      binding.awardParentLogo?.value,
      binding.awardParentImage?.value,
    );
  }
  for (const ceremony of CEREMONY_PATTERNS) {
    if (ceremony.fallbackFile) values.push(ceremony.fallbackFile);
  }
  return values;
}

function buildItemLookupClause(imdbId, tmdbId, mediaType) {
  const clauses = [];
  if (imdbId) clauses.push(`?item wdt:P345 "${imdbId}"`);
  if (tmdbId) {
    // P4983 is "TMDB TV series ID" and P4947 "TMDB movie ID". This used to read
    // P4985 (TMDB *person* ID) and P9721 ("image of entrance"), so every TV title
    // unioned in whichever person shared its numeric id — Breaking Bad (1396)
    // merged in Hanna Krall's Polish literary prizes — while the movie branch
    // matched nothing at all and quietly relied on the IMDb id alone.
    if (mediaType === 'tv') clauses.push(`?item wdt:P4983 "${tmdbId}"`);
    else clauses.push(`?item wdt:P4947 "${tmdbId}"`);
  }
  if (!clauses.length) return null;
  return clauses.map((clause) => `{ ${clause} }`).join(' UNION ');
}

async function runWikidataSparql(sparql) {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': WIKIDATA_USER_AGENT,
      Accept: 'application/sparql-results+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL request failed with status ${response.status}`);
  }

  const json = await response.json();
  return json?.results?.bindings || [];
}

export async function fetchWikidataAwardBindings(imdbId, tmdbId, mediaType) {
  const unionClause = buildItemLookupClause(imdbId, tmdbId, mediaType);
  if (!unionClause) return { wins: [], nominations: [] };

  const winSparql = `
    SELECT DISTINCT ?award ?awardLabel ?awardIcon ?awardLogo ?awardImage ?awardParentIcon ?awardParentLogo ?awardParentImage WHERE {
      ${unionClause}
      ?item wdt:P166 ?award .
      OPTIONAL { ?award wdt:P2910 ?awardIcon . }
      OPTIONAL { ?award wdt:P154 ?awardLogo . }
      OPTIONAL { ?award wdt:P18 ?awardImage . }
      OPTIONAL {
        ?award wdt:P361 ?awardParent .
        OPTIONAL { ?awardParent wdt:P2910 ?awardParentIcon . }
        OPTIONAL { ?awardParent wdt:P154 ?awardParentLogo . }
        OPTIONAL { ?awardParent wdt:P18 ?awardParentImage . }
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }
  `;

  const nominationSparql = `
    SELECT DISTINCT ?award ?awardLabel ?awardIcon ?awardLogo ?awardImage ?awardParentIcon ?awardParentLogo ?awardParentImage WHERE {
      ${unionClause}
      ?item wdt:P1411 ?award .
      OPTIONAL { ?award wdt:P2910 ?awardIcon . }
      OPTIONAL { ?award wdt:P154 ?awardLogo . }
      OPTIONAL { ?award wdt:P18 ?awardImage . }
      OPTIONAL {
        ?award wdt:P361 ?awardParent .
        OPTIONAL { ?awardParent wdt:P2910 ?awardParentIcon . }
        OPTIONAL { ?awardParent wdt:P154 ?awardParentLogo . }
        OPTIONAL { ?awardParent wdt:P18 ?awardParentImage . }
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }
  `;

  const [wins, nominations] = await Promise.all([
    runWikidataSparql(winSparql),
    runWikidataSparql(nominationSparql),
  ]);

  return { wins, nominations };
}

export async function fetchWikidataAwards(imdbId, tmdbId, mediaType) {
  const bindings = await fetchWikidataAwardBindings(imdbId, tmdbId, mediaType);
  const thumbMap = await resolveCommonsThumbUrls(collectAwardMediaValues(bindings));
  return parseAwardQueryResults(bindings, thumbMap);
}

export function sortAwardGroups(groups) {
  return [...groups].sort((a, b) => {
    const rankA = a.rank ?? DEFAULT_CEREMONY_RANK;
    const rankB = b.rank ?? DEFAULT_CEREMONY_RANK;
    if (rankA !== rankB) return rankA - rankB;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.nominations !== a.nominations) return b.nominations - a.nominations;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
}

function upsertAward(
  map,
  uri,
  label,
  icon,
  logo,
  image,
  parentIcon,
  parentLogo,
  parentImage,
  field,
  thumbMap,
) {
  if (!isEntityUri(uri)) return;

  const wikidataId = uri.match(/\/entity\/(Q\d+)$/i)?.[1]?.toUpperCase();
  if (!wikidataId) return;

  const awardLabel = label && !isEntityUri(label) ? label : null;
  if (!map.has(wikidataId)) {
    map.set(wikidataId, {
      wikidataId,
      label: awardLabel || wikidataId,
      logoUrl: null,
      logoSource: null,
      wins: 0,
      nominations: 0,
    });
  }

  const entry = map.get(wikidataId);
  if (awardLabel && entry.label === wikidataId) {
    entry.label = awardLabel;
  }

  const found = awardLogoFromBinding(icon, logo, image, parentIcon, parentLogo, parentImage, thumbMap);
  if (found && (!entry.logoUrl || LOGO_RANK[found.source] < LOGO_RANK[entry.logoSource])) {
    entry.logoUrl = found.url;
    entry.logoSource = found.source;
  }

  entry[field] += 1;
}

function inheritCeremonyLogos(groups, thumbMap) {
  // Only emblems are worth lending to a sibling — a laureate photo is specific to
  // the category it came from.
  const logoByCeremony = new Map();

  for (const group of groups) {
    if (!group.logoUrl || group.logoSource === 'image') continue;
    for (const ceremony of CEREMONY_PATTERNS) {
      if (ceremony.pattern.test(group.label)) {
        logoByCeremony.set(ceremony.key, { url: group.logoUrl, source: group.logoSource });
      }
    }
  }

  return groups.map((group) => {
    // A photograph is better than nothing on a category, but a recognised
    // ceremony has a canonical emblem that should outrank it.
    const replaceable = !group.logoUrl || group.logoSource === 'image';
    if (!replaceable) return group;

    for (const ceremony of CEREMONY_PATTERNS) {
      if (!ceremony.pattern.test(group.label)) continue;

      const sibling = logoByCeremony.get(ceremony.key);
      const fallback = lookupCommonsThumb(ceremony.fallbackFile, thumbMap);
      const inherited = sibling
        ? sibling
        : fallback
          ? { url: fallback, source: 'logo' }
          : null;

      if (inherited) {
        return { ...group, logoUrl: inherited.url, logoSource: inherited.source };
      }
    }

    return group;
  });
}

export function parseAwardQueryResults({ wins = [], nominations = [] }, thumbMap = new Map()) {
  const map = new Map();

  for (const binding of wins) {
    upsertAward(
      map,
      binding.award?.value,
      binding.awardLabel?.value,
      binding.awardIcon?.value,
      binding.awardLogo?.value,
      binding.awardImage?.value,
      binding.awardParentIcon?.value,
      binding.awardParentLogo?.value,
      binding.awardParentImage?.value,
      'wins',
      thumbMap,
    );
  }

  for (const binding of nominations) {
    upsertAward(
      map,
      binding.award?.value,
      binding.awardLabel?.value,
      binding.awardIcon?.value,
      binding.awardLogo?.value,
      binding.awardImage?.value,
      binding.awardParentIcon?.value,
      binding.awardParentLogo?.value,
      binding.awardParentImage?.value,
      'nominations',
      thumbMap,
    );
  }

  return inheritCeremonyLogos(
    sortAwardGroups(
      Array.from(map.values()).filter((group) => group.wins > 0 || group.nominations > 0),
    ),
    thumbMap,
  );
}

/**
 * Legacy parser for flat SPARQL bindings (win/nomination variable names).
 * Prefer parseAwardQueryResults with fetchWikidataAwardBindings.
 */
export function parseAwardsFromBindings(bindings, wikidataIdFromUri) {
  const wins = [];
  const nominations = [];

  for (const binding of bindings) {
    if (binding.awardWin?.value) {
      wins.push({
        award: binding.awardWin,
        awardLabel: binding.awardWinLabel,
        awardIcon: binding.awardWinIcon,
        awardLogo: binding.awardWinLogo,
        awardImage: binding.awardWinImage,
      });
    }
    if (binding.awardNomination?.value) {
      nominations.push({
        award: binding.awardNomination,
        awardLabel: binding.awardNominationLabel,
        awardIcon: binding.awardNomIcon,
        awardLogo: binding.awardNomLogo,
        awardImage: binding.awardNomImage,
      });
    }
  }

  return parseAwardQueryResults({ wins, nominations }, new Map());
}

const OMDB_AWARD_DEFS = [
  {
    key: 'oscar',
    label: 'Oscars',
    ceremonyLabel: 'Academy Award',
    regex: /oscars?|academy awards?/i,
    winRegex: /won\s+(\d+)\s+(?:oscars?|academy awards?)/i,
    nominationRegex:
      /(?:nominated\s+for\s+(\d+)\s+(?:an?\s+)?(?:oscars?|academy awards?)|(\d+)\s+nomination(?:s)?\s+for\s+(?:an?\s+)?(?:oscars?|academy awards?))/i,
    logoUri:
      'https://images.ctfassets.net/mqgaq446dh9d/1hRNcghUHboflQc5dN5lhO/f331d2533a40ce9f53d25eecf77adaf4/oscars_logo_white_mode.jpg?fm=jpg&q=80&w=768',
  },
  {
    key: 'emmy',
    label: 'Emmys',
    ceremonyLabel: 'Primetime Emmy Award',
    regex: /emmys?|emmy awards?/i,
    winRegex: /won\s+(\d+)\s+(?:primetime\s+|daytime\s+|international\s+)?(?:emmys?|emmy awards?)/i,
    nominationRegex:
      /(?:nominated\s+for\s+(\d+)\s+(?:an?\s+)?(?:primetime\s+|daytime\s+|international\s+)?(?:emmys?|emmy awards?)|(\d+)\s+nomination(?:s)?\s+for\s+(?:an?\s+)?(?:primetime\s+|daytime\s+|international\s+)?(?:emmys?|emmy awards?))/i,
    logoUri: 'https://www.televisionacademy.com/build/assets/tva-logo.png',
  },
  {
    key: 'globe',
    label: 'Golden Globes',
    ceremonyLabel: 'Golden Globe Award',
    regex: /golden globes?(?: awards?)?/i,
    winRegex: /won\s+(\d+)\s+golden globes?(?: awards?)?/i,
    nominationRegex:
      /(?:nominated\s+for\s+(\d+)\s+(?:an?\s+)?golden globes?(?: awards?)?|(\d+)\s+nomination(?:s)?\s+for\s+(?:an?\s+)?golden globes?(?: awards?)?)/i,
    logoUri: 'https://goldenglobes.com/wp-content/uploads/2025/12/default-stacked.jpg',
  },
];

function parseOmdbCount(awardsStr, regex) {
  if (!regex || !awardsStr) return 0;
  const match = awardsStr.match(regex);
  if (!match) return 0;
  const value = match[1] || match[2];
  return value ? parseInt(value, 10) : 0;
}

/**
 * The headline clause OMDb leads with — "Won 3 Oscars", "Nominated for 7 Oscars",
 * "Won 16 Primetime Emmys" — followed by the running totals.
 */
const OMDB_HEADLINE = /\b(Won|Nominated for)\s+(\d+)\s+([A-Za-z][A-Za-z'&\- ]*?)(?=\s*[.,]|$)/i;
const OMDB_WINS = /(\d+)\s+wins?\b/i;
const OMDB_NOMINATIONS = /(\d+)\s+nominations?\b/i;

/**
 * The single most valuable sentence about a title's awards, and it was only ever
 * used when Wikidata came back empty. Handles every shape OMDb actually ships:
 * "Won 3 Oscars. 91 wins & 131 nominations total", "Nominated for 7 Oscars. …",
 * a bare "21 wins & 42 nominations total", "2 wins total", and the un-suffixed
 * "1 win & 1 nomination".
 */
export function parseOmdbAwardTotals(awardsStr) {
  const text = String(awardsStr || '').trim();
  if (!text) return null;

  const headlineMatch = text.match(OMDB_HEADLINE);
  const headline = headlineMatch
    ? {
        kind: /^won$/i.test(headlineMatch[1]) ? 'won' : 'nominated',
        count: parseInt(headlineMatch[2], 10),
        award: headlineMatch[3].trim(),
      }
    : null;

  // Strip the headline before scanning totals so "Won 3 Oscars" can't be read as
  // a win tally, then read whatever running totals follow.
  const remainder = headlineMatch ? text.replace(headlineMatch[0], ' ') : text;
  let wins = parseInt(remainder.match(OMDB_WINS)?.[1] || '0', 10);
  let nominations = parseInt(remainder.match(OMDB_NOMINATIONS)?.[1] || '0', 10);

  // "Won 1 Oscar." with no totals clause — the headline is all we have.
  if (!wins && !nominations && headline) {
    if (headline.kind === 'won') wins = headline.count;
    else nominations = headline.count;
  }

  if (!wins && !nominations && !headline) return null;

  return { headline, wins, nominations };
}

/**
 * One line under the eyebrow. The totals clause is dropped when it would merely
 * restate the headline ("Won 1 Oscar · 1 win").
 */
export function formatAwardTotals(totals) {
  if (!totals) return null;

  const parts = [];
  if (totals.headline) {
    const verb = totals.headline.kind === 'won' ? 'Won' : 'Nominated for';
    parts.push(`${verb} ${totals.headline.count} ${totals.headline.award}`);
  }

  const headlineCount = totals.headline?.count || 0;
  const totalsAddInfo =
    totals.wins > headlineCount || totals.nominations > headlineCount || !totals.headline;

  if (totalsAddInfo) {
    const tally = [];
    if (totals.wins > 0) tally.push(`${totals.wins} ${totals.wins === 1 ? 'win' : 'wins'}`);
    if (totals.nominations > 0) {
      tally.push(
        `${totals.nominations} ${totals.nominations === 1 ? 'nomination' : 'nominations'}`,
      );
    }
    if (tally.length) parts.push(tally.join(' & '));
  }

  return parts.join(' · ') || null;
}

/**
 * Collapse per-category award entities into one tile per ceremony.
 *
 * This is the whole fix. Wikidata's P166/P1411 pair looks like a double count at
 * the category level ("Best Cinematography — 1 Win · 1 Nomination") but rolls up
 * to exactly the industry convention once aggregated: Avatar becomes Academy
 * Award 3 wins / 9 nominations, which is precisely what it won. The data was
 * always right; the grouping level was wrong.
 */
export function groupAwardsByCeremony(categoryGroups) {
  const byCeremony = new Map();

  for (const group of categoryGroups || []) {
    if (!group?.label) continue;
    const ceremony = ceremonyNameFromLabel(group.label);
    const key = ceremonyKeyFromName(ceremony);

    if (!byCeremony.has(key)) {
      byCeremony.set(key, {
        key,
        label: ceremony,
        logoUrl: null,
        logoSource: null,
        wins: 0,
        nominations: 0,
        rank: ceremonyRank(ceremony),
        categories: [],
      });
    }

    const entry = byCeremony.get(key);
    // Emblems only. A P18 on an award entity is a photograph, and it is as likely
    // to be the person who won as the trophy itself — Breaking Bad's Emmy tile
    // resolved to a headshot of Julia Garner. The generic trophy glyph is the
    // honest default when no emblem exists (inheritCeremonyLogos has already had
    // its chance to supply a curated one).
    const groupRank = LOGO_RANK[group.logoSource] ?? LOGO_RANK.image;
    const entryRank = LOGO_RANK[entry.logoSource] ?? LOGO_RANK.image;
    if (group.logoUrl && groupRank < LOGO_RANK.image && (!entry.logoUrl || groupRank < entryRank)) {
      entry.logoUrl = group.logoUrl;
      entry.logoSource = group.logoSource;
    }
    entry.wins += group.wins || 0;
    entry.nominations += group.nominations || 0;
    entry.categories.push({
      id: group.wikidataId || group.key || group.label,
      label: categoryNameFromLabel(group.label) || group.label,
      wins: group.wins || 0,
      nominations: group.nominations || 0,
    });
  }

  for (const entry of byCeremony.values()) {
    entry.categories = sortAwardGroups(entry.categories);
  }

  return Array.from(byCeremony.values());
}

/**
 * Wikidata undercounts long-running television — its Primetime Emmy rollup for
 * Breaking Bad is 6 wins against OMDb's 16, because Emmys accumulate per season
 * and the statements are sparse. Without this merge the headline line would sit
 * directly above a tile contradicting it.
 */
export function mergeOmdbCeremonyCounts(ceremonies, awardsStr) {
  const omdbGroups = parseOmdbAwardsFallback(awardsStr);
  if (!omdbGroups.length) return ceremonies;

  const merged = [...ceremonies];

  for (const omdb of omdbGroups) {
    const def = CEREMONY_PATTERNS.find((ceremony) => ceremony.key === omdb.key);
    const existing = def ? merged.find((entry) => def.pattern.test(entry.label)) : null;

    if (existing) {
      existing.wins = Math.max(existing.wins, omdb.wins);
      existing.nominations = Math.max(existing.nominations, omdb.nominations);
      if (!existing.logoUrl) existing.logoUrl = omdb.logoUrl;
    } else {
      // Use the ceremony's proper name, not OMDb's shorthand — otherwise a title
      // with one Wikidata ceremony and one OMDb ceremony shows "Golden Globe
      // Award" beside "Emmys".
      const label = omdb.ceremonyLabel || omdb.label;
      merged.push({
        key: omdb.key,
        label,
        logoUrl: omdb.logoUrl,
        wins: omdb.wins,
        nominations: omdb.nominations,
        rank: def?.rank ?? ceremonyRank(label),
        categories: [],
      });
    }
  }

  return merged;
}

/**
 * Single entry point for the rail: per-category Wikidata groups in, ranked
 * ceremony tiles out, with OMDb's counts folded in for the three ceremonies it
 * knows. Runs at render rather than at fetch so watchlist entries cached by an
 * older build — which hold the flat per-category shape — group correctly too.
 */
export function buildAwardCeremonies(categoryGroups, awardsStr) {
  const grouped = groupAwardsByCeremony(categoryGroups);
  const merged = mergeOmdbCeremonyCounts(grouped, awardsStr);
  return sortAwardGroups(merged.filter((entry) => entry.wins > 0 || entry.nominations > 0));
}

/** Fallback when Wikidata has no award data — regex parse of the OMDb awards string. */
export function parseOmdbAwardsFallback(awardsStr) {
  if (!awardsStr) return [];

  const groups = [];

  for (const def of OMDB_AWARD_DEFS) {
    if (!def.regex.test(awardsStr)) continue;

    const wins = parseOmdbCount(awardsStr, def.winRegex);
    const nominations = parseOmdbCount(awardsStr, def.nominationRegex);
    if (!wins && !nominations) continue;

    groups.push({
      key: def.key,
      label: def.label,
      ceremonyLabel: def.ceremonyLabel,
      logoUrl: def.logoUri,
      wins,
      nominations,
    });
  }

  return sortAwardGroups(groups);
}

/**
 * Wikidata stores a won award as BOTH a nomination (P1411) and a win (P166), so a
 * single trophy used to print "1 Win · 1 Nomination" — two events where there was
 * one. Nominations subsume wins by industry convention, so only the nominations
 * that didn't convert are worth a second clause.
 */
export function formatAwardCounts(group) {
  const wins = group?.wins || 0;
  const nominations = group?.nominations || 0;
  const parts = [];
  if (wins > 0) {
    parts.push(`${wins} ${wins === 1 ? 'Win' : 'Wins'}`);
  }
  if (nominations > wins) {
    parts.push(`${nominations} ${nominations === 1 ? 'Nomination' : 'Nominations'}`);
  }
  return parts.join(' · ');
}

/**
 * Tile counts on two lines. One line can't hold "3 Wins · 9 Nominations" at a
 * tile width that still lets the next tile peek past the screen edge, and the
 * win count deserves the emphasis anyway.
 */
export function awardCountLines(group) {
  const wins = group?.wins || 0;
  const nominations = group?.nominations || 0;

  if (wins > 0) {
    return {
      primary: `${wins} ${wins === 1 ? 'Win' : 'Wins'}`,
      secondary:
        nominations > wins
          ? `${nominations} ${nominations === 1 ? 'Nomination' : 'Nominations'}`
          : null,
    };
  }

  if (nominations > 0) {
    return {
      primary: `${nominations} ${nominations === 1 ? 'Nomination' : 'Nominations'}`,
      secondary: null,
    };
  }

  return { primary: '', secondary: null };
}

/** Same counts, phrased for a screen reader rather than a 140dp tile. */
export function spokenAwardCounts(group) {
  const wins = group?.wins || 0;
  const nominations = group?.nominations || 0;
  if (wins > 0 && nominations > wins) {
    return `won ${wins} of ${nominations} nominations`;
  }
  if (wins > 0) {
    return `won ${wins} ${wins === 1 ? 'award' : 'awards'}`;
  }
  if (nominations > 0) {
    return `${nominations} ${nominations === 1 ? 'nomination' : 'nominations'}`;
  }
  return 'no wins or nominations';
}

/**
 * "Primetime Emmy Award for Outstanding Drama Series" → "Primetime Emmy Award".
 * Standalone awards with no category ("Peabody Awards", "Genesis Award") come
 * back unchanged, which is what we want — they ARE the ceremony.
 */
const CEREMONY_SPLIT = /^(.*?\bAwards?\b)(?:\s*\([^)]*\))?\s+(?:for|of)\s+/i;

export function ceremonyNameFromLabel(label) {
  // Some entities carry the edition in the name ("2018 Teen Choice Awards"),
  // which would otherwise split one ceremony into a tile per year.
  const text = String(label || '')
    .trim()
    .replace(/^\d{4}\s+/, '');
  const match = text.match(CEREMONY_SPLIT);
  return match ? match[1].trim() : text;
}

/** Singular and plural spellings of one ceremony have to land in the same tile. */
export function ceremonyKeyFromName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/awards\b/g, 'award')
    .trim();
}

/** The half of the label the ceremony name doesn't cover, or null. */
export function categoryNameFromLabel(label) {
  const text = String(label || '').trim();
  const match = text.match(CEREMONY_SPLIT);
  if (!match) return null;
  const rest = text.slice(match[0].length).trim();
  return rest || null;
}
