import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_ACTING,
  ROLE_DIRECTING,
  ROLE_WRITING,
  ROLE_MUSIC,
  resolvePrimaryRoleType,
  resolveRailOrder,
  isDirectingCredit,
  isWritingCredit,
  isMusicCredit,
  isActingCredit,
  normalizeCreditItem,
  dedupeAndSortCredits,
  partitionFilmographyCredits,
} from '../src/lib/actorFilmographyModel.js';

test('resolvePrimaryRoleType maps raw roles to canonical types', () => {
  assert.equal(resolvePrimaryRoleType('cast'), ROLE_ACTING);
  assert.equal(resolvePrimaryRoleType('actor'), ROLE_ACTING);
  assert.equal(resolvePrimaryRoleType('actress'), ROLE_ACTING);

  assert.equal(resolvePrimaryRoleType('movie'), ROLE_DIRECTING);
  assert.equal(resolvePrimaryRoleType('tv'), ROLE_DIRECTING);
  assert.equal(resolvePrimaryRoleType('director'), ROLE_DIRECTING);
  assert.equal(resolvePrimaryRoleType('directing'), ROLE_DIRECTING);
  assert.equal(resolvePrimaryRoleType('creator'), ROLE_DIRECTING);

  assert.equal(resolvePrimaryRoleType('writer'), ROLE_WRITING);
  assert.equal(resolvePrimaryRoleType('writing'), ROLE_WRITING);
  assert.equal(resolvePrimaryRoleType('screenplay'), ROLE_WRITING);
  assert.equal(resolvePrimaryRoleType('author'), ROLE_WRITING);

  assert.equal(resolvePrimaryRoleType('composer'), ROLE_MUSIC);
  assert.equal(resolvePrimaryRoleType('music'), ROLE_MUSIC);

  // Fallback defaults to acting
  assert.equal(resolvePrimaryRoleType(null), ROLE_ACTING);
  assert.equal(resolvePrimaryRoleType(''), ROLE_ACTING);
});

test('resolveRailOrder prioritizes primary role type first', () => {
  assert.deepEqual(resolveRailOrder('cast'), [ROLE_ACTING, ROLE_DIRECTING, ROLE_WRITING, ROLE_MUSIC]);
  assert.deepEqual(resolveRailOrder('movie'), [ROLE_DIRECTING, ROLE_ACTING, ROLE_WRITING, ROLE_MUSIC]);
  assert.deepEqual(resolveRailOrder('writer'), [ROLE_WRITING, ROLE_ACTING, ROLE_DIRECTING, ROLE_MUSIC]);
  assert.deepEqual(resolveRailOrder('composer'), [ROLE_MUSIC, ROLE_DIRECTING, ROLE_WRITING, ROLE_ACTING]);
});

test('isDirectingCredit matches directors, creators, co-directors, and excludes assistants', () => {
  assert.equal(isDirectingCredit({ job: 'Director' }), true);
  assert.equal(isDirectingCredit({ job: 'Creator' }), true);
  assert.equal(isDirectingCredit({ job: 'Co-Director' }), true);
  assert.equal(isDirectingCredit({ job: 'Series Director' }), true);
  assert.equal(isDirectingCredit({ department: 'Directing', job: 'Director' }), true);

  // Non-directing crew
  assert.equal(isDirectingCredit({ job: 'First Assistant Director', department: 'Directing' }), false);
  assert.equal(isDirectingCredit({ job: 'Producer' }), false);
  assert.equal(isDirectingCredit(null), false);
});

test('isActingCredit matches cast items with character or media_type', () => {
  assert.equal(isActingCredit({ media_type: 'movie' }), true);
  assert.equal(isActingCredit({ media_type: 'tv' }), true);
  assert.equal(isActingCredit({ character: 'Sherlock Holmes' }), true);
  assert.equal(isActingCredit(null), false);
});

test('isWritingCredit matches writers, screenplay, teleplay, story, author jobs', () => {
  assert.equal(isWritingCredit({ job: 'Writer' }), true);
  assert.equal(isWritingCredit({ job: 'Screenplay' }), true);
  assert.equal(isWritingCredit({ job: 'Story' }), true);
  assert.equal(isWritingCredit({ job: 'Teleplay' }), true);
  assert.equal(isWritingCredit({ job: 'Novel' }), true);
  assert.equal(isWritingCredit({ job: 'Characters' }), true);
  assert.equal(isWritingCredit({ department: 'Writing' }), true);

  // Non-writing
  assert.equal(isWritingCredit({ job: 'Cinematographer' }), false);
  assert.equal(isWritingCredit(null), false);
});

test('isMusicCredit matches composer and music credits', () => {
  assert.equal(isMusicCredit({ job: 'Original Music Composer' }), true);
  assert.equal(isMusicCredit({ job: 'Composer' }), true);
  assert.equal(isMusicCredit({ job: 'Original Score' }), true);
  assert.equal(isMusicCredit({ department: 'Sound', job: 'Original Music Composer' }), true);

  // Non-music
  assert.equal(isMusicCredit({ job: 'Sound Editor' }), false);
  assert.equal(isMusicCredit(null), false);
});

test('normalizeCreditItem correctly formats fields, rating and metaText', () => {
  const raw = {
    id: 157336,
    title: 'Interstellar',
    media_type: 'movie',
    character: 'Cooper',
    release_date: '2014-11-05',
    vote_average: 8.43,
    vote_count: 34000,
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  };

  const item = normalizeCreditItem(raw, ROLE_ACTING);
  assert.equal(item.id, 'movie:157336');
  assert.equal(item.tmdbId, 157336);
  assert.equal(item.mediaType, 'movie');
  assert.equal(item.title, 'Interstellar');
  assert.equal(item.year, '2014');
  assert.equal(item.rating, '8.4');
  assert.equal(item.roleMeta, 'as Cooper');
  assert.equal(item.metaText, '2014 · as Cooper');
  assert.equal(item.posterUrl, 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg');
});

test('dedupeAndSortCredits sorts by rating descending and deduplicates titles', () => {
  const items = [
    {
      id: 101,
      media_type: 'movie',
      title: 'Lower Rated',
      vote_average: 6.5,
      vote_count: 100,
      release_date: '2020-01-01',
    },
    {
      id: 102,
      media_type: 'movie',
      title: 'Higher Rated',
      vote_average: 8.9,
      vote_count: 500,
      release_date: '2018-05-01',
    },
    {
      id: 101,
      media_type: 'movie',
      title: 'Duplicate Lower Rated',
      vote_average: 6.5,
      vote_count: 100,
      release_date: '2020-01-01',
    },
  ];

  const processed = dedupeAndSortCredits(items, ROLE_ACTING);
  assert.equal(processed.length, 2);
  assert.equal(processed[0].tmdbId, 102);
  assert.equal(processed[1].tmdbId, 101);
});

test('partitionFilmographyCredits partitions into distinct non-empty rails in prioritized order', () => {
  const data = {
    cast: [
      {
        id: 1,
        title: 'Actor Movie 1',
        media_type: 'movie',
        character: 'Hero',
        vote_average: 8.2,
        vote_count: 100,
        release_date: '2021-01-01',
      },
      {
        id: 2,
        name: 'Actor TV 1',
        media_type: 'tv',
        character: 'Detective',
        vote_average: 7.9,
        vote_count: 50,
        first_air_date: '2020-01-01',
      },
    ],
    crew: [
      {
        id: 3,
        title: 'Directed Film',
        media_type: 'movie',
        job: 'Director',
        vote_average: 8.8,
        vote_count: 200,
        release_date: '2019-01-01',
      },
      {
        id: 4,
        title: 'Written Film',
        media_type: 'movie',
        job: 'Screenplay',
        vote_average: 8.5,
        vote_count: 150,
        release_date: '2017-01-01',
      },
    ],
  };

  // Case 1: Cast tapped -> Acting rail first
  const resultActing = partitionFilmographyCredits(data, 'cast');
  assert.equal(resultActing.rails.length, 3);
  assert.equal(resultActing.rails[0].id, ROLE_ACTING);
  assert.equal(resultActing.rails[0].title, 'Acting');
  assert.equal(resultActing.rails[0].count, 2);
  assert.equal(resultActing.rails[1].id, ROLE_DIRECTING);
  assert.equal(resultActing.rails[1].title, 'Directing');
  assert.equal(resultActing.rails[1].count, 1);
  assert.equal(resultActing.rails[2].id, ROLE_WRITING);
  assert.equal(resultActing.rails[2].title, 'Writing');
  assert.equal(resultActing.rails[2].count, 1);

  // Case 2: Director tapped -> Directing rail first
  const resultDirecting = partitionFilmographyCredits(data, 'movie');
  assert.equal(resultDirecting.rails[0].id, ROLE_DIRECTING);
  assert.equal(resultDirecting.rails[1].id, ROLE_ACTING);
  assert.equal(resultDirecting.rails[2].id, ROLE_WRITING);

  // Case 3: Writer tapped -> Writing rail first
  const resultWriting = partitionFilmographyCredits(data, 'writer');
  assert.equal(resultWriting.rails[0].id, ROLE_WRITING);
  assert.equal(resultWriting.rails[1].id, ROLE_ACTING);
  assert.equal(resultWriting.rails[2].id, ROLE_DIRECTING);
});

test('partitionFilmographyCredits omits rails that have zero credits', () => {
  const actorOnly = {
    cast: [
      {
        id: 10,
        title: 'Solo Movie',
        media_type: 'movie',
        vote_average: 7.5,
        vote_count: 20,
      },
    ],
    crew: [],
  };

  const res = partitionFilmographyCredits(actorOnly, 'cast');
  assert.equal(res.rails.length, 1);
  assert.equal(res.rails[0].id, ROLE_ACTING);
  assert.equal(res.rails[0].count, 1);
});

test('partitionFilmographyCredits handles empty payload gracefully', () => {
  const empty = partitionFilmographyCredits(null);
  assert.equal(empty.rails.length, 0);
  assert.equal(empty.totalCreditsCount, 0);
});

test('normalizeCreditItem supports already-normalized items preserving mediaType and posterUrl', () => {
  const normalizedTv = {
    id: 'tv:157744',
    tmdbId: 157744,
    mediaType: 'tv',
    title: '1923',
    year: '2022',
    rawYear: 2022,
    posterUrl: 'https://image.tmdb.org/t/p/w500/zgZRJZvZn5cpsWAB0zMUdad3iZd.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/vIioWssbxRtEkIzgj8r0pCWYkYM.jpg',
    ratingValue: 8.3,
    rating: '8.3/10',
    voteCount: 870,
    roleMeta: 'as Mabel',
  };

  const output = normalizeCreditItem(normalizedTv, ROLE_ACTING);
  assert.equal(output.mediaType, 'tv');
  assert.equal(output.tmdbId, 157744);
  assert.equal(output.posterUrl, 'https://image.tmdb.org/t/p/w500/zgZRJZvZn5cpsWAB0zMUdad3iZd.jpg');
  assert.equal(output.backdropUrl, 'https://image.tmdb.org/t/p/original/vIioWssbxRtEkIzgj8r0pCWYkYM.jpg');
  assert.equal(output.roleMeta, 'as Mabel');
});

