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
