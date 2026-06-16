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

test('streaming availability includes Canada-only CBC Gem provider support', () => {
  const tmdb = read('src/lib/tmdb.js');
  const shareUtils = read('src/lib/shareUtils.js');
  const resultView = read('src/components/ResultView.js');

  assert.match(tmdb, /cbc_gem:\s*'CBC Gem'/);
  assert.match(tmdb, /cbc_gem:\s*new Set\(\['cbc gem'\]\)/);
  assert.match(tmdb, /cbc_gem:\s*new Set\(\['CA'\]\)/);
  assert.match(tmdb, /STREAMING_PROVIDER_BUCKETS\s*=\s*\['flatrate', 'free', 'ads'\]/);
  assert.match(tmdb, /isServiceAvailableInRegion\(key, countryCode\)/);
  assert.match(shareUtils, /cbc_gem:\s*'#E31B23'/);
  assert.match(resultView, /CBC Gem/);
});

test('streaming availability includes UK-only BBC iPlayer provider support', () => {
  const tmdb = read('src/lib/tmdb.js');
  const shareUtils = read('src/lib/shareUtils.js');
  const resultView = read('src/components/ResultView.js');
  const readme = read('README.md');

  assert.match(tmdb, /bbc_iplayer:\s*'BBC iPlayer'/);
  assert.match(tmdb, /bbc_iplayer:\s*new Set\(\['bbc iplayer'\]\)/);
  assert.match(tmdb, /bbc_iplayer:\s*new Set\(\['GB'\]\)/);
  assert.match(tmdb, /STREAMING_PROVIDER_BUCKETS\s*=\s*\['flatrate', 'free', 'ads'\]/);
  assert.match(tmdb, /isServiceAvailableInRegion\(key, countryCode\)/);
  assert.match(shareUtils, /bbc_iplayer:\s*'#[0-9A-Fa-f]{6}'/);
  assert.match(shareUtils, /bbc_iplayer:\s*'tv-outline'/);
  assert.match(resultView, /BBC iPlayer/);
  assert.match(readme, /UK-only \*\*BBC iPlayer\*\*/);
});

test('streaming availability includes UK-only Channel 4 and ITVX provider support', () => {
  const tmdb = read('src/lib/tmdb.js');
  const shareUtils = read('src/lib/shareUtils.js');
  const resultView = read('src/components/ResultView.js');
  const readme = read('README.md');

  assert.match(tmdb, /channel_4:\s*'Channel 4'/);
  assert.match(tmdb, /itvx:\s*'ITVX'/);
  assert.match(tmdb, /channel_4:\s*new Set\(\['channel 4'\]\)/);
  assert.match(tmdb, /itvx:\s*new Set\(\['itvx'\]\)/);
  assert.match(tmdb, /channel_4:\s*new Set\(\['GB'\]\)/);
  assert.match(tmdb, /itvx:\s*new Set\(\['GB'\]\)/);
  assert.match(tmdb, /STREAMING_PROVIDER_BUCKETS\s*=\s*\['flatrate', 'free', 'ads'\]/);
  assert.match(tmdb, /isServiceAvailableInRegion\(key, countryCode\)/);
  assert.match(shareUtils, /channel_4:\s*'#[0-9A-Fa-f]{6}'/);
  assert.match(shareUtils, /itvx:\s*'#[0-9A-Fa-f]{6}'/);
  assert.match(shareUtils, /channel_4:\s*'tv-outline'/);
  assert.match(shareUtils, /itvx:\s*'tv-outline'/);
  assert.match(resultView, /Channel 4/);
  assert.match(resultView, /ITVX/);
  assert.match(readme, /UK-only \*\*BBC iPlayer\*\*, \*\*Channel 4\*\*, and \*\*ITVX\*\*/);
});

test('streaming availability includes Australia-only SBS On Demand and ABC iview support', () => {
  const tmdb = read('src/lib/tmdb.js');
  const shareUtils = read('src/lib/shareUtils.js');
  const resultView = read('src/components/ResultView.js');
  const readme = read('README.md');

  assert.match(tmdb, /sbs_on_demand:\s*'SBS On Demand'/);
  assert.match(tmdb, /abc_iview:\s*'ABC iview'/);
  assert.match(tmdb, /sbs_on_demand:\s*new Set\(\['sbs on demand'\]\)/);
  assert.match(tmdb, /abc_iview:\s*new Set\(\['abc iview'\]\)/);
  assert.match(tmdb, /sbs_on_demand:\s*new Set\(\['AU'\]\)/);
  assert.match(tmdb, /abc_iview:\s*new Set\(\['AU'\]\)/);
  assert.match(tmdb, /STREAMING_PROVIDER_BUCKETS\s*=\s*\['flatrate', 'free', 'ads'\]/);
  assert.match(tmdb, /isServiceAvailableInRegion\(key, countryCode\)/);
  assert.match(shareUtils, /sbs_on_demand:\s*'#[0-9A-Fa-f]{6}'/);
  assert.match(shareUtils, /abc_iview:\s*'#[0-9A-Fa-f]{6}'/);
  assert.match(shareUtils, /sbs_on_demand:\s*'tv-outline'/);
  assert.match(shareUtils, /abc_iview:\s*'tv-outline'/);
  assert.match(resultView, /SBS On Demand/);
  assert.match(resultView, /ABC iview/);
  assert.match(readme, /Australia-only \*\*SBS On Demand\*\* and \*\*ABC iview\*\*/);
});

test('regional watch providers are collected from free and ad-supported TMDB buckets', () => {
  const tmdb = read('src/lib/tmdb.js');

  assert.match(tmdb, /const STREAMING_PROVIDER_BUCKETS = \['flatrate', 'free', 'ads'\];/);
  assert.match(tmdb, /STREAMING_PROVIDER_BUCKETS\.forEach\(\(bucket\) => \{/);
  assert.match(tmdb, /\(info\[bucket\] \|\| \[\]\)\.forEach\(\(provider\) => \{/);
  assert.doesNotMatch(tmdb, /\(info\.flatrate \|\| \[\]\)\.forEach/);
});

test('core interactive surfaces expose accessibility roles and labels', () => {
  const files = [
    'src/components/AppHeader.js',
    'src/components/BottomNav.js',
    'src/components/DiscoverScreen.js',
    'src/components/CollectionsScreen.js',
    'src/components/HomeScreen.js',
    'src/components/HomeTopNav.js',
    'src/components/MatchResults.js',
    'src/components/ResultView.js',
    'src/components/SettingsView.js',
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
  const home = read('src/components/HomeScreen.js');

  assert.match(discover, /chip:\s*\{[^}]*minHeight:\s*48/);
  assert.match(header, /width: 48,\s*\n\s*height: 48/);
  assert.match(watchlist, /randomOpenButton:[\s\S]*width:\s*scale\(48\)/);
  assert.match(home, /spotlightChip:\s*\{[^}]*minHeight:\s*48/);
});

test('discover enrichment runs after TMDb results are shown', () => {
  const viewModel = read('src/lib/discoverViewModel.js');
  const tmdb = read('src/lib/tmdb.js');
  const discover = read('src/components/DiscoverScreen.js');

  assert.match(tmdb, /export async function enrichDiscoverResults/);
  assert.match(tmdb, /\/tv\/\$\{tmdbId\}\/external_ids/);
  assert.match(
    viewModel,
    /setResults\(data\.results\);[\s\S]*enrichVisibleResults\(data\.results, token\)/,
  );
  assert.match(discover, /IMDb \{imdbRating\}/);
  assert.match(discover, /RT \{rottenTomatoes\}/);
  assert.match(discover, /\{contentRating\}/);
});

test('live search suggestions include people with profile artwork', () => {
  const searchController = read('src/hooks/useSearchController.js');
  const searchPanel = read('src/components/SearchPanel.js');
  const tmdb = read('src/lib/tmdb.js');

  assert.match(searchController, /searchLiveCandidates/);
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
  assert.match(
    searchPanel,
    /accessibilityLabel=\{voiceListening \? 'Stop voice search' : 'Start voice search'\}/,
  );
  assert.match(voiceHook, /expo-speech-recognition/);
  assert.match(voiceHook, /requestPermissionsAsync/);
  assert.match(voiceHook, /iosTaskHint:\s*'search'/);
  assert.ok(JSON.stringify(appConfig.expo.plugins).includes('expo-speech-recognition'));
});

test('search view includes surprise roulette and visual recently viewed history', () => {
  const surpriseController = read('src/hooks/useSurpriseController.js');
  const searchStack = read('src/navigation/SearchStack.js');
  const appShell = read('src/navigation/AppShell.js');
  const searchPanel = read('src/components/SearchPanel.js');
  const storage = read('src/lib/storage.js');
  const tmdb = read('src/lib/tmdb.js');

  assert.match(surpriseController, /fetchSurpriseRecommendation/);
  assert.match(searchStack, /recentViewed=\{recentViewed\}/);
  assert.match(appShell, /Surprise Roulette/);
  assert.match(searchStack, /LinearGradient/);
  assert.match(searchPanel, /Recently Viewed/);
  assert.match(searchPanel, /styles\.posterImg/);
  assert.match(searchPanel, /Trending on Trakt/);
  assert.match(searchPanel, /Now playing in theaters/);
  assert.match(storage, /loadRecentViewed/);
  assert.match(storage, /saveRecentViewed/);
  assert.match(tmdb, /\/recommendations/);
  assert.match(tmdb, /ratingValue >= 7/);
});

test('movie franchise detection is backed by TMDB collection parts', () => {
  const tmdb = read('src/lib/tmdb.js');
  const resultView = read('src/components/ResultView.js');

  assert.match(tmdb, /data\.belongs_to_collection/);
  assert.match(tmdb, /getMovieCollectionInfo\(data\.belongs_to_collection,\s*tmdbId\)/);
  assert.match(tmdb, /tmdbGet\(`\/collection\/\$\{belongsToCollection\.id\}`/);
  assert.match(tmdb, /relatedParts\.length === 0/);
  assert.match(tmdb, /collectionLookupFailed:\s*true/);
  assert.match(resultView, /result\.isFranchise/);
  assert.match(resultView, /result\.collection\?\.parts/);
  assert.match(resultView, /Franchise/);
});

test('home collections tab uses TMDB collection rows', () => {
  const appNavigation = read('src/hooks/useAppNavigation.js');
  const home = read('src/components/HomeScreen.js');
  const collections = read('src/components/CollectionsScreen.js');
  const homeTopNav = read('src/components/HomeTopNav.js');
  const homeFeed = read('src/lib/homeFeed.js');
  const tmdb = read('src/lib/tmdb.js');

  assert.match(appNavigation, /openCollections/);
  assert.match(appNavigation, /navigateToTabRoot\('home'\)/);
  assert.match(appNavigation, /setHomeMediaFilter\(null\)/);
  assert.match(home, /onOpenCollections/);
  assert.match(collections, /fetchStaticCollectionRows/);
  assert.match(collections, /FranchiseRailsView/);
  assert.match(homeTopNav, /label:\s*'Collections'/);
  assert.match(homeFeed, /fetchTopMovieCollectionRows\(20\)/);
  assert.match(tmdb, /export async function fetchTopMovieCollectionRows/);
  assert.match(tmdb, /detail\.belongs_to_collection/);
  assert.match(tmdb, /getMovieCollectionInfo\(detail\.belongs_to_collection/);
});

test('language and country presets map to effective API filters', () => {
  const viewModel = read('src/lib/discoverViewModel.js');
  const languagePresets = read('src/lib/languagePresets.js');
  const countryPresets = read('src/lib/countryPresets.js');

  assert.match(
    viewModel,
    /if \(f\.activeCountryPreset\) return codesForCountryPreset\(f\.activeCountryPreset\)/,
  );
  assert.match(languagePresets, /latin_america:\s*'latin_america'/);
  assert.match(languagePresets, /'zu', 'xh'/);
  assert.match(countryPresets, /id:\s*'latin_america'/);
  assert.match(countryPresets, /label:\s*'Middle East 🕌'/);
});

test('collections are sorted by the rating of the first movie descending', () => {
  const source = read('src/lib/collectionMovieRows.js');
  assert.match(
    source,
    /\.sort\(\(a,\s*b\)\s*=>\s*b\.firstMovieRatingValue\s*-\s*a\.firstMovieRatingValue\)/,
  );
});
