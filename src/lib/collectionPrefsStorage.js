import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  searchQuery: 'find-streamer/collections/search-query',
  pinnedIds: 'find-streamer/collections/pinned-ids',
  sectionCollapsed: 'find-streamer/collections/section-collapsed',
};

const DEFAULT_SECTION_COLLAPSED = {
  library: true,
  pinned: true,
};

export async function loadCollectionSearchQuery() {
  const value = await AsyncStorage.getItem(KEYS.searchQuery);
  return typeof value === 'string' ? value : '';
}

export async function saveCollectionSearchQuery(query) {
  await AsyncStorage.setItem(KEYS.searchQuery, query || '');
}

export async function loadPinnedCollectionIds() {
  const raw = await AsyncStorage.getItem(KEYS.pinnedIds);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePinnedCollectionIds(ids) {
  await AsyncStorage.setItem(KEYS.pinnedIds, JSON.stringify(ids));
}

export async function loadCollectionSectionCollapsed() {
  const raw = await AsyncStorage.getItem(KEYS.sectionCollapsed);
  if (!raw) return { ...DEFAULT_SECTION_COLLAPSED };
  try {
    const parsed = JSON.parse(raw);
    return {
      library: parsed.library !== false,
      pinned: parsed.pinned !== false,
    };
  } catch {
    return { ...DEFAULT_SECTION_COLLAPSED };
  }
}

export async function saveCollectionSectionCollapsed(state) {
  await AsyncStorage.setItem(KEYS.sectionCollapsed, JSON.stringify({
    library: state.library !== false,
    pinned: state.pinned !== false,
  }));
}
