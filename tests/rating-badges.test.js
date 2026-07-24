import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseScore,
  rottenTomatoesFresh,
  rottenTomatoesEmoji,
  metacriticBadge,
  rottenTomatoesUrl,
  metacriticUrl,
} from '../src/lib/ratingBadges.js';

test('parseScore reads the leading number from each score shape', () => {
  assert.equal(parseScore('8.1/10'), 8.1);
  assert.equal(parseScore('91%'), 91);
  assert.equal(parseScore('74'), 74);
  assert.equal(parseScore(74), 74);
  assert.equal(parseScore(null), null);
  assert.equal(parseScore('N/A'), null);
});

test('rottenTomatoesFresh flips at the 60% line', () => {
  assert.equal(rottenTomatoesFresh('60%'), true);
  assert.equal(rottenTomatoesFresh('91%'), true);
  assert.equal(rottenTomatoesFresh('59%'), false);
  assert.equal(rottenTomatoesFresh('22%'), false);
  // No parseable score keeps the neutral tomato rather than asserting rotten.
  assert.equal(rottenTomatoesFresh(null), true);
});

test('rottenTomatoesEmoji shows the splat only when rotten', () => {
  assert.equal(rottenTomatoesEmoji('91%'), '🍅');
  assert.equal(rottenTomatoesEmoji('22%'), '🤢');
});

test('metacriticBadge colors by Metacritic thresholds', () => {
  // Green >= 61
  assert.deepEqual(metacriticBadge('74'), { bg: '#66CC33', fg: '#ffffff' });
  assert.deepEqual(metacriticBadge('61'), { bg: '#66CC33', fg: '#ffffff' });
  // Yellow 40-60, with dark text for contrast
  assert.deepEqual(metacriticBadge('60'), { bg: '#FFCC33', fg: '#141414' });
  assert.deepEqual(metacriticBadge('40'), { bg: '#FFCC33', fg: '#141414' });
  // Red <= 39
  assert.deepEqual(metacriticBadge('39'), { bg: '#FF6874', fg: '#ffffff' });
  assert.deepEqual(metacriticBadge('12'), { bg: '#FF6874', fg: '#ffffff' });
});

test('rottenTomatoesUrl deep-links to the title page with underscores', () => {
  assert.equal(rottenTomatoesUrl({ title: 'The Batman' }), 'https://www.rottentomatoes.com/m/the_batman');
  assert.equal(
    rottenTomatoesUrl({ title: 'Top Gun: Maverick' }),
    'https://www.rottentomatoes.com/m/top_gun_maverick',
  );
  // TV lands under /tv/.
  assert.equal(
    rottenTomatoesUrl({ title: 'Breaking Bad', mediaType: 'tv' }),
    'https://www.rottentomatoes.com/tv/breaking_bad',
  );
  // Diacritics normalize away.
  assert.equal(rottenTomatoesUrl({ title: 'Amélie' }), 'https://www.rottentomatoes.com/m/amelie');
  // Only a genuinely empty title falls back to search.
  assert.ok(rottenTomatoesUrl({ title: '' }).includes('/search?search='));
});

test('metacriticUrl deep-links to the title page with hyphens', () => {
  assert.equal(metacriticUrl({ title: 'The Batman' }), 'https://www.metacritic.com/movie/the-batman');
  assert.equal(
    metacriticUrl({ title: 'Top Gun: Maverick' }),
    'https://www.metacritic.com/movie/top-gun-maverick',
  );
  assert.equal(
    metacriticUrl({ title: 'Breaking Bad', mediaType: 'tv' }),
    'https://www.metacritic.com/tv/breaking-bad',
  );
  assert.ok(metacriticUrl({ title: '' }).includes('/search/all/'));
});
