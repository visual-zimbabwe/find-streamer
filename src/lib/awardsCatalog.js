import awardsData from '../data/awards_catalog.js';
import { watchlistEntryKey } from './watchlistModel.js';

let cachedCeremonies = null;
let cachedWinnersMap = null;
let cachedCeremonyRows = null;

function ensureLookup() {
  if (!cachedWinnersMap) {
    const map = new Map();
    const allWinners = awardsData?.allWinners || [];
    allWinners.forEach((item) => {
      if (item.id != null) {
        map.set(String(item.id), item);
      }
      if (item.tmdbId != null) {
        map.set(String(item.tmdbId), item);
      }
    });
    cachedWinnersMap = map;
  }
  return cachedWinnersMap;
}

/**
 * Returns all available award ceremonies and festivals with their metadata.
 */
export function getAwardsCeremonies() {
  if (!cachedCeremonies) {
    cachedCeremonies = awardsData?.ceremonies || [];
  }
  return cachedCeremonies;
}

/**
 * Returns ceremony details and full winner list by ceremony ID.
 */
export function getCeremonyById(ceremonyId) {
  if (!ceremonyId) return null;
  const ceremonies = getAwardsCeremonies();
  return ceremonies.find((c) => c.id === ceremonyId) || null;
}

/**
 * Returns winning films for a specific ceremony, optionally limited.
 */
export function getWinnersForCeremony(ceremonyId, limit = Infinity) {
  const ceremony = getCeremonyById(ceremonyId);
  if (!ceremony || !Array.isArray(ceremony.winners)) return [];
  return Number.isFinite(limit) && limit > 0
    ? ceremony.winners.slice(0, limit)
    : ceremony.winners;
}

/**
 * Returns all unique award-winning films across all ceremonies.
 */
export function getAllAwardWinners() {
  return awardsData?.allWinners || [];
}

/**
 * Returns an award winner item by TMDb ID.
 */
export function getAwardWinnerItem(tmdbId) {
  if (tmdbId == null) return null;
  return ensureLookup().get(String(tmdbId)) || null;
}

/**
 * Returns all awards and festival laurels won by a specific movie.
 */
export function getAwardsForMovie(tmdbId) {
  const item = getAwardWinnerItem(tmdbId);
  return item?.awards || [];
}

/**
 * Returns pre-structured rails ready for ContentRail / FranchiseRailsView,
 * matching Trova's standard `{ category: { id, label, icon, ... }, items: [...] }` shape.
 */
export function getAwardCeremonyRows() {
  if (!cachedCeremonyRows) {
    const ceremonies = getAwardsCeremonies();
    cachedCeremonyRows = ceremonies
      .filter((c) => Array.isArray(c.winners) && c.winners.length > 0)
      .map((ceremony) => ({
        category: {
          id: `award_${ceremony.id}`,
          ceremonyId: ceremony.id,
          label: ceremony.shortName ? `${ceremony.shortName} Laureates` : ceremony.name,
          fullName: ceremony.name,
          awardName: ceremony.awardName,
          icon: ceremony.icon || 'ribbon-outline',
          badgeColor: ceremony.badgeColor || '#E5A93C',
          country: ceremony.country,
          city: ceremony.city,
          founded: ceremony.founded,
          description: ceremony.description,
          isAwardCeremony: true,
        },
        items: ceremony.winners,
      }));
  }
  return cachedCeremonyRows;
}

/**
 * Returns top universally acclaimed laureates (multi-award winners).
 */
export function getPrestigeTopWinners(limit = 40) {
  const all = getAllAwardWinners();
  return Number.isFinite(limit) && limit > 0 ? all.slice(0, limit) : all;
}
