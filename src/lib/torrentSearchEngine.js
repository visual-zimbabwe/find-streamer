// @ts-check

/**
 * High-reliability Tier-1 public announce trackers (from watchtv).
 * Attached to all magnet links to guarantee instant peer discovery on mobile networks.
 */
export const PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://tracker.internetwarriors.net:1337/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'udp://movies.zsw.ca:6969/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev',
];

export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'and', 'or', 'to', 'for', 'on', 'with',
  'at', 'by', 'from', 'del', 'la', 'le', 'il', 'lo', 'un', 'una', 'de',
  'di', 'el', 'los', 'las', 'der', 'die', 'das',
]);

const REQUEST_TIMEOUT_MS = 6000;

/**
 * Sanitizes user search query by stripping punctuation and normalizing spaces.
 * @param {string} query
 * @returns {string}
 */
export function sanitizeQuery(query) {
  if (!query) return '';
  return query
    .replace(/['":?!,]/g, '')
    .replace(/[._\-+/[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats byte values into GiB, MiB, or KiB strings.
 * @param {number | string} bytesVal
 * @returns {string}
 */
export function formatSize(bytesVal) {
  try {
    const b = Number(bytesVal);
    if (!Number.isFinite(b) || b <= 0) return 'N/A';
    if (b >= 1024 * 1024 * 1024) {
      return `${(b / (1024 ** 3)).toFixed(2)} GiB`;
    } else if (b >= 1024 * 1024) {
      return `${(b / (1024 ** 2)).toFixed(1)} MiB`;
    }
    return `${(b / 1024).toFixed(0)} KiB`;
  } catch {
    return 'N/A';
  }
}

/**
 * Checks if a release name represents a complete season pack or batch.
 * @param {string} name
 * @returns {boolean}
 */
export function isSeasonPack(name) {
  if (!name) return false;
  const norm = name.toLowerCase();
  const packPattern = /\b(complete|season\s*\d+\b|s\d{1,2}(?!\s*e\d{1,2})\b|s\d{1,2}-s\d{1,2}|batch|all\s*episodes|pack)\b/;
  const singleEpPattern = /\bs\d{1,2}e\d{1,2}\b/;

  if (packPattern.test(norm)) {
    if (!singleEpPattern.test(norm)) return true;
    if (norm.includes('complete') || norm.includes('batch') || norm.includes('pack')) return true;
  }
  return false;
}

/**
 * Enhances a bare infohash or existing magnet link with Tier-1 public trackers.
 * @param {string} magnetOrHash
 * @param {string} [displayName]
 * @param {string[]} [extraTrackers]
 * @returns {string}
 */
export function enhanceMagnet(magnetOrHash, displayName = '', extraTrackers = []) {
  if (!magnetOrHash) return '';
  let magnet = magnetOrHash.trim();

  // If bare infohash (SHA-1 40 hex chars or 64 chars)
  if (!magnet.startsWith('magnet:')) {
    const isHash = /^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$/.test(magnet);
    if (isHash) {
      magnet = `magnet:?xt=urn:btih:${magnet}`;
      if (displayName) {
        magnet += `&dn=${encodeURIComponent(displayName)}`;
      }
    } else {
      return magnet;
    }
  }

  const allTrackers = [...PUBLIC_TRACKERS, ...(Array.isArray(extraTrackers) ? extraTrackers : [])];
  // Inject trackers not already present in the magnet URL
  const existingLower = magnet.toLowerCase();
  const seenTrackers = new Set();
  const missingTrackers = allTrackers.filter((tracker) => {
    if (!tracker || seenTrackers.has(tracker)) return false;
    seenTrackers.add(tracker);
    return !existingLower.includes(encodeURIComponent(tracker).toLowerCase()) && !existingLower.includes(tracker.toLowerCase());
  });

  const trackerParams = missingTrackers.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
  return magnet + trackerParams;
}

/**
 * Parses release attributes: resolution, codec, audio/subs tags.
 * @param {string} name
 * @returns {{
 *   resolution: '4K' | '1080p' | '720p' | '480p' | 'HD';
 *   codec: string | null;
 *   is10Bit: boolean;
 *   hasMultiAudio: boolean;
 *   hasSubtitles: boolean;
 * }}
 */
export function parseReleaseAttributes(name) {
  const norm = (name || '').toLowerCase();

  let resolution = 'HD';
  if (/\b(2160p|4k|uhd)\b/.test(norm)) resolution = '4K';
  else if (/\b(1080p|1080i|fhd)\b/.test(norm)) resolution = '1080p';
  else if (/\b(720p|hd)\b/.test(norm)) resolution = '720p';
  else if (/\b(480p|576p|sd|dvdrip|xvid)\b/.test(norm)) resolution = '480p';

  let codec = null;
  if (/\b(x265|hevc|h265|h\.265)\b/.test(norm)) codec = 'x265';
  else if (/\b(x264|avc|h264|h\.264)\b/.test(norm)) codec = 'x264';

  const is10Bit = /\b(10bit|10-bit)\b/.test(norm);
  const hasMultiAudio = /\b(multi|multisubs?|dual[\s-]audio)\b/.test(norm);
  const hasSubtitles = /\b(esub|esubs|sub|subs|subbed)\b/.test(norm) || hasMultiAudio;

  return {
    resolution,
    codec,
    is10Bit,
    hasMultiAudio,
    hasSubtitles,
  };
}

/**
 * Extracts season and episode numbers from release title.
 * Handles: S01E02, s1e2, 1x02, Season 1 Episode 2, etc.
 * @param {string} name
 * @returns {{ season: number | null; episode: number | null }}
 */
export function extractSeasonEpisode(name) {
  if (!name) return { season: null, episode: null };
  const sxe = name.match(/\bS(\d{1,2})[\s._-]?E(\d{1,3})\b/i);
  if (sxe) {
    return {
      season: parseInt(sxe[1], 10),
      episode: parseInt(sxe[2], 10),
    };
  }
  const xMatch = name.match(/\b(\d{1,2})x(\d{1,3})\b/i);
  if (xMatch) {
    return {
      season: parseInt(xMatch[1], 10),
      episode: parseInt(xMatch[2], 10),
    };
  }
  const seWords = name.match(/\bSeason[\s._-]?(\d{1,2})[\s._-]?Episode[\s._-]?(\d{1,3})\b/i);
  if (seWords) {
    return {
      season: parseInt(seWords[1], 10),
      episode: parseInt(seWords[2], 10),
    };
  }
  return { season: null, episode: null };
}

/**
 * Computes a relevance match score between a release name and query criteria.
 * @param {string} releaseName
 * @param {string} query
 * @param {{ season?: number | string; episode?: number | string; year?: number | string }} [options]
 * @returns {number}
 */
export function calculateMatchScore(releaseName, query, options = {}) {
  const normRelease = sanitizeQuery(releaseName).toLowerCase();
  const normQuery = sanitizeQuery(query).toLowerCase();

  const releaseWords = normRelease.split(/\s+/).filter(Boolean);
  const queryWords = normQuery.split(/\s+/).filter(Boolean);

  if (!queryWords.length) return 0;

  const sigQueryWords = queryWords.filter((w) => !STOP_WORDS.has(w));
  const testWords = sigQueryWords.length ? sigQueryWords : queryWords;

  let matchedCount = 0;
  for (const qWord of testWords) {
    const stem = qWord.endsWith('s') && qWord.length > 3 ? qWord.slice(0, -1) : qWord;
    const isShort = stem.length <= 3;
    if (releaseWords.some((rw) => (isShort ? rw === stem : rw === stem || rw.startsWith(stem)))) {
      matchedCount += 1;
    }
  }

  // Must match at least significant query words
  if (matchedCount < testWords.length) return 0;

  let score = 10;
  const queryPhrase = queryWords.join(' ');
  const sigPhrase = testWords.join(' ');

  if (normRelease.includes(queryPhrase)) {
    score += 100;
  } else if (normRelease.includes(sigPhrase)) {
    score += 80;
  }

  // Movie-specific filtering and scoring
  if (options.isMovie) {
    const parsedSe = extractSeasonEpisode(releaseName);
    if (parsedSe.season != null && parsedSe.episode != null) {
      return 0; // Exclude TV episodes
    }
    if (isSeasonPack(releaseName)) {
      return 0; // Exclude season packs
    }
    if (/\b(s\d{1,2}e\d{1,2}|season\s*\d+|complete\s*series)\b/i.test(normRelease)) {
      return 0; // Exclude TV shows
    }

    if (options.year) {
      const targetYear = Number(options.year);
      const yearMatch = normRelease.match(/\b(19\d\d|20\d\d)\b/);
      if (yearMatch) {
        const relYear = Number(yearMatch[1]);
        const diff = Math.abs(relYear - targetYear);
        if (diff > 1) {
          return 0; // Exclude different movies
        }
        if (diff === 0) {
          score += 60;
        } else if (diff === 1) {
          score += 30;
        }
      }
      if (normRelease.includes(`${normQuery} ${options.year}`)) {
        score += 40;
      }
    }
  } else {
    // TV show logic
    // Year bonus
    if (options.year && normRelease.includes(String(options.year))) {
      score += 40;
    }

    // Season Pack bonus
    if (isSeasonPack(releaseName)) {
      score += 30;
    }

    // Episode target validation & bonus
    if (options.episode != null && options.season != null) {
      const sNum = Number(options.season);
      const eNum = Number(options.episode);
      const parsed = extractSeasonEpisode(releaseName);
      if (parsed.season != null && parsed.episode != null) {
        if (parsed.season !== sNum || parsed.episode !== eNum) {
          return 0; // Explicitly reject mismatching season or episode
        }
        score += 180;
      } else {
        const epTokens = [
          `s${String(sNum).padStart(2, '0')}e${String(eNum).padStart(2, '0')}`,
          `s${sNum}e${eNum}`,
          `${sNum}x${String(eNum).padStart(2, '0')}`,
          `${sNum}x${eNum}`,
        ];
        if (epTokens.some((tok) => normRelease.includes(tok))) {
          score += 150;
        } else {
          return 0; // Exclude non-matching releases for episode queries
        }
      }
    }
  }

  return score;
}

/**
 * Fetch torrents from APIBay.
 * @param {string} query
 * @param {string | null} [category]
 * @returns {Promise<Array<{
 *   name: string;
 *   infoHash: string;
 *   seeders: number;
 *   size: number;
 *   source: string;
 *   magnetUrl: string;
 *   imdb?: string | null;
 * }>>}
 */
export async function fetchApibay(query, category = null) {
  try {
    const clean = sanitizeQuery(query);
    if (!clean) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let url = `https://apibay.org/q.php?q=${encodeURIComponent(clean)}`;
    if (category) {
      url += `&cat=${category}`;
    }
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Trova)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) || !data.length || data[0].name === 'No results returned') {
      return [];
    }

    return data
      .filter((item) => item.info_hash && item.info_hash !== '0000000000000000000000000000000000000000')
      .map((item) => ({
        name: item.name || 'Unknown Title',
        infoHash: item.info_hash.toLowerCase(),
        seeders: Number(item.seeders) || 0,
        size: Number(item.size) || 0,
        source: 'apibay',
        magnetUrl: enhanceMagnet(item.info_hash, item.name),
        imdb: item.imdb || null,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch torrents from EZTV API.
 * @param {{ search?: string; imdbId?: string | number; season?: number; episode?: number }} params
 * @returns {Promise<Array<{
 *   name: string;
 *   infoHash: string;
 *   seeders: number;
 *   size: number;
 *   source: string;
 *   magnetUrl: string;
 *   season?: number;
 *   episode?: number;
 * }>>}
 */
export async function fetchEztv({ search, imdbId, season, episode }) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let url = 'https://eztvx.to/api/get-torrents?limit=100';
    if (imdbId) {
      const cleanImdb = String(imdbId).replace(/^tt/, '');
      url += `&imdb_id=${cleanImdb}`;
    } else if (search) {
      const clean = sanitizeQuery(search);
      url += `&search=${encodeURIComponent(clean)}`;
    } else {
      return [];
    }

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Trova)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    const torrents = data?.torrents;
    if (!Array.isArray(torrents) || !torrents.length) return [];

    return torrents
      .filter((item) => item.hash)
      .map((item) => {
        const itemSeason = Number(item.season) || null;
        const itemEpisode = Number(item.episode) || null;
        const name = item.title || item.filename || 'Unknown Series';
        return {
          name,
          infoHash: item.hash.toLowerCase(),
          seeders: Number(item.seeds) || 0,
          size: Number(item.size_bytes) || 0,
          source: 'eztv',
          magnetUrl: enhanceMagnet(item.magnet_url || item.hash, name),
          season: itemSeason,
          episode: itemEpisode,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Parses byte size string from Torrentio stream title (e.g. "1.54 GB" or "744.37 MB").
 * @param {string} title
 * @returns {number}
 */
export function parseTorrentioSize(title) {
  if (!title) return 0;
  const match = title.match(new RegExp('\\u{1F4BE}\\s*([0-9.]+)\\s*([KMGT]?B)', 'iu'));
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB' || unit === 'GIB') return Math.round(num * 1024 * 1024 * 1024);
  if (unit === 'MB' || unit === 'MIB') return Math.round(num * 1024 * 1024);
  if (unit === 'KB' || unit === 'KIB') return Math.round(num * 1024);
  if (unit === 'TB' || unit === 'TIB') return Math.round(num * 1024 * 1024 * 1024 * 1024);
  return Math.round(num);
}

/**
 * Parses seeder count from Torrentio stream title (e.g. 78 seeds).
 * @param {string} title
 * @returns {number}
 */
export function parseTorrentioSeeders(title) {
  if (!title) return 0;
  const match = title.match(new RegExp('\\u{1F464}\\s*(\\d+)', 'u'));
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parses provider source name from Torrentio stream title (e.g. YTS).
 * @param {string} title
 * @returns {string}
 */
export function parseTorrentioSource(title) {
  if (!title) return 'torrentio';
  const match = title.match(new RegExp('\\u{2699}(?:\\u{FE0F})?\\s*([^\\n\\r]+)', 'u'));
  return match ? match[1].trim() : 'torrentio';
}

/**
 * Fetch torrents from Torrentio provider aggregator (1337x, YTS, TorrentGalaxy, Rutracker).
 * @param {{
 *   imdbId: string;
 *   season?: number | string;
 *   episode?: number | string;
 * }} params
 * @returns {Promise<Array<{
 *   name: string;
 *   infoHash: string;
 *   seeders: number;
 *   size: number;
 *   source: string;
 *   magnetUrl: string;
 *   fileIdx?: number | null;
 *   season?: number;
 *   episode?: number;
 * }>>}
 */
export async function fetchTorrentio({ imdbId, season, episode }) {
  try {
    if (!imdbId) return [];
    const cleanImdb = String(imdbId).startsWith('tt') ? String(imdbId) : `tt${imdbId}`;
    let url = '';
    if (season != null && episode != null) {
      url = `https://torrentio.strem.fun/stream/series/${cleanImdb}:${season}:${episode}.json`;
    } else {
      url = `https://torrentio.strem.fun/stream/movie/${cleanImdb}.json`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Trova)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    const streams = data?.streams;
    if (!Array.isArray(streams) || !streams.length) return [];

    return streams
      .filter((item) => item.infoHash)
      .map((item) => {
        const titleStr = item.title || '';
        const lines = titleStr.split('\n').map((l) => l.trim()).filter(Boolean);
        const name = item.behaviorHints?.filename || lines[0] || 'Unknown Release';
        const seeders = parseTorrentioSeeders(titleStr);
        const size = parseTorrentioSize(titleStr);
        const source = parseTorrentioSource(titleStr);
        const extraTrackers = Array.isArray(item.sources)
          ? item.sources
              .filter((s) => typeof s === 'string' && s.startsWith('tracker:'))
              .map((s) => s.slice(8))
          : [];

        return {
          name,
          infoHash: item.infoHash.toLowerCase(),
          seeders,
          size,
          source: `torrentio (${source})`,
          magnetUrl: enhanceMagnet(item.infoHash, name, extraTrackers),
          fileIdx: typeof item.fileIdx === 'number' ? item.fileIdx : null,
          season: season != null ? Number(season) : undefined,
          episode: episode != null ? Number(episode) : undefined,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Resolves IMDb ID by title and optional media type via Cinemeta catalog API.
 * @param {string} title
 * @param {'movie' | 'series'} [type]
 * @returns {Promise<string | null>}
 */
export async function resolveImdbId(title, type = 'movie') {
  try {
    const clean = sanitizeQuery(title);
    if (!clean) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(clean)}.json`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Trova)',
        },
      },
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.metas?.[0]?.imdb_id || data?.metas?.[0]?.id || null;
  } catch {
    return null;
  }
}

function resolutionBonus(res) {
  if (res === '1080p') return 80;
  if (res === '720p') return 60;
  if (res === '4K') return 40;
  if (res === 'HD') return 30;
  return 10;
}

/**
 * High-level search for a specific TV episode across Torrentio, APIBay, and EZTV.
 * @param {{
 *   seriesTitle: string;
 *   seasonNumber: number;
 *   episodeNumber: number;
 *   imdbId?: string | null;
 * }} params
 * @returns {Promise<Array<{
 *   name: string;
 *   infoHash: string;
 *   seeders: number;
 *   size: number;
 *   formattedSize: string;
 *   source: string;
 *   magnetUrl: string;
 *   fileIdx?: number | null;
 *   score: number;
 *   attributes: ReturnType<typeof parseReleaseAttributes>;
 * }>>}
 */
export async function searchEpisodeTorrents({ seriesTitle, seasonNumber, episodeNumber, imdbId }) {
  const sStr = String(seasonNumber).padStart(2, '0');
  const eStr = String(episodeNumber).padStart(2, '0');
  const epTag = `S${sStr}E${eStr}`;
  const query = `${seriesTitle} ${epTag}`;

  const cleanTitle = sanitizeQuery(seriesTitle);
  let cleanImdb = imdbId ? (String(imdbId).startsWith('tt') ? String(imdbId) : `tt${imdbId}`) : null;
  if (!cleanImdb && cleanTitle) {
    cleanImdb = await resolveImdbId(cleanTitle, 'series');
  }

  // Concurrently query sources targeted at this specific episode
  const queries = [
    fetchApibay(query),
    fetchApibay(`${cleanTitle} ${seasonNumber}x${eStr}`),
    fetchEztv({ imdbId: cleanImdb || imdbId, search: `${cleanTitle} ${epTag}` }),
  ];

  if (cleanImdb) {
    queries.push(
      fetchTorrentio({ imdbId: cleanImdb, season: seasonNumber, episode: episodeNumber }),
    );
  }

  const resultsArrays = await Promise.all(queries);
  const rawCandidates = resultsArrays.flat();

  const seen = new Set();
  const scored = [];

  for (const item of rawCandidates) {
    if (!item.infoHash || seen.has(item.infoHash)) continue;
    seen.add(item.infoHash);

    const isTorrentioExact = item.source?.startsWith('torrentio');

    // Reject pure season packs for single episode searches
    if (!isTorrentioExact && isSeasonPack(item.name)) {
      const parsed = extractSeasonEpisode(item.name);
      if (parsed.season !== seasonNumber || parsed.episode !== episodeNumber) {
        continue;
      }
    }

    // If item comes from EZTV and has explicit season/episode metadata
    if (item.source === 'eztv' && item.season && item.episode) {
      if (item.season !== seasonNumber || item.episode !== episodeNumber) {
        continue;
      }
    }

    // Verify parsed season/episode matches if present in title
    if (!isTorrentioExact) {
      const parsed = extractSeasonEpisode(item.name);
      if (parsed.season != null && parsed.episode != null) {
        if (parsed.season !== seasonNumber || parsed.episode !== episodeNumber) {
          continue;
        }
      }
    }

    let score = calculateMatchScore(item.name, cleanTitle, {
      season: seasonNumber,
      episode: episodeNumber,
    });

    if (score <= 0 && isTorrentioExact) {
      score = 250;
    }

    if (score > 0) {
      scored.push({
        ...item,
        score,
        formattedSize: formatSize(item.size),
        attributes: parseReleaseAttributes(item.name),
      });
    }
  }

  // Rank active swarms strictly above dead (0 seeders) swarms
  scored.sort((a, b) => {
    const aHasSeeds = a.seeders > 0;
    const bHasSeeds = b.seeders > 0;
    if (aHasSeeds !== bHasSeeds) {
      return aHasSeeds ? -1 : 1;
    }

    const aDubOnly = /\b(telugu-dub|tamil-dub|hindi-dub|bengali-dub)\b/i.test(a.name) ? -100 : 0;
    const bDubOnly = /\b(telugu-dub|tamil-dub|hindi-dub|bengali-dub)\b/i.test(b.name) ? -100 : 0;

    const aWeight =
      a.score * 50 + Math.min(a.seeders, 500) * 5 + resolutionBonus(a.attributes?.resolution) + aDubOnly;
    const bWeight =
      b.score * 50 + Math.min(b.seeders, 500) * 5 + resolutionBonus(b.attributes?.resolution) + bDubOnly;
    return bWeight - aWeight;
  });

  return scored;
}

/**
 * High-level search for complete TV Season Packs.
 * @param {{
 *   seriesTitle: string;
 *   seasonNumber: number;
 *   imdbId?: string | null;
 * }} params
 * @returns {Promise<Array<{
 *   name: string;
 *   infoHash: string;
 *   seeders: number;
 *   size: number;
 *   formattedSize: string;
 *   source: string;
 *   magnetUrl: string;
 *   score: number;
 *   attributes: ReturnType<typeof parseReleaseAttributes>;
 * }>>}
 */
export async function searchSeasonPackTorrents({ seriesTitle, seasonNumber, imdbId }) {
  const sStr = String(seasonNumber).padStart(2, '0');
  const cleanTitle = sanitizeQuery(seriesTitle);

  const [apibaySeason, apibaySeries, eztvResults] = await Promise.all([
    fetchApibay(`${cleanTitle} Season ${seasonNumber}`),
    fetchApibay(`${cleanTitle} S${sStr}`),
    fetchEztv({ imdbId, search: `${cleanTitle} S${sStr}` }),
  ]);

  const rawCandidates = [...apibaySeason, ...apibaySeries, ...eztvResults];
  const seen = new Set();
  const packs = [];

  for (const item of rawCandidates) {
    if (!item.infoHash || seen.has(item.infoHash)) continue;
    seen.add(item.infoHash);

    // Filter to ensure it represents this season and is a pack
    const norm = item.name.toLowerCase();
    const hasSeason =
      norm.includes(`s${sStr}`) ||
      norm.includes(`season ${seasonNumber}`) ||
      norm.includes(`season ${sStr}`);
    if (!hasSeason) continue;

    // Reject single episode releases (e.g. S01E05) unless marked complete/batch
    const isPack = isSeasonPack(item.name) || (item.source === 'eztv' && item.episode === 0);
    if (!isPack) continue;

    const score = calculateMatchScore(item.name, cleanTitle, { season: seasonNumber });
    packs.push({
      ...item,
      score,
      formattedSize: formatSize(item.size),
      attributes: parseReleaseAttributes(item.name),
    });
  }

  packs.sort((a, b) => {
    const aHasSeeds = a.seeders > 0;
    const bHasSeeds = b.seeders > 0;
    if (aHasSeeds !== bHasSeeds) return aHasSeeds ? -1 : 1;
    return b.seeders - a.seeders;
  });
  return packs;
}

/**
 * High-level search for Movie torrents across Torrentio (1337x, YTS, TorrentGalaxy, Rutracker) and APIBay.
 * @param {{
 *   title: string;
 *   year?: number | string | null;
 *   imdbId?: string | null;
 * }} params
 * @returns {Promise<Array<{
 *   name: string;
 *   infoHash: string;
 *   seeders: number;
 *   size: number;
 *   formattedSize: string;
 *   source: string;
 *   magnetUrl: string;
 *   fileIdx?: number | null;
 *   score: number;
 *   attributes: ReturnType<typeof parseReleaseAttributes>;
 * }>>}
 */
export async function searchMovieTorrents({ title, year, imdbId }) {
  const cleanTitle = sanitizeQuery(title);
  if (!cleanTitle && !imdbId) return [];

  let cleanImdb = imdbId ? (String(imdbId).startsWith('tt') ? String(imdbId) : `tt${imdbId}`) : null;
  if (!cleanImdb && cleanTitle) {
    cleanImdb = await resolveImdbId(cleanTitle, 'movie');
  }

  const queries = [];
  if (cleanImdb) {
    queries.push(fetchTorrentio({ imdbId: cleanImdb }));
    queries.push(fetchApibay(cleanImdb));
  }
  if (cleanTitle && year) {
    queries.push(fetchApibay(`${cleanTitle} ${year}`, '200'));
  }
  if (cleanTitle) {
    queries.push(fetchApibay(cleanTitle, '200'));
  }

  const resultsArrays = await Promise.all(queries);
  const rawCandidates = resultsArrays.flat();

  const seen = new Set();
  const scored = [];

  for (const item of rawCandidates) {
    if (!item.infoHash || seen.has(item.infoHash)) continue;
    seen.add(item.infoHash);

    const isTorrentioMatch = item.source?.startsWith('torrentio');

    // Filter and score using movie criteria
    let score = calculateMatchScore(item.name, cleanTitle || title, {
      year,
      isMovie: true,
    });

    // If candidate came from Torrentio by exact IMDb lookup, ensure baseline score
    if (score <= 0 && isTorrentioMatch && cleanImdb) {
      score = 250;
    }

    if (score <= 0) continue;

    // Grant bonus for matching IMDb ID if present
    if (cleanImdb && item.imdb && cleanImdb.replace(/^tt/, '') === String(item.imdb).replace(/^tt/, '')) {
      score += 200;
    }

    scored.push({
      ...item,
      score,
      formattedSize: formatSize(item.size),
      attributes: parseReleaseAttributes(item.name),
    });
  }

  // Rank active swarms strictly above dead (0 seeders) swarms
  scored.sort((a, b) => {
    const aHasSeeds = a.seeders > 0;
    const bHasSeeds = b.seeders > 0;
    if (aHasSeeds !== bHasSeeds) {
      return aHasSeeds ? -1 : 1;
    }

    // Penalize dubbed-only releases
    const aDubOnly = /\b(telugu-dub|tamil-dub|hindi-dub|bengali-dub)\b/i.test(a.name) ? -100 : 0;
    const bDubOnly = /\b(telugu-dub|tamil-dub|hindi-dub|bengali-dub)\b/i.test(b.name) ? -100 : 0;

    const aWeight =
      a.score * 50 + Math.min(a.seeders, 500) * 5 + resolutionBonus(a.attributes?.resolution) + aDubOnly;
    const bWeight =
      b.score * 50 + Math.min(b.seeders, 500) * 5 + resolutionBonus(b.attributes?.resolution) + bDubOnly;
    return bWeight - aWeight;
  });

  return scored;
}

