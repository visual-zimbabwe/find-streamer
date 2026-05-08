const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Android release config does not allow cleartext traffic', () => {
  const appConfig = JSON.parse(read('app.json'));
  assert.equal(appConfig.expo.android.usesCleartextTraffic, false);
});

test('TV provider lookup defaults to show-level availability instead of per-episode fan-out', () => {
  const source = read('src/lib/tmdb.js');
  assert.match(source, /EXPO_PUBLIC_TMDB_TV_EPISODE_LOOKUP === 'true'/);
  assert.match(source, /confidence = 'show'/);
});

test('core interactive surfaces expose accessibility roles and labels', () => {
  const files = [
    'src/components/AppHeader.js',
    'src/components/BottomNav.js',
    'src/components/DiscoverScreen.js',
    'src/components/MatchResults.js',
    'src/components/ResultView.js',
    'src/components/WatchlistView.js',
  ];

  files.forEach((file) => {
    const source = read(file);
    assert.match(source, /accessibilityRole=/, `${file} should expose accessibility roles`);
    assert.match(source, /accessibilityLabel=/, `${file} should expose accessibility labels`);
  });
});

test('small icon controls were raised to Android-friendly target sizes', () => {
  const discover = read('src/components/DiscoverScreen.js');
  const header = read('src/components/AppHeader.js');
  const watchlist = read('src/components/WatchlistView.js');

  assert.match(discover, /ratingDot:\s*\{ width: 48, height: 48/);
  assert.match(header, /width: 48,\s*\n\s*height: 48/);
  assert.match(watchlist, /removeButton:[\s\S]*width: 48,[\s\S]*height: 48/);
});

test('discover enrichment runs after TMDb results are shown', () => {
  const viewModel = read('src/lib/discoverViewModel.js');
  const tmdb = read('src/lib/tmdb.js');
  const discover = read('src/components/DiscoverScreen.js');

  assert.match(tmdb, /export async function enrichDiscoverResults/);
  assert.match(tmdb, /\/tv\/\$\{tmdbId\}\/external_ids/);
  assert.match(viewModel, /setResults\(data\.results\);[\s\S]*enrichVisibleResults\(data\.results, token\)/);
  assert.match(discover, /IMDb \{imdbRating\}/);
  assert.match(discover, /RT \{rottenTomatoes\}/);
  assert.match(discover, /\{contentRating\}/);
});

test('live search suggestions include people with profile artwork', () => {
  const app = read('App.js');
  const searchPanel = read('src/components/SearchPanel.js');
  const tmdb = read('src/lib/tmdb.js');

  assert.match(app, /searchLiveCandidates/);
  assert.match(tmdb, /export async function searchLiveCandidates/);
  assert.match(tmdb, /resultType:\s*'person'/);
  assert.match(tmdb, /profileUrl/);
  assert.match(searchPanel, /item\.resultType === 'person'/);
  assert.match(searchPanel, /styles\.liveAvatar/);
  assert.match(searchPanel, /View filmography for/);
});

test('search bar exposes voice search controls and native speech config', () => {
  const app = read('App.js');
  const appConfig = JSON.parse(read('app.json'));
  const searchPanel = read('src/components/SearchPanel.js');
  const voiceHook = read('src/lib/useVoiceSearch.js');

  assert.match(app, /useVoiceSearch/);
  assert.match(searchPanel, /mic-outline/);
  assert.match(searchPanel, /accessibilityLabel=\{voiceListening \? 'Stop voice search' : 'Start voice search'\}/);
  assert.match(voiceHook, /expo-speech-recognition/);
  assert.match(voiceHook, /requestPermissionsAsync/);
  assert.match(voiceHook, /iosTaskHint:\s*'search'/);
  assert.ok(JSON.stringify(appConfig.expo.plugins).includes('expo-speech-recognition'));
});

test('search view includes surprise roulette and visual recently viewed history', () => {
  const app = read('App.js');
  const searchPanel = read('src/components/SearchPanel.js');
  const storage = read('src/lib/storage.js');
  const tmdb = read('src/lib/tmdb.js');

  assert.match(app, /fetchSurpriseRecommendation/);
  assert.match(app, /recentViewed=\{recentViewed\}/);
  assert.match(searchPanel, /SURPRISE ROULETTE/);
  assert.match(searchPanel, /LinearGradient/);
  assert.match(searchPanel, /RECENTLY VIEWED/);
  assert.match(searchPanel, /styles\.recentPoster/);
  assert.match(storage, /loadRecentViewed/);
  assert.match(storage, /saveRecentViewed/);
  assert.match(tmdb, /\/recommendations/);
  assert.match(tmdb, /ratingValue >= 7/);
});

test('language and country presets map to effective API filters', () => {
  const viewModel = read('src/lib/discoverViewModel.js');
  const languagePresets = read('src/lib/languagePresets.js');
  const countryPresets = read('src/lib/countryPresets.js');

  assert.match(viewModel, /if \(f\.activeCountryPreset\) return codesForCountryPreset\(f\.activeCountryPreset\)/);
  assert.match(languagePresets, /latin_america:\s*'latin_america'/);
  assert.match(languagePresets, /'zu', 'xh'/);
  assert.match(countryPresets, /id:\s*'latin_america'/);
  assert.match(countryPresets, /label:\s*'Middle East 🕌'/);
});
