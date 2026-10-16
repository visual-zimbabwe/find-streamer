const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('75 GB quota and downloadManager utilities', () => {
  const dmSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'downloadManager.js'),
    'utf8',
  );
  assert.match(
    dmSource,
    /MAX_DOWNLOAD_QUOTA_BYTES\s*=\s*75\s*\*\s*1024\s*\*\s*1024\s*\*\s*1024/,
    'downloadManager should enforce 75 GB max download quota',
  );

  const goSource = fs.readFileSync(
    path.join(__dirname, '..', 'android-engine', 'main.go'),
    'utf8',
  );
  assert.match(
    goSource,
    /MaxDownloadQuotaBytes\s*=\s*int64\(75\)\s*\*\s*1024\s*\*\s*1024\s*\*\s*1024/,
    'Go native engine should enforce 75 GB MaxDownloadQuotaBytes',
  );
  assert.ok(goSource.includes('mux.HandleFunc("/download/start"'), 'Go engine should expose /download/start');
  assert.ok(goSource.includes('mux.HandleFunc("/download/status"'), 'Go engine should expose /download/status');
  assert.ok(goSource.includes('mux.HandleFunc("/download/pause"'), 'Go engine should expose /download/pause');
  assert.ok(goSource.includes('mux.HandleFunc("/download/resume"'), 'Go engine should expose /download/resume');
  assert.ok(goSource.includes('mux.HandleFunc("/download/delete"'), 'Go engine should expose /download/delete');
  assert.ok(goSource.includes('mux.HandleFunc("/download/play"'), 'Go engine should expose /download/play');
});

test('MovieStreamSheet and SeasonDetailSheet use text-only borderless download actions', () => {
  const movieSheet = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'MovieStreamSheet.js'),
    'utf8',
  );
  assert.ok(movieSheet.includes('Play Downloaded'), 'MovieStreamSheet should include Play Downloaded action');
  assert.ok(movieSheet.includes('Delete Download'), 'MovieStreamSheet should include Delete Download action');
  assert.ok(movieSheet.includes('75 GB'), 'MovieStreamSheet should display 75 GB storage cap');
  assert.ok(!movieSheet.includes('<Ionicons'), 'MovieStreamSheet should not render icons');

  const seasonSheet = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'SeasonDetailSheet.js'),
    'utf8',
  );
  assert.ok(seasonSheet.includes('Play Downloaded'), 'SeasonDetailSheet should include Play Downloaded action');
  assert.ok(seasonSheet.includes('Delete Download'), 'SeasonDetailSheet should include Delete Download action');
  assert.ok(seasonSheet.includes('Delete Season Pack'), 'SeasonDetailSheet should include Delete Season Pack action');
  assert.ok(seasonSheet.includes('75 GB'), 'SeasonDetailSheet should display 75 GB storage cap');
  assert.ok(!seasonSheet.includes('<Ionicons'), 'SeasonDetailSheet should not render icons');
});

test('Season pack downloads expand into individual episode downloads', () => {
  const goSource = fs.readFileSync(
    path.join(__dirname, '..', 'android-engine', 'main.go'),
    'utf8',
  );
  assert.ok(
    goSource.includes('func extractSeasonPackFiles('),
    'Go engine should extract all episode video files from a season pack torrent',
  );
  assert.ok(
    goSource.includes('func parseSeasonEpisodeFromName('),
    'Go engine should parse season and episode numbers from torrent file paths',
  );

  const dmSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'downloadManager.js'),
    'utf8',
  );
  assert.ok(
    dmSource.includes('export function findSeasonDownloads('),
    'downloadManager should expose findSeasonDownloads helper',
  );
});
