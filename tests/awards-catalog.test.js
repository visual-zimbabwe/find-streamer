const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getAwardsCeremonies,
  getCeremonyById,
  getWinnersForCeremony,
  getAllAwardWinners,
  getAwardWinnerItem,
  getAwardsForMovie,
  getAwardCeremonyRows,
  getPrestigeTopWinners,
} = require('../src/lib/awardsCatalog.js');

test('getAwardsCeremonies returns 22 prestigious ceremonies with metadata', () => {
  const ceremonies = getAwardsCeremonies();
  assert.ok(Array.isArray(ceremonies));
  assert.equal(ceremonies.length, 22);

  const cannes = ceremonies.find((c) => c.id === 'cannes');
  assert.ok(cannes);
  assert.equal(cannes.name, 'Festival de Cannes');
  assert.equal(cannes.awardName, "Palme d'Or");
  assert.equal(cannes.country, 'France');
  assert.equal(cannes.wikidataId, 'Q179887');
  assert.ok(cannes.winnersCount > 100);

  const oscars = ceremonies.find((c) => c.id === 'oscars_picture');
  assert.ok(oscars);
  assert.equal(oscars.shortName, 'Oscars');
  assert.equal(oscars.founded, 1929);
});

test('getCeremonyById returns correct ceremony and winners', () => {
  const cannes = getCeremonyById('cannes');
  assert.ok(cannes);
  assert.equal(cannes.id, 'cannes');
  assert.ok(Array.isArray(cannes.winners));

  const anora = cannes.winners.find((w) => w.title === 'Anora');
  assert.ok(anora);
  assert.equal(anora.awardYear, '2024');
  assert.equal(anora.position, 1);
  assert.equal(anora.director, 'Sean Baker');
  assert.ok(anora.posterUrl);
  assert.ok(anora.ratingValue > 0);
});

test('getWinnersForCeremony respects limit', () => {
  const allWinners = getWinnersForCeremony('cannes');
  const topFive = getWinnersForCeremony('cannes', 5);
  assert.equal(topFive.length, 5);
  assert.deepEqual(topFive, allWinners.slice(0, 5));
});

test('getAllAwardWinners returns unique winning films with awards history', () => {
  const all = getAllAwardWinners();
  assert.ok(Array.isArray(all));
  assert.ok(all.length >= 1000);

  // Check Parasite (ID 496243)
  const parasite = all.find((m) => m.id === 496243);
  assert.ok(parasite);
  assert.equal(parasite.title, 'Parasite');
  assert.ok(Array.isArray(parasite.awards));
  assert.ok(parasite.awards.length >= 2); // Cannes Palme d'Or + Oscar Best Picture / International
});

test('getAwardWinnerItem and getAwardsForMovie lookup by tmdbId', () => {
  const parasite = getAwardWinnerItem(496243);
  assert.ok(parasite);
  assert.equal(parasite.title, 'Parasite');

  const awards = getAwardsForMovie(496243);
  assert.ok(Array.isArray(awards));
  const hasCannes = awards.some((a) => a.ceremonyId === 'cannes');
  assert.ok(hasCannes);
});

test('getAwardCeremonyRows formats rows compatible with ContentRail', () => {
  const rows = getAwardCeremonyRows();
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, 22);

  const row = rows[0];
  assert.ok(row.category);
  assert.ok(row.category.id.startsWith('award_'));
  assert.ok(row.category.label);
  assert.equal(row.category.isAwardCeremony, true);
  assert.ok(Array.isArray(row.items));
  assert.ok(row.items.length > 0);
  assert.ok(row.items[0].id);
  assert.ok(row.items[0].title);
  assert.ok(row.items[0].posterUrl);
});

test('getPrestigeTopWinners returns multi-award winning titles', () => {
  const top10 = getPrestigeTopWinners(10);
  assert.equal(top10.length, 10);
  // Multi-award winners should have at least 2 awards
  assert.ok(top10[0].awards.length >= 2);
});
