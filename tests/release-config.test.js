import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Genuine configuration and accessibility guards. Behavioral concerns that were
// previously asserted here via brittle source-string greps now live in dedicated
// behavioral suites:
//   - provider region-locking / bucket collection → tests/provider-availability.test.js
//   - language/country preset expansion           → tests/discover-presets.test.js
//   - collection row grouping / sort order        → tests/collection-rows.test.js

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Android release config does not allow cleartext traffic', () => {
  const appConfig = JSON.parse(read('app.json'));
  assert.equal(appConfig.expo.android.usesCleartextTraffic, false);
});

// Voice search was removed; the app has no reason to ask for the microphone.
// This guards against a dependency quietly reintroducing the permission, which
// is the kind of thing users notice on the Play listing and nobody notices in a
// diff.
test('the app requests no microphone or speech-recognition access', () => {
  const appConfig = JSON.parse(read('app.json'));
  assert.ok(
    !appConfig.expo.android.permissions.includes('android.permission.RECORD_AUDIO'),
    'RECORD_AUDIO must not be requested',
  );
  assert.ok(
    !JSON.stringify(appConfig.expo.plugins).includes('speech-recognition'),
    'no speech-recognition config plugin should be registered',
  );

  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.ok(!manifest.includes('RECORD_AUDIO'), 'AndroidManifest must not declare RECORD_AUDIO');
  assert.ok(
    !manifest.includes('android.speech.RecognitionService'),
    'AndroidManifest must not query for a speech recognition service',
  );
});

// Cost/safety gate: the per-episode provider fan-out is an expensive call that
// must stay disabled unless explicitly opted in via the env flag, defaulting to
// show-level availability. This guards the default, not source formatting.
test('per-episode TV provider lookup stays gated behind an env flag, defaulting to show-level', () => {
  const source = read('src/lib/tmdb.js');
  assert.match(source, /EXPO_PUBLIC_TMDB_TV_EPISODE_LOOKUP === 'true'/);
  assert.match(source, /if \(!TV_EPISODE_PROVIDER_LOOKUP_ENABLED\)/);
  assert.match(source, /confidence = 'show'/);
});

test('core interactive surfaces expose accessibility roles and labels', () => {
  const files = [
    'src/components/AppHeader.js',
    'src/components/BottomNav.js',
    'src/components/DiscoverScreen.js',
    'src/components/CollectionsScreen.js',
    'src/components/HomeScreen.js',
    'src/components/HomeTopNav.js',
    // MatchResults used to own its controls inline; the search results are now
    // built from these two shared components, so the guard follows the controls
    // rather than the screen that arranges them.
    'src/components/GridPosterCard.js',
    'src/components/SearchResultRow.js',
    'src/components/ResultView.js',
    'src/components/SettingsView.js',
  ];

  files.forEach((file) => {
    const source = read(file);
    assert.match(source, /accessibilityRole=/, `${file} should expose accessibility roles`);
    assert.match(source, /accessibilityLabel=/, `${file} should expose accessibility labels`);
  });
});
