import React, { createContext, useContext } from 'react';

/**
 * Phase 3 of the refactor: the single monolithic `AppStateContext` is split into
 * one context per domain so a state change in one domain (e.g. a watchlist edit)
 * no longer re-renders consumers of unrelated domains (search, discover, ...).
 *
 * All the domain hooks still run together in `MobileApp` because they depend on
 * each other, but each domain's value is memoized and published through its own
 * provider below, so React can skip consumers whose domain value is unchanged.
 *
 * @param {string} name human-readable provider name, used in the guard error.
 * @returns {[React.FC<{ value: any, children: React.ReactNode }>, () => any]}
 */
function createDomainContext(name) {
  const Context = createContext(null);

  function Provider({ value, children }) {
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useDomain() {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error(`${name} consumer must be used within <${name}>`);
    }
    return ctx;
  }

  return [Provider, useDomain];
}

export const [SearchProvider, useSearch] = createDomainContext('SearchProvider');
export const [DiscoverProvider, useDiscover] = createDomainContext('DiscoverProvider');
export const [DetailProvider, useDetail] = createDomainContext('DetailProvider');
export const [WatchlistProvider, useWatchlist] = createDomainContext('WatchlistProvider');
export const [PeopleProvider, usePeople] = createDomainContext('PeopleProvider');
export const [SurpriseProvider, useSurprise] = createDomainContext('SurpriseProvider');
export const [NavProvider, useNav] = createDomainContext('NavProvider');
export const [StatusProvider, useStatus] = createDomainContext('StatusProvider');
