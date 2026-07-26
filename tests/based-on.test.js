const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BASED_ON_CARD_CAP,
  buildAdaptationsQuery,
  buildSourceMetaLine,
  formatCreators,
  hasAdaptationKeyword,
  isAdaptationKeyword,
  hasSourceMaterialCredit,
  isScriptType,
  overflowSourceCount,
  parseAdaptationsFromBindings,
  parseBasedOnFromBindings,
  pickSourceType,
  sortSourceWorks,
  sourceSectionEyebrow,
} = require('../src/lib/basedOn.js');

const ENTITY = 'http://www.wikidata.org/entity/';

function binding(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) out[key] = { value };
  }
  return out;
}

// ─── The pre-signal ──────────────────────────────────────────────────────────

test('isAdaptationKeyword matches the "based on …" family', () => {
  for (const name of [
    'based on novel or book',
    'based on comic',
    'based on video game',
    'based on play or musical',
    'Based On Memoir Or Autobiography',
  ]) {
    assert.equal(isAdaptationKeyword(name), true, name);
  }

  for (const name of ['woman director', 'sequel', 'basedball', '', null, undefined]) {
    assert.equal(isAdaptationKeyword(name), false, String(name));
  }
});

test('isAdaptationKeyword rejects the keywords that name no source work', () => {
  // Measured: Chernobyl and Whiplash carry these and have no Wikidata P144, so
  // trusting them means reserving space the section then has to give back.
  assert.equal(isAdaptationKeyword('based on true story'), false);
  assert.equal(isAdaptationKeyword('based on true events'), false);
  assert.equal(isAdaptationKeyword('based on short film'), false);
});

test('hasSourceMaterialCredit reads the writing credit TMDb already ships', () => {
  // The real shapes, from /movie/{id}/credits.
  assert.equal(hasSourceMaterialCredit([{ name: 'Frank Herbert', job: 'Novel' }]), true);
  assert.equal(hasSourceMaterialCredit([{ name: 'Alan Moore', job: 'Graphic Novel' }]), true);
  assert.equal(hasSourceMaterialCredit([{ name: 'Kai Bird', job: 'Book' }]), true);
  assert.equal(
    hasSourceMaterialCredit([{ job: 'Director' }, { job: 'Screenplay' }, { job: 'Story' }]),
    false,
  );
  // "Adaptation" credits the person who adapted the screenplay — it put Parasite
  // in the adaptation bucket, which is why it is not on the list.
  assert.equal(hasSourceMaterialCredit([{ name: 'Kim Dae-hwan', job: 'Adaptation' }]), false);
  assert.equal(hasSourceMaterialCredit([]), false);
  assert.equal(hasSourceMaterialCredit(null), false);
});

test('hasAdaptationKeyword reads both TMDb payload shapes', () => {
  // Movies nest the array under `keywords`.
  assert.equal(
    hasAdaptationKeyword({ keywords: [{ name: 'dystopia' }, { name: 'based on novel or book' }] }),
    true,
  );
  // TV nests it under `results`.
  assert.equal(hasAdaptationKeyword({ results: [{ name: 'based on comic' }] }), true);
  // A bare array works too.
  assert.equal(hasAdaptationKeyword([{ name: 'based on video game' }]), true);

  assert.equal(hasAdaptationKeyword({ keywords: [{ name: 'heist' }] }), false);
  assert.equal(hasAdaptationKeyword({ keywords: [] }), false);
  assert.equal(hasAdaptationKeyword(undefined), false);
  assert.equal(hasAdaptationKeyword(null), false);
});

// ─── Type labelling ──────────────────────────────────────────────────────────

test('pickSourceType is deterministic regardless of binding order', () => {
  const types = ['1968 book', 'science fiction novel', 'novel', 'literary work'];
  const expected = pickSourceType(types);

  assert.equal(expected, 'novel');
  // The old implementation took the first non-generic entry, so a reordered set
  // — which is exactly what SPARQL hands back — produced a different label.
  assert.equal(pickSourceType([...types].reverse()), expected);
  assert.equal(pickSourceType(['science fiction novel', 'novel', '1968 book']), expected);
});

test('pickSourceType prefers the specific word and demotes generic ones', () => {
  assert.equal(pickSourceType(['literary work', 'graphic novel']), 'graphic novel');
  assert.equal(pickSourceType(['written work', 'manga']), 'manga');
  assert.equal(pickSourceType(['creative work', 'short story']), 'short story');
  assert.equal(pickSourceType([]), null);
  assert.equal(pickSourceType(undefined), null);
});

test('pickSourceType shows no label rather than a container word', () => {
  // What Wikidata actually returns for The Shining, Shōgun and Blade Runner's
  // novel: P31 = "literary work" and nothing else. A gold "Literary work:" badge
  // is database vocabulary, and the cover plus byline already say "book".
  assert.equal(pickSourceType(['literary work']), null);
  assert.equal(pickSourceType(['literary work', 'work', 'creative work']), null);
});

test('formatCreators is stable when Wikidata returns creators in any order', () => {
  const works = parseBasedOnFromBindings([
    binding({
      basedOn: `${ENTITY}Q128444`,
      basedOnLabel: 'Watchmen',
      basedOnAuthorLabel: 'Dave Gibbons',
    }),
    binding({
      basedOn: `${ENTITY}Q128444`,
      basedOnLabel: 'Watchmen',
      basedOnAuthorLabel: 'Alan Moore',
    }),
  ]);
  const reversed = parseBasedOnFromBindings([
    binding({
      basedOn: `${ENTITY}Q128444`,
      basedOnLabel: 'Watchmen',
      basedOnAuthorLabel: 'Alan Moore',
    }),
    binding({
      basedOn: `${ENTITY}Q128444`,
      basedOnLabel: 'Watchmen',
      basedOnAuthorLabel: 'Dave Gibbons',
    }),
  ]);

  assert.equal(formatCreators(works[0]), 'by Alan Moore and Dave Gibbons');
  assert.equal(formatCreators(reversed[0]), formatCreators(works[0]));
});

test('pickSourceType breaks ties alphabetically so unknown types stay stable', () => {
  const unknown = ['zoetrope thing', 'apocrypha thing'];
  assert.equal(pickSourceType(unknown), 'apocrypha thing');
  assert.equal(pickSourceType([...unknown].reverse()), 'apocrypha thing');
});

test('isScriptType spots the works whose own source we should follow', () => {
  assert.equal(isScriptType(['screenplay']), true);
  assert.equal(isScriptType(['teleplay', 'written work']), true);
  assert.equal(isScriptType(['novel']), false);
  assert.equal(isScriptType([]), false);
});

// ─── Card copy ───────────────────────────────────────────────────────────────

test('formatCreators names authors and illustrators without repeating anyone', () => {
  assert.equal(formatCreators({ authors: ['Philip K. Dick'] }), 'by Philip K. Dick');
  assert.equal(
    formatCreators({ authors: ['Neil Gaiman', 'Terry Pratchett'] }),
    'by Neil Gaiman and Terry Pratchett',
  );
  assert.equal(formatCreators({ authors: ['A', 'B', 'C'] }), 'by A, B and C');
  assert.equal(
    formatCreators({ authors: ['Alan Moore'], illustrators: ['Dave Gibbons'] }),
    'by Alan Moore, illustrated by Dave Gibbons',
  );
  // A manga source often carries P110 alone.
  assert.equal(formatCreators({ illustrators: ['Naoki Urasawa'] }), 'illustrated by Naoki Urasawa');
  // Same person credited both ways is named once.
  assert.equal(
    formatCreators({ authors: ['Osamu Tezuka'], illustrators: ['Osamu Tezuka'] }),
    'by Osamu Tezuka',
  );
  assert.equal(formatCreators({ authors: [], illustrators: [] }), null);
});

test('buildSourceMetaLine flags the weaker claim and appends the year', () => {
  assert.equal(
    buildSourceMetaLine({ relation: 'basedOn', authors: ['Stephen King'], year: 1977 }),
    'by Stephen King · 1977',
  );
  assert.equal(
    buildSourceMetaLine({ relation: 'inspiredBy', authors: ['Homer'], year: null }),
    'Inspired by · by Homer',
  );
  assert.equal(buildSourceMetaLine({ relation: 'basedOn', authors: [] }), null);
});

test('buildSourceMetaLine drops the relation when the header already says it', () => {
  // Stranger Things: nine P941 statements, so the eyebrow reads "INSPIRED BY"
  // and repeating it on every card is noise.
  assert.equal(
    buildSourceMetaLine({ relation: 'inspiredBy', year: 1975 }, { showRelation: false }),
    '1975',
  );
  assert.equal(
    buildSourceMetaLine({ relation: 'inspiredBy', year: 1975 }, { showRelation: true }),
    'Inspired by · 1975',
  );
});

test('sourceSectionEyebrow only says "Based On" when something actually is', () => {
  assert.equal(sourceSectionEyebrow([{ relation: 'basedOn' }]), 'Based On');
  assert.equal(sourceSectionEyebrow([{ relation: 'inspiredBy' }]), 'Inspired By');
  assert.equal(
    sourceSectionEyebrow([{ relation: 'basedOn' }, { relation: 'inspiredBy' }]),
    'Based On',
  );
  assert.equal(sourceSectionEyebrow([]), 'Based On');
});

// ─── Parsing ─────────────────────────────────────────────────────────────────

test('parseBasedOnFromBindings folds rows into one card per source work', () => {
  const works = parseBasedOnFromBindings([
    binding({
      basedOn: `${ENTITY}Q604818`,
      basedOnLabel: 'Do Androids Dream of Electric Sheep?',
      basedOnAuthorLabel: 'Philip K. Dick',
      basedOnTypeLabel: 'novel',
      basedOnDate: '+1968-01-01T00:00:00Z',
      basedOnImage: 'http://commons.wikimedia.org/wiki/Special:FilePath/DoAndroidsDream.jpg',
    }),
    // Same work, second type — the cross product returns one row per combination.
    binding({
      basedOn: `${ENTITY}Q604818`,
      basedOnLabel: 'Do Androids Dream of Electric Sheep?',
      basedOnAuthorLabel: 'Philip K. Dick',
      basedOnTypeLabel: 'science fiction novel',
    }),
  ]);

  assert.equal(works.length, 1);
  assert.equal(works[0].id, 'Q604818');
  assert.equal(works[0].name, 'Do Androids Dream of Electric Sheep?');
  assert.equal(works[0].relation, 'basedOn');
  assert.deepEqual(works[0].authors, ['Philip K. Dick']);
  assert.equal(works[0].year, 1968);
  assert.equal(pickSourceType(works[0].types), 'novel');
  assert.match(works[0].coverUrl, /Special:FilePath\/DoAndroidsDream\.jpg$/);
});

test('parseBasedOnFromBindings drops works Wikidata cannot name', () => {
  const works = parseBasedOnFromBindings([
    // Label service fell back to a bare QID.
    binding({ basedOn: `${ENTITY}Q1`, basedOnLabel: 'Q1' }),
    // Label service returned the entity URI.
    binding({ basedOn: `${ENTITY}Q2`, basedOnLabel: `${ENTITY}Q2` }),
    // No label at all.
    binding({ basedOn: `${ENTITY}Q3` }),
    binding({ basedOn: `${ENTITY}Q4`, basedOnLabel: 'The Shining' }),
  ]);

  assert.deepEqual(
    works.map((work) => work.name),
    ['The Shining'],
  );
});

test('parseBasedOnFromBindings follows one hop past a screenplay to its source', () => {
  const works = parseBasedOnFromBindings([
    binding({
      basedOn: `${ENTITY}Q900`,
      basedOnLabel: 'Some Screenplay',
      basedOnTypeLabel: 'screenplay',
      basedOnRoot: `${ENTITY}Q901`,
      basedOnRootLabel: 'The Actual Novel',
    }),
  ]);

  assert.equal(works.length, 1);
  // "Based on the screenplay by X" is a credit, not an answer.
  assert.equal(works[0].id, 'Q901');
  assert.equal(works[0].name, 'The Actual Novel');
  // The root's own P31 wasn't fetched, so it is better to show no type than to
  // relabel a novel "Screenplay".
  assert.deepEqual(works[0].types, []);
});

test('parseBasedOnFromBindings keeps a screenplay that has no deeper source', () => {
  const works = parseBasedOnFromBindings([
    binding({
      basedOn: `${ENTITY}Q900`,
      basedOnLabel: 'An Original Screenplay',
      basedOnTypeLabel: 'screenplay',
    }),
  ]);

  assert.equal(works[0].id, 'Q900');
  assert.equal(works[0].name, 'An Original Screenplay');
});

test('parseBasedOnFromBindings carries P941 as the weaker "inspired by" claim', () => {
  const works = parseBasedOnFromBindings([
    binding({
      inspiredBy: `${ENTITY}Q500`,
      inspiredByLabel: 'The Odyssey',
      inspiredByAuthorLabel: 'Homer',
      inspiredByTypeLabel: 'epic poem',
    }),
    binding({
      basedOn: `${ENTITY}Q400`,
      basedOnLabel: 'A Real Source',
      basedOnDate: '+1990-01-01T00:00:00Z',
    }),
  ]);

  // The stronger claim leads regardless of binding order.
  assert.deepEqual(
    works.map((work) => [work.name, work.relation]),
    [
      ['A Real Source', 'basedOn'],
      ['The Odyssey', 'inspiredBy'],
    ],
  );
});

test('parseBasedOnFromBindings collects illustrators alongside authors', () => {
  const works = parseBasedOnFromBindings([
    binding({
      basedOn: `${ENTITY}Q700`,
      basedOnLabel: 'Watchmen',
      basedOnAuthorLabel: 'Alan Moore',
      basedOnIllustratorLabel: 'Dave Gibbons',
      basedOnTypeLabel: 'graphic novel',
    }),
  ]);

  assert.deepEqual(works[0].authors, ['Alan Moore']);
  assert.deepEqual(works[0].illustrators, ['Dave Gibbons']);
  assert.equal(buildSourceMetaLine(works[0]), 'by Alan Moore, illustrated by Dave Gibbons');
});

test('parseBasedOnFromBindings tolerates junk', () => {
  assert.deepEqual(parseBasedOnFromBindings([]), []);
  assert.deepEqual(parseBasedOnFromBindings(null), []);
  assert.deepEqual(parseBasedOnFromBindings([{}, { basedOn: { value: 'not-a-uri' } }]), []);
});

test('sortSourceWorks orders by claim strength, then year, then name', () => {
  const sorted = sortSourceWorks([
    { name: 'Z', relation: 'basedOn', year: 2000 },
    { name: 'A', relation: 'inspiredBy', year: 1900 },
    { name: 'B', relation: 'basedOn', year: 1950 },
    { name: 'C', relation: 'basedOn', year: null },
  ]);

  assert.deepEqual(
    sorted.map((work) => work.name),
    ['B', 'Z', 'C', 'A'],
  );
});

// ─── Other adaptations ───────────────────────────────────────────────────────

test('buildAdaptationsQuery refuses anything that is not a QID', () => {
  assert.equal(buildAdaptationsQuery([]), null);
  assert.equal(buildAdaptationsQuery(null), null);
  assert.equal(buildAdaptationsQuery(['not-an-id']), null);

  const query = buildAdaptationsQuery(['Q604818']);
  assert.match(query, /VALUES \?source \{ wd:Q604818 \}/);
  assert.match(query, /\?work wdt:P144 \?source/);
  // Both TMDb identifier properties, so films and series both come back.
  assert.match(query, /wdt:P4947/);
  assert.match(query, /wdt:P4983/);
});

test('parseAdaptationsFromBindings keeps only rows Trova can open', () => {
  const rows = parseAdaptationsFromBindings([
    binding({ work: `${ENTITY}Q1`, workLabel: 'Blade Runner', tmdbMovie: '78', date: '+1982-06-25T00:00:00Z' }),
    binding({ work: `${ENTITY}Q2`, workLabel: 'Blade Runner 2049', tmdbMovie: '335984', date: '+2017-10-06T00:00:00Z' }),
    // No TMDb id — a dead end in this app.
    binding({ work: `${ENTITY}Q3`, workLabel: 'Some Radio Play' }),
    // A series carries P4983 instead.
    binding({ work: `${ENTITY}Q4`, workLabel: 'A Series', tmdbTv: '1399', date: '+2011-04-17T00:00:00Z' }),
  ]);

  assert.deepEqual(
    rows.map((row) => [row.title ?? row.name, row.mediaType, row.tmdbId]),
    [
      ['Blade Runner', 'movie', 78],
      ['A Series', 'tv', 1399],
      ['Blade Runner 2049', 'movie', 335984],
    ],
  );
});

test('parseAdaptationsFromBindings drops the title you are already looking at', () => {
  const bindings = [
    binding({ work: `${ENTITY}Q1`, workLabel: 'Blade Runner', tmdbMovie: '78' }),
    binding({ work: `${ENTITY}Q2`, workLabel: 'Blade Runner 2049', tmdbMovie: '335984' }),
  ];

  const rows = parseAdaptationsFromBindings(bindings, {
    excludeTmdbId: 78,
    excludeMediaType: 'movie',
  });
  assert.deepEqual(
    rows.map((row) => row.tmdbId),
    [335984],
  );

  // A TV entry with the same number is a different title.
  const keptTv = parseAdaptationsFromBindings(
    [binding({ work: `${ENTITY}Q9`, workLabel: 'Same Number, TV', tmdbTv: '78' })],
    { excludeTmdbId: 78, excludeMediaType: 'movie' },
  );
  assert.equal(keptTv.length, 1);
});

test('parseAdaptationsFromBindings dedupes repeated rows', () => {
  const rows = parseAdaptationsFromBindings([
    binding({ work: `${ENTITY}Q1`, workLabel: 'Dune', tmdbMovie: '438631' }),
    binding({ work: `${ENTITY}Q1`, workLabel: 'Dune', tmdbMovie: '438631' }),
  ]);
  assert.equal(rows.length, 1);
});

test('overflowSourceCount caps the wall of influences Stranger Things carries', () => {
  const nine = Array.from({ length: 9 }, (_, i) => ({ name: `Influence ${i}` }));
  assert.equal(BASED_ON_CARD_CAP, 3);
  assert.equal(overflowSourceCount(nine), 6);
  assert.equal(overflowSourceCount([{ name: 'Only one' }]), 0);
  assert.equal(overflowSourceCount([]), 0);
  assert.equal(overflowSourceCount(null), 0);
});
