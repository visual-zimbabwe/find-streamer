import { lookupCommonsThumb, resolveCommonsThumbUrls } from './wikidataSoundtracks.js';

const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';
const WIKIDATA_USER_AGENT = 'Trova/1.0 (juwimana.database@gmail.com)';

const CEREMONY_PATTERNS = [
  { key: 'oscar', pattern: /academy award|\boscar\b/i, fallbackFile: 'Oscar-free-version.svg' },
  { key: 'globe', pattern: /golden globe/i, fallbackFile: 'Golden Globe trophy.png' },
  { key: 'emmy', pattern: /\bemmy\b/i, fallbackFile: 'Emmy Statuette.jpg' },
  { key: 'hugo', pattern: /hugo award/i, fallbackFile: 'Hugo Award rocket.svg' },
  { key: 'bafta', pattern: /\bbafta\b/i, fallbackFile: 'BAFTA mask.svg' },
];

function isEntityUri(val) {
  return typeof val === 'string' && val.startsWith(ENTITY_URI_PREFIX);
}

function awardLogoFromBinding(icon, logo, image, parentIcon, parentLogo, parentImage, thumbMap) {
  return (
    lookupCommonsThumb(icon, thumbMap) ||
    lookupCommonsThumb(parentIcon, thumbMap) ||
    lookupCommonsThumb(logo, thumbMap) ||
    lookupCommonsThumb(image, thumbMap) ||
    lookupCommonsThumb(parentLogo, thumbMap) ||
    lookupCommonsThumb(parentImage, thumbMap)
  );
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
    if (mediaType === 'tv') clauses.push(`?item wdt:P4985 "${tmdbId}"`);
    else clauses.push(`?item wdt:P9721 "${tmdbId}"`);
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
    SELECT ?award ?awardLabel ?awardIcon ?awardLogo ?awardImage ?awardParentIcon ?awardParentLogo ?awardParentImage WHERE {
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
    SELECT ?award ?awardLabel ?awardIcon ?awardLogo ?awardImage ?awardParentIcon ?awardParentLogo ?awardParentImage WHERE {
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
      logoUrl: awardLogoFromBinding(
        icon,
        logo,
        image,
        parentIcon,
        parentLogo,
        parentImage,
        thumbMap,
      ),
      wins: 0,
      nominations: 0,
    });
  }

  const entry = map.get(wikidataId);
  if (awardLabel && entry.label === wikidataId) {
    entry.label = awardLabel;
  }

  const logoUrl = awardLogoFromBinding(
    icon,
    logo,
    image,
    parentIcon,
    parentLogo,
    parentImage,
    thumbMap,
  );
  if (logoUrl) entry.logoUrl = logoUrl;

  entry[field] += 1;
}

function inheritCeremonyLogos(groups, thumbMap) {
  const logoByCeremony = new Map();

  for (const group of groups) {
    if (!group.logoUrl) continue;
    for (const ceremony of CEREMONY_PATTERNS) {
      if (ceremony.pattern.test(group.label)) {
        logoByCeremony.set(ceremony.key, group.logoUrl);
      }
    }
  }

  return groups.map((group) => {
    if (group.logoUrl) return group;

    for (const ceremony of CEREMONY_PATTERNS) {
      if (!ceremony.pattern.test(group.label)) continue;

      const inheritedLogo =
        logoByCeremony.get(ceremony.key) || lookupCommonsThumb(ceremony.fallbackFile, thumbMap);

      if (inheritedLogo) {
        return { ...group, logoUrl: inheritedLogo };
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
    regex: /emmys?|emmy awards?/i,
    winRegex: /won\s+(\d+)\s+(?:primetime\s+|daytime\s+|international\s+)?(?:emmys?|emmy awards?)/i,
    nominationRegex:
      /(?:nominated\s+for\s+(\d+)\s+(?:an?\s+)?(?:primetime\s+|daytime\s+|international\s+)?(?:emmys?|emmy awards?)|(\d+)\s+nomination(?:s)?\s+for\s+(?:an?\s+)?(?:primetime\s+|daytime\s+|international\s+)?(?:emmys?|emmy awards?))/i,
    logoUri: 'https://www.televisionacademy.com/build/assets/tva-logo.png',
  },
  {
    key: 'globe',
    label: 'Golden Globes',
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
      logoUrl: def.logoUri,
      wins,
      nominations,
    });
  }

  return sortAwardGroups(groups);
}

export function formatAwardCounts(group) {
  const parts = [];
  if (group.wins > 0) {
    parts.push(`${group.wins} ${group.wins === 1 ? 'Win' : 'Wins'}`);
  }
  if (group.nominations > 0) {
    parts.push(`${group.nominations} ${group.nominations === 1 ? 'Nomination' : 'Nominations'}`);
  }
  return parts.join(' · ');
}
