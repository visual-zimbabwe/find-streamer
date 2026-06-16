const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatAwardCounts,
  parseAwardsFromBindings,
  parseAwardQueryResults,
  parseOmdbAwardsFallback,
  sortAwardGroups,
} = require('../src/lib/wikidataAwards.js');
const { resolveCommonsThumbUrls } = require('../src/lib/wikidataSoundtracks.js');

function wikidataIdFromUri(uri) {
  const match = String(uri || '').match(/\/entity\/(Q\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

test('parseAwardsFromBindings groups wins and nominations with logos', async () => {
  const thumbMap = await resolveCommonsThumbUrls([
    'Oscar-free-version.svg',
    '1991_Hugo_award_(with_variant_base).jpg',
  ]);

  const bindings = [
    {
      awardWin: { value: 'http://www.wikidata.org/entity/Q103618' },
      awardWinLabel: { value: 'Academy Award for Best Picture' },
      awardWinLogo: { value: 'Oscar-free-version.svg' },
    },
    {
      awardWin: { value: 'http://www.wikidata.org/entity/Q103618' },
      awardWinLabel: { value: 'Academy Award for Best Picture duplicate' },
    },
    {
      awardNomination: { value: 'http://www.wikidata.org/entity/Q1230887' },
      awardNominationLabel: { value: 'Hugo Award for Best Dramatic Presentation' },
      awardNomImage: { value: '1991_Hugo_award_(with_variant_base).jpg' },
    },
    {
      awardNomination: { value: 'http://www.wikidata.org/entity/Q1230887' },
      awardNominationLabel: { value: 'Golden Globe duplicate' },
    },
    {
      awardNomination: { value: 'http://www.wikidata.org/entity/Q1230887' },
      awardNominationLabel: { value: 'Golden Globe duplicate 2' },
    },
  ];

  const awards = parseAwardsFromBindings(bindings, wikidataIdFromUri);
  // Re-parse with resolved thumbs for logo assertions
  const wins = [];
  const nominations = [];
  for (const binding of bindings) {
    if (binding.awardWin?.value) {
      wins.push({
        award: binding.awardWin,
        awardLabel: binding.awardWinLabel,
        awardLogo: binding.awardWinLogo,
      });
    }
    if (binding.awardNomination?.value) {
      nominations.push({
        award: binding.awardNomination,
        awardLabel: binding.awardNominationLabel,
        awardImage: binding.awardNomImage,
      });
    }
  }
  const awardsWithLogos = parseAwardQueryResults({ wins, nominations }, thumbMap);

  assert.equal(awards.length, 2);
  assert.equal(awardsWithLogos[0].wikidataId, 'Q103618');
  assert.equal(awardsWithLogos[0].label, 'Academy Award for Best Picture');
  assert.equal(awardsWithLogos[0].wins, 2);
  assert.equal(awardsWithLogos[0].nominations, 0);
  assert.match(awardsWithLogos[0].logoUrl, /upload\.wikimedia\.org/);
  assert.equal(awardsWithLogos[1].wikidataId, 'Q1230887');
  assert.equal(awardsWithLogos[1].wins, 0);
  assert.equal(awardsWithLogos[1].nominations, 3);
  assert.match(awardsWithLogos[1].logoUrl, /upload\.wikimedia\.org/);
});

test('parseAwardQueryResults prefers P2910 icon over P154 logo', () => {
  const thumbMap = new Map([
    ['Oscar-icon.svg', 'https://upload.wikimedia.org/example/Oscar-icon.svg.png'],
    ['Oscar-free-version.svg', 'https://upload.wikimedia.org/example/Oscar-free-version.svg.png'],
  ]);

  const awards = parseAwardQueryResults(
    {
      wins: [
        {
          award: { value: 'http://www.wikidata.org/entity/Q102427' },
          awardLabel: { value: 'Academy Award for Best Picture' },
          awardIcon: { value: 'Oscar-icon.svg' },
          awardLogo: { value: 'Oscar-free-version.svg' },
        },
      ],
      nominations: [],
    },
    thumbMap,
  );

  assert.equal(awards.length, 1);
  assert.equal(awards[0].logoUrl, 'https://upload.wikimedia.org/example/Oscar-icon.svg.png');
});

test('parseAwardQueryResults inherits ceremony logos and handles Commons URLs', async () => {
  const thumbMap = await resolveCommonsThumbUrls(['Oscar-free-version.svg']);
  const awards = parseAwardQueryResults(
    {
      wins: [
        {
          award: { value: 'http://www.wikidata.org/entity/Q102427' },
          awardLabel: { value: 'Academy Award for Best Picture' },
          awardLogo: {
            value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Oscar-free-version.svg',
          },
        },
      ],
      nominations: [
        {
          award: { value: 'http://www.wikidata.org/entity/Q488645' },
          awardLabel: { value: 'Academy Award for Best Sound' },
        },
      ],
    },
    thumbMap,
  );

  assert.equal(awards.length, 2);
  assert.match(awards[0].logoUrl, /upload\.wikimedia\.org.*Oscar-free-version\.svg\.png/);
  assert.match(
    awards.find((group) => group.label.includes('Best Sound')).logoUrl,
    /upload\.wikimedia\.org.*Oscar-free-version\.svg\.png/,
  );
});

test('parseOmdbAwardsFallback parses wins and nominations', () => {
  const awards = parseOmdbAwardsFallback(
    'Nominated for 3 Oscars. Won 2 Golden Globes. 1 nomination for an Emmy Award.',
  );

  assert.equal(awards.length, 3);

  const oscars = awards.find((group) => group.key === 'oscar');
  assert.equal(oscars.label, 'Oscars');
  assert.equal(oscars.wins, 0);
  assert.equal(oscars.nominations, 3);
  assert.match(oscars.logoUrl, /^https:\/\//);

  const globes = awards.find((group) => group.key === 'globe');
  assert.equal(globes.wins, 2);
  assert.equal(globes.nominations, 0);

  const emmys = awards.find((group) => group.key === 'emmy');
  assert.equal(emmys.wins, 0);
  assert.equal(emmys.nominations, 1);
});

test('formatAwardCounts renders wins and nominations', () => {
  assert.equal(formatAwardCounts({ wins: 1, nominations: 0 }), '1 Win');
  assert.equal(formatAwardCounts({ wins: 2, nominations: 3 }), '2 Wins · 3 Nominations');
  assert.equal(formatAwardCounts({ wins: 0, nominations: 1 }), '1 Nomination');
});

test('sortAwardGroups orders by wins then nominations then label', () => {
  const sorted = sortAwardGroups([
    { label: 'Beta', wins: 0, nominations: 2 },
    { label: 'Alpha', wins: 1, nominations: 0 },
    { label: 'Gamma', wins: 1, nominations: 1 },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.label),
    ['Gamma', 'Alpha', 'Beta'],
  );
});
