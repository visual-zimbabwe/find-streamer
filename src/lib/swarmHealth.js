// @ts-check

const ENGINE_BASE_URL = 'http://127.0.0.1:8899';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Normalize a 40-char hex or 32-char Base32 BitTorrent infohash to 40-char lowercase hex.
 * @param {string | null | undefined} rawHash
 * @returns {string}
 */
export function normalizeInfoHash(rawHash) {
  const h = String(rawHash || '').trim();
  if (/^[0-9a-fA-F]{40}$/.test(h)) {
    return h.toLowerCase();
  }
  if (/^[a-zA-Z2-7]{32}$/.test(h)) {
    const upper = h.toUpperCase();
    let bits = 0;
    let value = 0;
    let hex = '';
    for (let i = 0; i < upper.length; i += 1) {
      const idx = BASE32_ALPHABET.indexOf(upper[i]);
      if (idx === -1) return h.toLowerCase();
      value = (value << 5) | idx;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        const byteVal = (value >>> bits) & 0xff;
        hex += byteVal.toString(16).padStart(2, '0');
      }
    }
    if (hex.length === 40) return hex.toLowerCase();
  }
  return h.toLowerCase();
}

/**
 * Extract and normalize a btih infohash from a magnet URI.
 * @param {string | null | undefined} magnet
 * @returns {string}
 */
export function extractHashFromMagnet(magnet) {
  if (!magnet || !String(magnet).toLowerCase().includes('btih:')) return '';
  const m = String(magnet).match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return m ? normalizeInfoHash(m[1]) : '';
}

/**
 * Detect archive-wrapped releases (.rar/.zip/.7z) that cannot stream directly.
 * @param {string | null | undefined} name
 * @returns {boolean}
 */
export function isArchiveRelease(name) {
  if (!name) return false;
  return /\b(rar|zip|7z|r00|tar\.gz|archive)\b|\.(rar|zip|7z)\b/i.test(String(name));
}

/**
 * Classify a torrent's playability into { code, badge, color }.
 * Mirrors watchtv/health.py classify_health().
 * @param {{
 *   liveSeeders?: number | null;
 *   liveLeechers?: number;
 *   reportedSeeders?: number;
 *   isArchive?: boolean;
 *   probe?: {
 *     checked?: boolean;
 *     peersFound?: number;
 *     handshakesOk?: number;
 *     peersWithPieces?: number;
 *     fullSeeds?: number;
 *     supportsMetadata?: boolean;
 *     latencyMs?: number;
 *   } | null;
 *   sessionFailed?: boolean;
 *   scrapeVerified?: boolean;
 * }} params
 * @returns {{ code: string; badge: string; color: string }}
 */
export function classifyHealth({
  liveSeeders = null,
  liveLeechers = 0,
  reportedSeeders = 0,
  isArchive = false,
  probe = null,
  sessionFailed = false,
  scrapeVerified = false,
} = {}) {
  if (sessionFailed) {
    return { code: 'FAIL', badge: '✕ FAIL', color: '#EF5350' };
  }
  if (isArchive) {
    return { code: 'ARCHIVE', badge: '✕ ARCH', color: '#EF5350' };
  }

  const seeds =
    scrapeVerified && liveSeeders != null ? Number(liveSeeders) : Number(reportedSeeders) || 0;
  const leechers = Number(liveLeechers) || 0;

  if (probe && probe.checked) {
    if ((probe.fullSeeds || 0) > 0 || (probe.peersWithPieces || 0) > 0) {
      return { code: 'READY', badge: '✓ READY', color: '#4CAF50' };
    }
    if ((probe.handshakesOk || 0) > 0 && seeds > 0) {
      return { code: 'READY', badge: '✓ READY', color: '#4CAF50' };
    }
    if (seeds === 0) {
      return { code: 'DEAD', badge: '✕ DEAD', color: '#8E8E93' };
    }
    if (seeds >= 20) {
      return { code: 'HIGH', badge: '● HIGH', color: '#66BB6A' };
    }
    return { code: 'RISKY', badge: '○ RISKY', color: '#FF7043' };
  }

  if (!scrapeVerified && liveSeeders == null) {
    if (seeds === 0) {
      return { code: 'DEAD', badge: '✕ DEAD', color: '#8E8E93' };
    }
    return { code: 'UNVERIFIED', badge: '? UNVER', color: '#9E9E9E' };
  }

  if (seeds === 0) {
    return { code: 'DEAD', badge: '✕ DEAD', color: '#8E8E93' };
  }
  if (seeds >= 15) {
    return { code: 'HIGH', badge: '● HIGH', color: '#66BB6A' };
  }
  if (seeds >= 3) {
    if (seeds < 5 && leechers > seeds * 10) {
      return { code: 'RISKY', badge: '○ RISKY', color: '#FF7043' };
    }
    return { code: 'FAIR', badge: '◐ FAIR', color: '#E5A93C' };
  }
  return { code: 'RISKY', badge: '○ RISKY', color: '#FF7043' };
}

/**
 * Returns true if a stream should be hidden by default (dead, archive, or < 2 live seeds).
 * @param {any} stream
 * @returns {boolean}
 */
export function isDeadOrArchiveStream(stream) {
  if (!stream) return true;
  const code = stream.health?.code;
  if (code === 'DEAD' || code === 'ARCHIVE' || code === 'FAIL') return true;
  if (code === 'READY') return false;
  const seeds =
    stream.scrapeVerified && stream.liveSeeders != null
      ? stream.liveSeeders
      : Number(stream.seeders) || 0;
  if (stream.scrapeVerified && seeds < 2) return true;
  if (!stream.scrapeVerified && seeds === 0) return true;
  return false;
}

/**
 * Layer 1: Batch BEP-15 UDP tracker scrape (+ optional Nyaa HTTP scrape) via native Go engine.
 * Gracefully degrades to { ok: false, stats: {} } when the engine is unavailable.
 * @param {string[]} infoHashes
 * @param {{ nyaaHashes?: string[]; timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean; trackersResponded: number; stats: Record<string, { seeders: number; leechers: number; trackersResponded: number }> }>}
 */
export async function scrapeSwarmsNative(infoHashes, { nyaaHashes = [], timeoutMs = 1500 } = {}) {
  const validHashes = infoHashes.filter((h) => /^[0-9a-f]{40}$/.test(h));
  if (!validHashes.length) {
    return { ok: false, trackersResponded: 0, stats: {} };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 1000);
    const res = await fetch(`${ENGINE_BASE_URL}/swarm/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        infoHashes: validHashes,
        nyaaHashes,
        timeoutMs,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, trackersResponded: 0, stats: {} };
    const data = await res.json();
    return {
      ok: Boolean(data?.ok),
      trackersResponded: Number(data?.trackersResponded) || 0,
      stats: data?.stats || {},
    };
  } catch {
    return { ok: false, trackersResponded: 0, stats: {} };
  }
}

/**
 * Layer 2: Active TCP BitTorrent peer-reachability probe via native Go engine.
 * Gracefully degrades to { ok: false, probes: {} } when the engine is unavailable.
 * @param {string[]} infoHashes
 * @param {{ maxPeers?: number; timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean; probes: Record<string, any> }>}
 */
export async function probeSwarmsNative(infoHashes, { maxPeers = 24, timeoutMs = 1800 } = {}) {
  const validHashes = infoHashes.filter((h) => /^[0-9a-f]{40}$/.test(h));
  if (!validHashes.length) {
    return { ok: false, probes: {} };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 1500);
    const res = await fetch(`${ENGINE_BASE_URL}/swarm/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        infoHashes: validHashes,
        maxPeers,
        timeoutMs,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, probes: {} };
    const data = await res.json();
    return {
      ok: Boolean(data?.ok),
      probes: data?.probes || {},
    };
  } catch {
    return { ok: false, probes: {} };
  }
}

/**
 * Enrich candidates with Layer 1 live UDP scrape + Layer 2 TCP peer probe + health classification.
 * @template T
 * @param {T[]} candidates
 * @param {{
 *   verifyHealth?: boolean;
 *   probeTopN?: number;
 *   preRank?: (a: any, b: any) => number;
 * }} [options]
 * @returns {Promise<T[]>}
 */
export async function verifyAndEnrichSwarms(
  candidates,
  { verifyHealth = true, probeTopN = 6, preRank } = {},
) {
  if (!Array.isArray(candidates) || !candidates.length) return [];

  // Initialize archive flags & defaults
  const items = candidates.map((item) => ({
    ...item,
    isArchive: isArchiveRelease(item.name),
    liveSeeders: null,
    liveLeechers: null,
    scrapeVerified: false,
    probe: null,
  }));

  if (verifyHealth) {
    const allHashes = items.map((c) => c.infoHash).filter(Boolean);
    const nyaaHashes = items
      .filter((c) => c.isNyaa || /\b(nyaa|subsplease)\b/i.test(c.source || ''))
      .map((c) => c.infoHash)
      .filter(Boolean);

    const scrape = await scrapeSwarmsNative(allHashes, { nyaaHashes });
    if (scrape.ok && scrape.stats) {
      for (const item of items) {
        const st = scrape.stats[item.infoHash];
        if (st) {
          item.liveSeeders = Number(st.seeders) || 0;
          item.liveLeechers = Number(st.leechers) || 0;
          item.scrapeVerified = true;
          item.seeders = item.liveSeeders;
          item.leechers = item.liveLeechers;
        }
      }
    }

    // Pre-rank so we probe the most promising non-archive candidates
    const orderedForProbe = [...items].filter((c) => !c.isArchive && (c.seeders || 0) > 0);
    if (typeof preRank === 'function') {
      orderedForProbe.sort(preRank);
    } else {
      orderedForProbe.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
    }

    const toProbe = orderedForProbe
      .slice(0, probeTopN)
      .map((c) => c.infoHash)
      .filter(Boolean);

    if (toProbe.length) {
      const probeRes = await probeSwarmsNative(toProbe);
      if (probeRes.ok && probeRes.probes) {
        for (const item of items) {
          const p = probeRes.probes[item.infoHash];
          if (p) {
            item.probe = p;
          }
        }
      }
    }
  }

  for (const item of items) {
    item.health = classifyHealth({
      liveSeeders: item.liveSeeders,
      liveLeechers: item.liveLeechers ?? item.leechers ?? 0,
      reportedSeeders: item.seeders,
      isArchive: item.isArchive,
      probe: item.probe,
      scrapeVerified: item.scrapeVerified,
    });
  }

  return items;
}
