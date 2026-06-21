import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import {
  buildHomeSpotlight,
  buildBundledSpotlightSeed,
  mediaFilterToScope,
  HOME_SPOTLIGHT_SCOPES,
} from '../lib/homeFeed';
import { loadHomeSpotlightCache, saveHomeSpotlightCache } from '../lib/storage';

function createBundledCache() {
  return {
    all: buildBundledSpotlightSeed('all'),
    movie: buildBundledSpotlightSeed('movie'),
    tv: buildBundledSpotlightSeed('tv'),
  };
}

function mergeCacheWithSeeds(stored) {
  const bundled = createBundledCache();
  return {
    all: stored.all?.length ? stored.all : bundled.all,
    movie: stored.movie?.length ? stored.movie : bundled.movie,
    tv: stored.tv?.length ? stored.tv : bundled.tv,
  };
}

/**
 * Owns home spotlight pools per scope (all / movie / tv), persisted cache,
 * stale-while-revalidate refresh, and foreground reshuffle.
 *
 * @param {import('../lib/types.js').WatchlistItem[]} watchlist
 * @param {null | 'movie' | 'tv'} homeMediaFilter
 */
export function useHomeSpotlight(watchlist, homeMediaFilter) {
  const bundledSeedRef = useRef(createBundledCache());
  const [displayByScope, setDisplayByScope] = useState(() => bundledSeedRef.current);
  const cacheRef = useRef(bundledSeedRef.current);
  const refreshGenRef = useRef(0);
  const hydratedRef = useRef(false);
  const watchlistRef = useRef(watchlist);

  const scope = mediaFilterToScope(homeMediaFilter);

  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  const applyScopeUpdate = useCallback((targetScope, items) => {
    if (!items?.length) return;
    cacheRef.current = { ...cacheRef.current, [targetScope]: items };
    setDisplayByScope((prev) => ({ ...prev, [targetScope]: items }));
    saveHomeSpotlightCache(cacheRef.current).catch(() => {});
  }, []);

  const refreshScope = useCallback(async (targetScope, generation) => {
    try {
      const items = await buildHomeSpotlight(watchlistRef.current, targetScope);
      if (generation !== refreshGenRef.current) return;
      if (items.length > 0) {
        applyScopeUpdate(targetScope, items);
      }
    } catch {
      // Keep displaying the previous hero silently.
    }
  }, [applyScopeUpdate]);

  const refreshAllScopes = useCallback(
    (generation = refreshGenRef.current) => {
      return Promise.all(
        HOME_SPOTLIGHT_SCOPES.map((targetScope) => refreshScope(targetScope, generation)),
      );
    },
    [refreshScope],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadHomeSpotlightCache();
      if (cancelled) return;

      const merged = mergeCacheWithSeeds(stored);
      cacheRef.current = merged;
      setDisplayByScope(merged);
      hydratedRef.current = true;

      const generation = ++refreshGenRef.current;
      await refreshAllScopes(generation);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshAllScopes]);

  useEffect(() => {
    if (!hydratedRef.current) return undefined;
    const generation = ++refreshGenRef.current;
    refreshScope(scope, generation);
    return undefined;
  }, [scope, refreshScope]);

  useEffect(() => {
    if (!hydratedRef.current) return undefined;
    const generation = ++refreshGenRef.current;
    refreshAllScopes(generation);
    return undefined;
  }, [watchlist, refreshAllScopes]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !hydratedRef.current) return;
      const generation = ++refreshGenRef.current;
      refreshAllScopes(generation);
    });
    return () => subscription.remove();
  }, [refreshAllScopes]);

  const homeSpotlightItems = useMemo(() => {
    const displayed = displayByScope[scope];
    if (displayed?.length) return displayed;
    const cached = cacheRef.current[scope];
    if (cached?.length) return cached;
    return bundledSeedRef.current[scope] || buildBundledSpotlightSeed(scope);
  }, [displayByScope, scope]);

  return {
    homeSpotlightItems,
    homeSpotlightCache: displayByScope,
  };
}
