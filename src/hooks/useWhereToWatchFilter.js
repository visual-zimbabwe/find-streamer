// @ts-check
//
// The where-to-watch availability engine, lifted out of WatchlistView so more
// than one screen can drive it. It owns the expensive, stateful half —
// loading/priming the availability cache, the bulk provider-country scan, the
// immutable snapshot it publishes, and the derived match set — while the caller
// owns the cheap facet state (country / service / collection scope) and decides
// when the filter is "active".
//
// Why the split: availability data covers every country and service at once, so
// country/service are NOT inputs to the fetch — changing them only re-runs the
// cheap match memo. Only `active`, the item set and the collection scope trigger
// a (cache-first) scan. Keeping that contract is what makes flipping between
// "Canada / Prime" and "UK / Netflix" instant after the first prime.

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchTitleProviderCountries } from '../lib/tmdb';
import { watchlistEntryKey } from '../lib/watchlistModel';
import {
  ensureAvailabilityForItems,
  getFreshAvailability,
  loadAvailabilityCache,
  matchingServiceKeys,
  persistAvailabilityCache,
  titleMatchesWhereToWatch,
  whereToWatchScopeItems,
} from '../lib/whereToWatch';

/**
 * @param {{
 *   items: import('../lib/types.js').WatchlistItem[],
 *   active: boolean,
 *   country: { code?: string, label?: string } | null,
 *   serviceKey: string | null,
 *   collectionIds?: string[] | null,
 *   retryNonce?: number,
 * }} params
 * @returns {{
 *   availability: Map<string, object> | null,
 *   checking: boolean,
 *   progress: { checked: number, total: number } | null,
 *   failedCount: number,
 *   matches: { keys: Set<string>, services: Map<string, string[]> } | null,
 *   scopeCount: number,
 * }}
 */
export function useWhereToWatchFilter({
  items,
  active,
  country,
  serviceKey,
  collectionIds = null,
  retryNonce = 0,
}) {
  const [availability, setAvailability] = useState(/** @type {Map<string, object> | null} */ (null));
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(/** @type {{checked:number,total:number}|null} */ (null));
  const [failedCount, setFailedCount] = useState(0);

  // The persistent cache is mutated by the concurrent fetch loop; renders read
  // `availability`, an immutable snapshot the effect republishes.
  const cacheRef = useRef(/** @type {any} */ (null));
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    runIdRef.current += 1;
    const runId = runIdRef.current;

    (async () => {
      if (!cacheRef.current) {
        cacheRef.current = await loadAvailabilityCache();
        if (!alive || runId !== runIdRef.current) return;
      }
      const cache = cacheRef.current;
      const scope = whereToWatchScopeItems(items || [], collectionIds);

      const publishSnapshot = () => {
        const snapshot = new Map();
        scope.forEach((item) => {
          const entryKey = watchlistEntryKey(item);
          const services = getFreshAvailability(cache, entryKey);
          if (services) snapshot.set(entryKey, services);
        });
        setAvailability(snapshot);
      };

      setChecking(true);
      setFailedCount(0);
      setProgress({ checked: 0, total: scope.length });
      publishSnapshot(); // cached titles match instantly

      // Rebuilding the consumer grid/rails costs ~100 ms on a large library, so
      // the snapshot refreshes at most ~once a second mid-run; the cheap
      // progress text updates more often.
      let lastProgressAt = 0;
      let lastRebuildAt = Date.now();
      const result = await ensureAvailabilityForItems(scope, {
        cache,
        fetchAvailability: fetchTitleProviderCountries,
        shouldContinue: () => alive && runId === runIdRef.current,
        onProgress: (p) => {
          if (!alive || runId !== runIdRef.current) return;
          const nowTs = Date.now();
          if (nowTs - lastProgressAt > 120 || p.checked === p.total) {
            lastProgressAt = nowTs;
            setProgress(p);
          }
          if (nowTs - lastRebuildAt > 1000) {
            lastRebuildAt = nowTs;
            publishSnapshot();
          }
        },
      });

      if (!alive || runId !== runIdRef.current) return;
      setChecking(false);
      setFailedCount(result.failed);
      publishSnapshot();
      persistAvailabilityCache(cache);
    })();

    return () => {
      alive = false;
    };
  }, [active, items, collectionIds, retryNonce]);

  const matches = useMemo(() => {
    if (!active) return null;
    const countryCode = country?.code || null;
    // Both facets at "All" = no narrowing = show everything.
    if (!countryCode && !serviceKey) return null;
    const filter = { countryCode, serviceKey: serviceKey || null };
    const keys = new Set();
    const services = new Map();
    if (availability) {
      availability.forEach((svc, entryKey) => {
        if (titleMatchesWhereToWatch(svc, filter)) {
          keys.add(entryKey);
          // Which services matched — only meaningful with a concrete country and
          // no service filter (the "any service in Canada" poster badge).
          if (countryCode && !serviceKey) {
            services.set(entryKey, matchingServiceKeys(svc, countryCode));
          }
        }
      });
    }
    return { keys, services };
  }, [active, country, serviceKey, availability]);

  const scopeCount = useMemo(
    () => (active ? whereToWatchScopeItems(items || [], collectionIds).length : 0),
    [active, items, collectionIds],
  );

  return { availability, checking, progress, failedCount, matches, scopeCount };
}
