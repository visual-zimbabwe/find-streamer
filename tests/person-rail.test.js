import test from 'node:test';
import assert from 'node:assert/strict';
import {
  personKey,
  formatPersonRoleLabel,
  formatPersonAccessibilityLabel,
  formatPersonSeeAllAccessibilityLabel,
  calculateRemainingCount,
  resolvePersonRailConfig,
} from '../src/lib/personRailModel.js';

test('personKey generates stable, deterministic identifiers', () => {
  assert.equal(
    personKey({ id: 12345, name: 'Ellen Pompeo', role: 'cast' }, 0),
    'cast-12345-0',
  );
  assert.equal(
    personKey({ tmdbId: 6789, name: 'Shonda Rhimes', role: 'writer' }, 2),
    'writer-6789-2',
  );
  assert.equal(
    personKey({ name: 'Christopher Nolan' }, 1),
    'person-Christopher Nolan-1',
  );
  assert.equal(personKey(null, 5), 'person-item-5');
});

test('formatPersonRoleLabel extracts roles and falls back gracefully', () => {
  assert.equal(
    formatPersonRoleLabel({ roleLabel: 'Meredith Grey' }),
    'Meredith Grey',
  );
  assert.equal(
    formatPersonRoleLabel({ character: 'Richard Webber' }),
    'Richard Webber',
  );
  assert.equal(formatPersonRoleLabel({ job: 'Director' }), 'Director');
  assert.equal(formatPersonRoleLabel({ department: 'Writing' }), 'Writing');
  assert.equal(formatPersonRoleLabel({ role: 'cast' }), 'Cast');
  assert.equal(formatPersonRoleLabel({ role: 'director' }), 'Director');
  assert.equal(formatPersonRoleLabel({ role: 'composer' }), 'Composer');
  assert.equal(formatPersonRoleLabel({ role: 'creator' }), 'Creator');
  assert.equal(formatPersonRoleLabel({}), '');
  assert.equal(formatPersonRoleLabel(null), '');
});

test('formatPersonAccessibilityLabel describes actor, character, and peek hints', () => {
  assert.equal(
    formatPersonAccessibilityLabel(
      { name: 'Ellen Pompeo', roleLabel: 'Meredith Grey' },
      { canPeek: true },
    ),
    'Ellen Pompeo, Meredith Grey. View filmography. Hold for a quick filmography preview',
  );

  assert.equal(
    formatPersonAccessibilityLabel(
      { name: 'Shonda Rhimes', roleLabel: 'Creator' },
      { canPeek: false },
    ),
    'Shonda Rhimes, Creator. View filmography',
  );

  assert.equal(
    formatPersonAccessibilityLabel({ name: 'Unknown Extra' }),
    'Unknown Extra. View filmography',
  );

  assert.equal(formatPersonAccessibilityLabel(null), 'Talent card');
});

test('formatPersonSeeAllAccessibilityLabel formats header and card labels', () => {
  assert.equal(
    formatPersonSeeAllAccessibilityLabel('Cast', 62),
    'See all 62 cast',
  );
  assert.equal(
    formatPersonSeeAllAccessibilityLabel('Crew', 14),
    'See all 14 crew',
  );
  assert.equal(
    formatPersonSeeAllAccessibilityLabel('Cast and crew'),
    'See all cast and crew',
  );
  assert.equal(
    formatPersonSeeAllAccessibilityLabel('', null),
    'See all talent',
  );
});

test('calculateRemainingCount computes remaining unrendered items', () => {
  assert.equal(calculateRemainingCount(62, 10), 52);
  assert.equal(calculateRemainingCount(10, 10), null);
  assert.equal(calculateRemainingCount(5, 10), null);
  assert.equal(calculateRemainingCount(null, 10), null);
  assert.equal(calculateRemainingCount(undefined, 10), null);
});

test('resolvePersonRailConfig sets appropriate defaults', () => {
  const config = resolvePersonRailConfig({
    title: 'Cast',
    data: [{ name: 'Actor 1' }, { name: 'Actor 2' }],
    totalCount: 15,
    onSeeAll: () => {},
  });

  assert.equal(config.title, 'Cast');
  assert.equal(config.items.length, 2);
  assert.equal(config.totalCount, 15);
  assert.equal(config.remainingCount, 13);
  assert.equal(config.showSeeAllTile, true);
  assert.equal(config.showHeaderSeeAll, true);
  assert.equal(config.seeAllLabel, 'See All 15');
  assert.equal(config.bleed, true);
});

test('resolvePersonRailConfig suppresses see-all tile when all items are visible', () => {
  const config = resolvePersonRailConfig({
    title: 'Crew',
    data: [{ name: 'Director' }],
    totalCount: 1,
    onSeeAll: () => {},
  });

  assert.equal(config.remainingCount, null);
  assert.equal(config.showSeeAllTile, false);
});
