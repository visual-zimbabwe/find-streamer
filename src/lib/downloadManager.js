import { useEffect, useState, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';
import { toastiva } from 'toastiva';
import { launchStream } from './streamLauncher';

const { TorrentStreamerModule } = NativeModules;

export const MAX_DOWNLOAD_QUOTA_BYTES = 75 * 1024 * 1024 * 1024; // 75 GB
const ENGINE_BASE_URL = 'http://127.0.0.1:8899';

let storeState = {
  downloads: [],
  usedBytes: 0,
  freeBytes: MAX_DOWNLOAD_QUOTA_BYTES,
  maxBytes: MAX_DOWNLOAD_QUOTA_BYTES,
  activeCount: 0,
  loaded: false,
};

const listeners = new Set();
let pollTimer = null;
let isPolling = false;

function notifyListeners() {
  const snapshot = { ...storeState, downloads: [...storeState.downloads] };
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // ignore listener error
    }
  });
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '0 MB';
  const gb = n / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(gb >= 10 ? 1 : 2)} GB`;
  }
  const mb = n / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(0)} MB`;
  }
  const kb = n / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function formatSpeed(bps) {
  const n = Number(bps) || 0;
  if (n <= 0) return '';
  const mbps = n / (1024 * 1024);
  if (mbps >= 1) {
    return `${mbps.toFixed(1)} MB/s`;
  }
  const kbps = n / 1024;
  if (kbps >= 1) {
    return `${kbps.toFixed(0)} KB/s`;
  }
  return `${n} B/s`;
}

export function buildClientDownloadId({ imdbId, tmdbId, season, episode, infoHash, fileIdx }) {
  let base = String(imdbId || '').trim();
  if (!base && tmdbId) {
    base = `tmdb_${tmdbId}`;
  }
  if (!base && infoHash) {
    base = String(infoHash).toLowerCase();
  }
  const s = Number(season) || 0;
  const e = Number(episode) || 0;
  if (s > 0 || e > 0) {
    return `${base}_s${String(s).padStart(2, '0')}e${String(e).padStart(2, '0')}`;
  }
  if (typeof fileIdx === 'number' && fileIdx >= 0) {
    return `${base}_f${fileIdx}`;
  }
  return base;
}

export async function refreshDownloadsStatus() {
  if (isPolling) return storeState;
  isPolling = true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ENGINE_BASE_URL}/download/status`, {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.status) {
        const list = Array.isArray(data.downloads) ? data.downloads : [];
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const prevActive = storeState.activeCount;
        const nextActive = Number(data.activeCount) || 0;

        storeState = {
          downloads: list,
          usedBytes: Number(data.usedBytes) || 0,
          freeBytes:
            typeof data.freeBytes === 'number'
              ? data.freeBytes
              : Math.max(0, MAX_DOWNLOAD_QUOTA_BYTES - (Number(data.usedBytes) || 0)),
          maxBytes: Number(data.maxBytes) || MAX_DOWNLOAD_QUOTA_BYTES,
          activeCount: nextActive,
          loaded: true,
        };
        notifyListeners();

        if (prevActive > 0 && nextActive === 0 && Platform.OS === 'android') {
          if (TorrentStreamerModule?.stopService) {
            TorrentStreamerModule.stopService().catch(() => {});
          }
        }
      }
    }
  } catch {
    // ignore transient poll failure
  } finally {
    isPolling = false;
  }
  return storeState;
}

function ensurePollingLoop() {
  if (pollTimer) return;
  refreshDownloadsStatus();
  pollTimer = setInterval(() => {
    if (listeners.size === 0 && storeState.activeCount === 0) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    refreshDownloadsStatus();
  }, 1500);
}

export function getDownloadsSnapshot() {
  return storeState;
}

export function hasActiveDownloads() {
  return storeState.activeCount > 0;
}

export function findDownloadForMedia({ imdbId, tmdbId, season, episode, infoHash, fileIdx } = {}) {
  const { downloads } = storeState;
  if (!Array.isArray(downloads) || downloads.length === 0) return null;

  const cleanImdb = String(imdbId || '').trim().toLowerCase();
  const numTmdb = Number(tmdbId) || 0;
  const numSeason = Number(season) || 0;
  const numEpisode = Number(episode) || 0;
  const cleanHash = String(infoHash || '').trim().toLowerCase();

  if (cleanHash) {
    const byHash = downloads.find((d) => {
      if (String(d.infoHash || '').toLowerCase() !== cleanHash) return false;
      if (numSeason > 0 || numEpisode > 0) {
        return Number(d.season || 0) === numSeason && Number(d.episode || 0) === numEpisode;
      }
      if (typeof fileIdx === 'number' && fileIdx >= 0 && typeof d.fileIdx === 'number' && d.fileIdx >= 0) {
        return d.fileIdx === fileIdx;
      }
      return true;
    });
    if (byHash) return byHash;
  }

  return (
    downloads.find((d) => {
      const matchImdb = cleanImdb && String(d.imdbId || '').trim().toLowerCase() === cleanImdb;
      const matchTmdb = numTmdb > 0 && Number(d.tmdbId || 0) === numTmdb;
      if (!matchImdb && !matchTmdb) return false;
      if (numSeason > 0 || numEpisode > 0) {
        return Number(d.season || 0) === numSeason && Number(d.episode || 0) === numEpisode;
      }
      return (Number(d.season || 0) === 0 && Number(d.episode || 0) === 0);
    }) || null
  );
}

export async function startDownload(params) {
  const {
    magnet,
    infoHash,
    fileIdx,
    title,
    releaseName,
    mediaType,
    tmdbId,
    imdbId,
    year,
    posterUrl,
    season,
    episode,
    episodeTitle,
    quality,
    codec,
  } = params || {};

  if (!magnet) {
    toastiva.error('Missing stream magnet link');
    return null;
  }

  if (Platform.OS === 'android' && TorrentStreamerModule?.startService) {
    try {
      await TorrentStreamerModule.startService(`Downloading: ${title || 'Media'}`);
    } catch {
      // ignore service start error
    }
  }

  const id = buildClientDownloadId({ imdbId, tmdbId, season, episode, infoHash, fileIdx });

  try {
    const res = await fetch(`${ENGINE_BASE_URL}/download/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        magnet,
        infoHash: infoHash || '',
        fileIdx: typeof fileIdx === 'number' ? fileIdx : -1,
        title: title || 'Untitled',
        releaseName: releaseName || title || '',
        mediaType: mediaType || (season > 0 || episode > 0 ? 'tv' : 'movie'),
        tmdbId: Number(tmdbId) || 0,
        imdbId: String(imdbId || '').trim(),
        year: String(year || ''),
        posterUrl: posterUrl || '',
        season: Number(season) || 0,
        episode: Number(episode) || 0,
        episodeTitle: episodeTitle || '',
        quality: quality || '',
        codec: codec || '',
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.status) {
      toastiva.error(data?.error || 'Could not start download');
      return null;
    }

    toastiva.success(`Downloading ${title || 'video'}...`);
    await refreshDownloadsStatus();
    ensurePollingLoop();
    return data.download;
  } catch {
    toastiva.error('Download engine unavailable');
    return null;
  }
}

export async function pauseDownload(id) {
  if (!id) return false;
  try {
    const res = await fetch(`${ENGINE_BASE_URL}/download/pause?id=${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => null);
    await refreshDownloadsStatus();
    return Boolean(data?.status);
  } catch {
    return false;
  }
}

export async function resumeDownload(id, title) {
  if (!id) return false;
  if (Platform.OS === 'android' && TorrentStreamerModule?.startService) {
    try {
      await TorrentStreamerModule.startService(`Downloading: ${title || 'Media'}`);
    } catch {
      // ignore
    }
  }
  try {
    const res = await fetch(`${ENGINE_BASE_URL}/download/resume?id=${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => null);
    await refreshDownloadsStatus();
    ensurePollingLoop();
    return Boolean(data?.status);
  } catch {
    return false;
  }
}

export async function deleteDownload(id) {
  if (!id) return false;
  try {
    const res = await fetch(`${ENGINE_BASE_URL}/download/delete?id=${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => null);
    toastiva.info('Download deleted');
    await refreshDownloadsStatus();
    return Boolean(data?.status);
  } catch {
    return false;
  }
}

export async function playDownloaded(entry) {
  if (!entry || !entry.id) return false;
  const displayTitle =
    entry.season > 0 && entry.episode > 0
      ? `${entry.title || 'Episode'} S${String(entry.season).padStart(2, '0')}E${String(entry.episode).padStart(2, '0')}`
      : entry.releaseName || entry.title || 'Downloaded Video';

  return launchStream({
    downloadId: entry.id,
    magnetUrl: entry.magnet,
    title: displayTitle,
    fileIdx: typeof entry.fileIdx === 'number' && entry.fileIdx >= 0 ? entry.fileIdx : undefined,
    imdbId: entry.imdbId,
    season: entry.season,
    episode: entry.episode,
    cachedSubtitleUrl: entry.subtitleUrl || null,
  });
}

export function useDownloads() {
  const [state, setState] = useState(storeState);

  useEffect(() => {
    listeners.add(setState);
    ensurePollingLoop();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const getForMedia = useCallback(
    (query) => findDownloadForMedia(query),
    [state.downloads]
  );

  return {
    ...state,
    startDownload,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    playDownloaded,
    refreshDownloadsStatus,
    getForMedia,
    formatBytes,
    formatSpeed,
  };
}
