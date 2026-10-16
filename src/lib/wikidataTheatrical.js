// ─── Wikidata Theatrical & Streaming Verification ─────────────────────────────
//
// Queries Wikidata via SPARQL to verify theatrical scale (MPA certification,
// major studio distributor, production budget, box office) and detect
// straight-to-streaming releases (Netflix, Apple TV+, Disney+ IDs/distributors).
//

const WIKIDATA_USER_AGENT = 'Trova/1.0 (juwimana.database@gmail.com)';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const WIKIDATA_TIMEOUT_MS = 6000;

/**
 * Major theatrical distributors recognized in the US market.
 * Matching any of these indicates studio-level theatrical distribution.
 */
export const MAJOR_THEATRICAL_DISTRIBUTOR_REGEX =
  /sony pictures|warner bros|universal pictures|paramount pictures|20th century|walt disney|searchlight|focus features|a24|neon|lionsgate|amazon mgm|metro-goldwyn-mayer|roadside attractions|bleecker street|ifc films|janus films|sony pictures classics|angel studios|gkids|toho|plus m|cj enm|mubi|briarcliff|ketchup entertainment|vertical|republic pictures|united artists/i;

/**
 * Streaming-only platforms that release content straight to consumer devices.
 */
export const STREAMING_ONLY_DISTRIBUTOR_REGEX =
  /^(netflix|apple tv\+?$|disney\+|hulu|peacock|max|hbomax|amazon prime video|shudder|paramount\+|tubi|roku)$/i;

/**
 * Valid US Motion Picture Association (MPA) ratings.
 */
export const VALID_MPA_RATINGS = new Set(['G', 'PG', 'PG-13', 'R', 'NC-17']);

/**
 * Parse raw SPARQL bindings into a structured lookup map keyed by TMDB ID.
 * Kept pure for unit testing.
 *
 * @param {Array<object>} bindings
 * @returns {Map<string, {
 *   distributors: string[],
 *   networks: string[],
 *   netflixId: string | null,
 *   appleId: string | null,
 *   disneyId: string | null,
 *   mpaCert: string | null,
 *   boxOffice: number,
 *   budget: number,
 *   minPubYear: number | null,
 * }>}
 */
export function parseWikidataTheatricalBindings(bindings = []) {
  const map = new Map();
  if (!Array.isArray(bindings)) return map;

  for (const b of bindings) {
    const tmdbId = b.tmdbId?.value;
    if (!tmdbId) continue;

    const distributors = (b.distributors?.value || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    const networks = (b.networks?.value || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    const netflixId = b.nfId?.value ? String(b.nfId.value).trim() : null;
    const appleId = b.apId?.value ? String(b.apId.value).trim() : null;
    const disneyId = b.dsId?.value ? String(b.dsId.value).trim() : null;
    const mpaCert = b.mpa?.value ? String(b.mpa.value).trim() : null;
    const boxOffice = Number(b.boxOffice?.value) || 0;
    const budget = Number(b.budget?.value) || 0;
    const minPubYear = b.minPubDate?.value
      ? parseInt(b.minPubDate.value.slice(0, 4), 10)
      : null;

    map.set(String(tmdbId), {
      distributors,
      networks,
      netflixId,
      appleId,
      disneyId,
      mpaCert,
      boxOffice,
      budget,
      minPubYear: Number.isFinite(minPubYear) ? minPubYear : null,
    });
  }

  return map;
}

/**
 * Build a SPARQL query to batch-lookup theatrical metadata for a list of TMDB IDs.
 *
 * @param {Array<string|number>} tmdbIds
 * @returns {string|null}
 */
export function buildWikidataTheatricalSparql(tmdbIds = []) {
  const cleanIds = Array.from(new Set(tmdbIds.map(String).filter((id) => /^\d+$/.test(id))));
  if (cleanIds.length === 0) return null;

  const valuesClause = cleanIds.map((id) => `"${id}"`).join(' ');

  return `
    SELECT ?tmdbId
      (GROUP_CONCAT(DISTINCT ?distLabel; separator="|") AS ?distributors)
      (GROUP_CONCAT(DISTINCT ?netLabel; separator="|") AS ?networks)
      (SAMPLE(?netflixId) AS ?nfId)
      (SAMPLE(?appleId) AS ?apId)
      (SAMPLE(?disneyId) AS ?dsId)
      (SAMPLE(?mpaCert) AS ?mpa)
      (SAMPLE(?bo) AS ?boxOffice)
      (SAMPLE(?bud) AS ?budget)
      (MIN(?pubDate) AS ?minPubDate)
    WHERE {
      VALUES ?tmdbId { ${valuesClause} }
      ?item wdt:P4947 ?tmdbId .
      OPTIONAL { ?item wdt:P750 ?dist . ?dist rdfs:label ?distLabel FILTER(LANG(?distLabel) = "en") }
      OPTIONAL { ?item wdt:P449 ?net . ?net rdfs:label ?netLabel FILTER(LANG(?netLabel) = "en") }
      OPTIONAL { ?item wdt:P1874 ?netflixId }
      OPTIONAL { ?item wdt:P9586 ?appleId }
      OPTIONAL { ?item wdt:P7595 ?disneyId }
      OPTIONAL { ?item wdt:P14671 ?mpaCert }
      OPTIONAL { ?item wdt:P2142 ?bo }
      OPTIONAL { ?item wdt:P2130 ?bud }
      OPTIONAL { ?item wdt:P577 ?pubDate }
    }
    GROUP BY ?tmdbId
  `;
}

/**
 * Batch-lookup theatrical verification signals from Wikidata for candidate titles.
 * Returns a Map keyed by TMDB movie ID string.
 * Fails safely with an empty Map if Wikidata is unreachable or times out.
 *
 * @param {Array<string|number>} tmdbIds
 * @returns {Promise<Map<string, object>>}
 */
export async function fetchWikidataTheatricalBatch(tmdbIds = []) {
  const sparql = buildWikidataTheatricalSparql(tmdbIds);
  if (!sparql) return new Map();

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), WIKIDATA_TIMEOUT_MS)
    : null;

  try {
    const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparql)}&format=json`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': WIKIDATA_USER_AGENT,
        Accept: 'application/sparql-results+json',
      },
      signal: controller?.signal,
    });

    if (!response.ok) {
      return new Map();
    }

    const data = await response.json();
    return parseWikidataTheatricalBindings(data?.results?.bindings || []);
  } catch {
    // Wikidata is best-effort. If offline, timed out, or rate-limited, fall back safely.
    return new Map();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
