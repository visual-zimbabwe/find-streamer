import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists the last-N language / country codes the user picked in the Discover
// value pickers, so a returning user sees what they chose last time instead of a
// cold alphabetical scroll. Recents are picker history — independent of the
// current selection; clearing the filter does not clear recents. The newest-
// first, deduped, capped shaping lives in discoverPickerSections.pushRecent; this
// module only reads/writes the array. Mirrors collectionPrefsStorage.

const KEYS = {
  languages: 'find-streamer/discover/recent-languages',
  countries: 'find-streamer/discover/recent-countries',
};

async function loadCodes(key) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

function saveCodes(key, codes) {
  const clean = Array.isArray(codes) ? codes.filter((c) => typeof c === 'string') : [];
  return AsyncStorage.setItem(key, JSON.stringify(clean));
}

export function loadRecentLanguageCodes() {
  return loadCodes(KEYS.languages);
}

export function saveRecentLanguageCodes(codes) {
  return saveCodes(KEYS.languages, codes);
}

export function loadRecentCountryCodes() {
  return loadCodes(KEYS.countries);
}

export function saveRecentCountryCodes(codes) {
  return saveCodes(KEYS.countries, codes);
}
