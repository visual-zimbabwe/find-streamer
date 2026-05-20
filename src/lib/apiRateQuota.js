// In-memory usage / quota hints from API response headers (TMDB, Trakt) plus
// session counts where headers are not available (OMDb).

const listeners = new Set();

function emptyApiState() {
  return {
    limit: null,
    remaining: null,
    resetEpochSec: null,
    retryAfterSec: null,
    rateLimitedAt: null,
    lastUpdated: null,
  };
}

let snapshot = {
  tmdb: { ...emptyApiState() },
  trakt: { ...emptyApiState() },
  omdb: {
    ...emptyApiState(),
    sessionRequests: 0,
    documentedDailyMax: 1000,
    documentedNote:
      'Free OMDb keys are typically capped at 1,000 requests per day. The API does not return remaining quota.',
  },
};

function cloneSnapshot() {
  return {
    tmdb: { ...snapshot.tmdb },
    trakt: { ...snapshot.trakt },
    omdb: { ...snapshot.omdb },
  };
}

function notify() {
  const next = cloneSnapshot();
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore listener errors */
    }
  });
}

/**
 * @param {(s: typeof snapshot) => void} listener
 * @returns {() => void}
 */
export function subscribeRateQuota(listener) {
  listeners.add(listener);
  listener(cloneSnapshot());
  return () => listeners.delete(listener);
}

export function getRateQuotaSnapshot() {
  return cloneSnapshot();
}

function headerValue(headers, name) {
  if (!headers || typeof headers.get !== 'function') return null;
  const v = headers.get(name);
  return v != null && String(v).trim() !== '' ? String(v).trim() : null;
}

/**
 * Update quota fields from a successful (or non-throwing) HTTP response.
 * @param {'tmdb'|'trakt'|'omdb'} api
 * @param {Response} response
 */
export function recordRateQuotaFromResponse(api, response) {
  if (!response?.headers) return;
  const h = response.headers;
  const limit = headerValue(h, 'x-ratelimit-limit');
  const remaining = headerValue(h, 'x-ratelimit-remaining');
  const resetRaw = headerValue(h, 'x-ratelimit-reset');
  let resetEpochSec = null;
  if (resetRaw != null) {
    const n = Number(resetRaw);
    if (Number.isFinite(n)) resetEpochSec = n > 1e12 ? Math.floor(n / 1000) : n;
  }

  const prev = snapshot[api];
  const next = {
    ...prev,
    lastUpdated: Date.now(),
    rateLimitedAt: null,
    retryAfterSec: null,
  };
  if (limit != null) next.limit = limit;
  if (remaining != null) next.remaining = remaining;
  if (resetEpochSec != null) next.resetEpochSec = resetEpochSec;

  snapshot = { ...snapshot, [api]: next };
  notify();
}

/**
 * @param {'tmdb'|'trakt'|'omdb'} api
 * @param {Response} response
 */
export function recordRateQuota429(api, response) {
  if (!response?.headers) return;
  const h = response.headers;
  const retryRaw = headerValue(h, 'retry-after');
  let retryAfterSec = null;
  if (retryRaw != null) {
    const n = Number(retryRaw);
    if (Number.isFinite(n)) retryAfterSec = n;
  }

  const prev = snapshot[api];
  const next = {
    ...prev,
    lastUpdated: Date.now(),
    rateLimitedAt: Date.now(),
    retryAfterSec,
  };

  const limit = headerValue(h, 'x-ratelimit-limit');
  const remaining = headerValue(h, 'x-ratelimit-remaining');
  if (limit != null) next.limit = limit;
  if (remaining != null) next.remaining = remaining;

  snapshot = { ...snapshot, [api]: next };
  notify();
}

/** Count one OMDb network call (uncached) for session visibility. */
export function bumpOmdbSessionRequestCount() {
  const prev = snapshot.omdb;
  snapshot = {
    ...snapshot,
    omdb: { ...prev, sessionRequests: (prev.sessionRequests || 0) + 1, lastUpdated: Date.now() },
  };
  notify();
}

export function formatQuotaLine(state) {
  if (state?.remaining != null && state?.limit != null) {
    return `${state.remaining} / ${state.limit} requests (provider window)`;
  }
  if (state?.remaining != null) return `${state.remaining} remaining`;
  if (state?.limit != null) return `Limit ${state.limit} (remaining not reported)`;
  return null;
}

export function formatResetHint(resetEpochSec) {
  if (resetEpochSec == null || !Number.isFinite(resetEpochSec)) return null;
  const targetMs = resetEpochSec * 1000;
  const deltaSec = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
  if (deltaSec <= 0) return 'Window resets momentarily';
  if (deltaSec < 120) return `Window resets in about ${deltaSec}s`;
  const m = Math.ceil(deltaSec / 60);
  return `Window resets in about ${m} min`;
}
