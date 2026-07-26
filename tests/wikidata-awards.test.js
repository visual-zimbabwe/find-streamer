const test = require('node:test');
const assert = require('node:assert/strict');

const {
  awardCountLines,
  buildAwardCeremonies,
  categoryNameFromLabel,
  ceremonyNameFromLabel,
  formatAwardCounts,
  formatAwardTotals,
  groupAwardsByCeremony,
  mergeOmdbCeremonyCounts,
  parseAwardsFromBindings,
  parseAwardQueryResults,
  parseOmdbAwardTotals,
  parseOmdbAwardsFallback,
  sortAwardGroups,
  spokenAwardCounts,
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

test('formatAwardCounts does not report one trophy as a win and a nomination', () => {
  // Wikidata stores a won award as both P1411 and P166, which used to print
  // "1 Win · 1 Nomination" for a single Oscar on 23% of tiles.
  assert.equal(formatAwardCounts({ wins: 1, nominations: 1 }), '1 Win');
  assert.equal(formatAwardCounts({ wins: 3, nominations: 3 }), '3 Wins');
  // Nominations beyond the wins are real extra information and stay.
  assert.equal(formatAwardCounts({ wins: 3, nominations: 9 }), '3 Wins · 9 Nominations');
});

test('spokenAwardCounts phrases counts for a screen reader', () => {
  assert.equal(spokenAwardCounts({ wins: 3, nominations: 9 }), 'won 3 of 9 nominations');
  assert.equal(spokenAwardCounts({ wins: 1, nominations: 1 }), 'won 1 award');
  assert.equal(spokenAwardCounts({ wins: 0, nominations: 7 }), '7 nominations');
});

test('awardCountLines splits the tile counts over two lines', () => {
  assert.deepEqual(awardCountLines({ wins: 3, nominations: 9 }), {
    primary: '3 Wins',
    secondary: '9 Nominations',
  });
  assert.deepEqual(awardCountLines({ wins: 1, nominations: 1 }), {
    primary: '1 Win',
    secondary: null,
  });
  assert.deepEqual(awardCountLines({ wins: 0, nominations: 7 }), {
    primary: '7 Nominations',
    secondary: null,
  });
});

test('a ceremony tile prefers an emblem over a photo of a laureate', () => {
  const thumbMap = new Map([
    ['Emmy-icon.svg', 'https://upload.wikimedia.org/emblem.png'],
    ['Winner-holding-trophy.jpg', 'https://upload.wikimedia.org/laureate.png'],
  ]);

  const categories = parseAwardQueryResults(
    {
      wins: [
        {
          award: { value: 'http://www.wikidata.org/entity/Q1' },
          awardLabel: { value: 'Primetime Emmy Award for Outstanding Drama Series' },
          // P18 only — typically a press photo of whoever won it.
          awardImage: { value: 'Winner-holding-trophy.jpg' },
        },
        {
          award: { value: 'http://www.wikidata.org/entity/Q2' },
          awardLabel: { value: 'Primetime Emmy Award for Outstanding Writing' },
          awardIcon: { value: 'Emmy-icon.svg' },
        },
      ],
      nominations: [],
    },
    thumbMap,
  );

  const [emmy] = groupAwardsByCeremony(categories);
  assert.equal(emmy.logoUrl, 'https://upload.wikimedia.org/emblem.png');
  assert.equal(emmy.logoSource, 'icon');
});

test('ceremonyNameFromLabel splits a ceremony from its category', () => {
  assert.equal(
    ceremonyNameFromLabel('Primetime Emmy Award for Outstanding Drama Series'),
    'Primetime Emmy Award',
  );
  assert.equal(categoryNameFromLabel('Academy Award for Best Picture'), 'Best Picture');
  assert.equal(
    ceremonyNameFromLabel('Screen Actors Guild Award for Outstanding Performance by an Ensemble'),
    'Screen Actors Guild Award',
  );
  // Standalone awards ARE the ceremony — nothing to split.
  assert.equal(ceremonyNameFromLabel('Peabody Awards'), 'Peabody Awards');
  assert.equal(categoryNameFromLabel('Peabody Awards'), null);
  assert.equal(
    ceremonyNameFromLabel('National Board of Review: Top Ten Films'),
    'National Board of Review: Top Ten Films',
  );
});

test('groupAwardsByCeremony rolls Avatar up to the counts it actually won', () => {
  // Avatar's real record: 9 Oscar nominations, 3 wins. Wikidata expresses the
  // three wins as a win AND a nomination each, which only reads correctly once
  // aggregated to the ceremony.
  const categories = [
    { wikidataId: 'Q1', label: 'Academy Award for Best Cinematography', wins: 1, nominations: 1 },
    { wikidataId: 'Q2', label: 'Academy Award for Best Production Design', wins: 1, nominations: 1 },
    { wikidataId: 'Q3', label: 'Academy Award for Best Visual Effects', wins: 1, nominations: 1 },
    { wikidataId: 'Q4', label: 'Academy Award for Best Director', wins: 0, nominations: 1 },
    { wikidataId: 'Q5', label: 'Academy Award for Best Film Editing', wins: 0, nominations: 1 },
    { wikidataId: 'Q6', label: 'Academy Award for Best Original Score', wins: 0, nominations: 1 },
    { wikidataId: 'Q7', label: 'Academy Award for Best Picture', wins: 0, nominations: 1 },
    { wikidataId: 'Q8', label: 'Academy Award for Best Sound', wins: 0, nominations: 1 },
    { wikidataId: 'Q9', label: 'Academy Award for Best Sound Editing', wins: 0, nominations: 1 },
    { wikidataId: 'Q10', label: 'Golden Globe Award for Best Director', wins: 1, nominations: 0 },
  ];

  const grouped = groupAwardsByCeremony(categories);
  const academy = grouped.find((entry) => entry.label === 'Academy Award');

  assert.equal(grouped.length, 2);
  assert.equal(academy.wins, 3);
  assert.equal(academy.nominations, 9);
  assert.equal(formatAwardCounts(academy), '3 Wins · 9 Nominations');
  assert.equal(academy.categories.length, 9);
  // Winners sort ahead of the rest, and categories drop the ceremony prefix.
  assert.equal(academy.categories[0].label, 'Best Cinematography');
});

test('mergeOmdbCeremonyCounts fixes Wikidata undercounting long-running TV', () => {
  // Breaking Bad: Wikidata has 6 Emmy wins in statements, OMDb knows there were 16.
  const ceremonies = groupAwardsByCeremony([
    { wikidataId: 'Q1', label: 'Primetime Emmy Award for Outstanding Drama Series', wins: 6, nominations: 11 },
  ]);

  const merged = mergeOmdbCeremonyCounts(
    ceremonies,
    'Won 16 Primetime Emmys. 172 wins & 269 nominations total',
  );

  const emmy = merged.find((entry) => /emmy/i.test(entry.label));
  assert.equal(merged.length, 1, 'the OMDb Emmy count folds into the existing tile');
  assert.equal(emmy.wins, 16);
  assert.equal(emmy.nominations, 11);
});

test('mergeOmdbCeremonyCounts adds a ceremony Wikidata is missing entirely', () => {
  const merged = mergeOmdbCeremonyCounts(groupAwardsByCeremony([]), 'Won 6 Primetime Emmys.');
  assert.equal(merged.length, 1);
  assert.equal(merged[0].wins, 6);
  assert.match(merged[0].label, /emmy/i);
});

test('an OMDb-sourced ceremony is named and ranked like a Wikidata one', () => {
  // House of the Dragon: a Golden Globe from Wikidata, Emmys only from OMDb.
  // The OMDb tile used to read "Emmys" and sort last, because \bemmy\b never
  // matched the plural so it fell to the default rank.
  const ceremonies = buildAwardCeremonies(
    [{ wikidataId: 'Q1', label: 'Golden Globe Award for Best Drama Series', wins: 1, nominations: 0 }],
    'Won 2 Primetime Emmys. 23 wins & 99 nominations total',
  );

  assert.deepEqual(
    ceremonies.map((entry) => entry.label),
    ['Primetime Emmy Award', 'Golden Globe Award'],
  );
});

test('ceremony keys survive edition years and plural spellings', () => {
  const ceremonies = buildAwardCeremonies(
    [
      { wikidataId: 'Q1', label: '2018 Teen Choice Awards', wins: 1, nominations: 0 },
      { wikidataId: 'Q2', label: 'Teen Choice Award for Choice Animated Show', wins: 0, nominations: 1 },
    ],
    null,
  );

  assert.equal(ceremonies.length, 1, 'one ceremony, not one tile per edition');
  assert.equal(ceremonies[0].wins, 1);
  assert.equal(ceremonies[0].nominations, 1);
});

test('buildAwardCeremonies ranks by prestige, not alphabetically', () => {
  // The Simpsons used to lead with a Kids' Choice Award because every tile sat at
  // one win and the sort fell through to A-Z.
  const ceremonies = buildAwardCeremonies(
    [
      { wikidataId: 'Q1', label: "Kids' Choice Award for Favorite Cartoon", wins: 1, nominations: 1 },
      { wikidataId: 'Q2', label: 'Primetime Emmy Award for Outstanding Animated Program', wins: 1, nominations: 1 },
      { wikidataId: 'Q3', label: 'Peabody Awards', wins: 1, nominations: 0 },
      { wikidataId: 'Q4', label: 'Golden Globe Award for Best Television Series', wins: 0, nominations: 1 },
    ],
    null,
  );

  assert.deepEqual(
    ceremonies.map((entry) => entry.label),
    ['Primetime Emmy Award', 'Golden Globe Award', 'Peabody Awards', "Kids' Choice Award"],
  );
});

test('buildAwardCeremonies drops empty groups', () => {
  const ceremonies = buildAwardCeremonies(
    [{ wikidataId: 'Q1', label: 'Some Award for Nothing', wins: 0, nominations: 0 }],
    null,
  );
  assert.deepEqual(ceremonies, []);
});

test('parseOmdbAwardTotals reads every shape OMDb ships', () => {
  const won = parseOmdbAwardTotals('Won 3 Oscars. 91 wins & 131 nominations total');
  assert.equal(won.headline.kind, 'won');
  assert.equal(won.headline.count, 3);
  assert.equal(won.headline.award, 'Oscars');
  assert.equal(won.wins, 91);
  assert.equal(won.nominations, 131);

  const nominated = parseOmdbAwardTotals('Nominated for 7 Oscars. 21 wins & 42 nominations total');
  assert.equal(nominated.headline.kind, 'nominated');
  assert.equal(nominated.headline.count, 7);
  assert.equal(nominated.wins, 21);

  const emmys = parseOmdbAwardTotals('Won 16 Primetime Emmys. 172 wins & 269 nominations total');
  assert.equal(emmys.headline.award, 'Primetime Emmys');
  assert.equal(emmys.wins, 172);

  // No headline clause at all.
  const bare = parseOmdbAwardTotals('21 wins & 42 nominations total');
  assert.equal(bare.headline, null);
  assert.equal(bare.wins, 21);
  assert.equal(bare.nominations, 42);

  // Singular, and with no trailing "total".
  const singular = parseOmdbAwardTotals('1 win & 1 nomination');
  assert.equal(singular.wins, 1);
  assert.equal(singular.nominations, 1);

  // One half only.
  assert.equal(parseOmdbAwardTotals('11 nominations total').nominations, 11);
  assert.equal(parseOmdbAwardTotals('2 wins total').wins, 2);

  // A headline with no totals clause still yields a count.
  const headlineOnly = parseOmdbAwardTotals('Won 1 Oscar.');
  assert.equal(headlineOnly.wins, 1);

  assert.equal(parseOmdbAwardTotals('N/A'), null);
  assert.equal(parseOmdbAwardTotals(''), null);
  assert.equal(parseOmdbAwardTotals(null), null);
});

test('formatAwardTotals writes the headline line', () => {
  assert.equal(
    formatAwardTotals(parseOmdbAwardTotals('Won 3 Oscars. 91 wins & 131 nominations total')),
    'Won 3 Oscars · 91 wins & 131 nominations',
  );
  assert.equal(
    formatAwardTotals(parseOmdbAwardTotals('21 wins & 42 nominations total')),
    '21 wins & 42 nominations',
  );
  // The totals clause is dropped when it would only restate the headline.
  assert.equal(formatAwardTotals(parseOmdbAwardTotals('Won 1 Oscar.')), 'Won 1 Oscar');
  assert.equal(formatAwardTotals(null), null);
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
