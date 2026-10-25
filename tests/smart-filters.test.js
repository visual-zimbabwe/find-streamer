import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SMART_FILTER_KEYS,
  REGION_QUICK_PICK_FILTERS,
  VIBE_QUICK_PICK_FILTERS,
  smartFilterKeywordIds,
  smartFilterExcludeKeywordIds,
  smartFilterLanguageCodes,
  resolveEffectiveLanguageFilter,
  resolveEffectiveOriginCountries,
  buildDiscoverQueryParams,
  isAnimeItem,
  isExcludedBySmartFilters,
  isSmartFilterApplicableToMediaType,
  ANIME_KEYWORD_ID,
  BASED_ON_BOOK_KEYWORD_ID,
  TRUE_STORY_KEYWORD_ID,
  STAND_UP_KEYWORD_ID,
} from '../src/lib/smartFilters.js';
import { EU_COUNTRY_CODES, NORDIC_COUNTRY_CODES, LATIN_AMERICA_COUNTRY_CODES } from '../src/lib/countryPresets.js';
import { EU_LANGUAGE_CODES } from '../src/lib/languagePresets.js';

// ─── Catalogue ─────────────────────────────────────────────────────────────────

test('all regional, vibe, and legacy smart filters are registered', () => {
  assert.deepEqual(
    [...SMART_FILTER_KEYS].sort(),
    [
      'africa',
      'anime',
      'asia',
      'based_on_book',
      'bollywood',
      'chinese',
      'eu',
      'hidden_gems',
      'japanese',
      'korean',
      'latin_america',
      'middle_east',
      'miniseries',
      'non_english',
      'nordic',
      'stand_up',
      'true_story',
      'under_100m',
    ],
  );
  assert.deepEqual(
    REGION_QUICK_PICK_FILTERS.map((f) => f.key),
    ['non_english', 'eu', 'middle_east', 'asia', 'africa', 'nordic', 'latin_america'],
  );
  assert.deepEqual(
    VIBE_QUICK_PICK_FILTERS.map((f) => f.key),
    ['miniseries', 'under_100m', 'anime', 'based_on_book', 'true_story', 'stand_up', 'hidden_gems'],
  );
});

// ─── Include & Exclude Keyword Helpers ─────────────────────────────────────────

test('keyword-kind filters expose their keyword id on include and exclude', () => {
  assert.deepEqual(smartFilterKeywordIds(['anime']), [ANIME_KEYWORD_ID]);
  assert.deepEqual(smartFilterKeywordIds(['based_on_book', 'true_story', 'stand_up']), [
    BASED_ON_BOOK_KEYWORD_ID,
    TRUE_STORY_KEYWORD_ID,
    STAND_UP_KEYWORD_ID,
  ]);
  assert.deepEqual(smartFilterKeywordIds(['korean', 'eu']), []);
  assert.deepEqual(smartFilterExcludeKeywordIds(['anime', 'stand_up']), [
    ANIME_KEYWORD_ID,
    STAND_UP_KEYWORD_ID,
  ]);
});

test('language-kind filters expose their ISO codes; anime contributes none', () => {
  assert.deepEqual(smartFilterLanguageCodes(['korean']), ['ko']);
  assert.deepEqual(smartFilterLanguageCodes(['japanese']), ['ja']);
  assert.deepEqual(smartFilterLanguageCodes(['chinese']), ['zh', 'cn']);
  assert.deepEqual(smartFilterLanguageCodes(['bollywood']), ['hi']);
  assert.deepEqual(smartFilterLanguageCodes(['anime']), []);
});

test('European Union smart filter includes all 23 non-English official EU languages and never English', () => {
  const euLangs = smartFilterLanguageCodes(['eu']);
  assert.ok(!euLangs.includes('en'), 'EU language filter must strictly exclude English');
  const officialNonEnglishEu = [
    'bg', 'hr', 'cs', 'da', 'nl', 'et', 'fi', 'fr', 'de', 'el', 'hu', 'ga',
    'it', 'lv', 'lt', 'mt', 'pl', 'pt', 'ro', 'sk', 'sl', 'es', 'sv',
  ];
  for (const code of officialNonEnglishEu) {
    assert.ok(euLangs.includes(code), `EU languages should include ${code}`);
  }
  assert.deepEqual(euLangs, EU_LANGUAGE_CODES);
});

test('Middle East, Asian, African, Nordic, and Latin America filters expose their regional languages without English', () => {
  for (const key of ['eu', 'middle_east', 'asia', 'africa', 'nordic', 'latin_america']) {
    const codes = smartFilterLanguageCodes([key]);
    assert.ok(codes.length > 0, `${key} should resolve to non-empty language codes`);
    assert.ok(!codes.includes('en'), `${key} must not include English ('en')`);
  }
  const nonEnglish = resolveEffectiveLanguageFilter({ includeSmartTags: ['non_english'] });
  assert.ok(nonEnglish.withOriginalLanguage.length > 20);
  assert.ok(!nonEnglish.withOriginalLanguage.includes('en'));
});

// ─── Effective Language Set Algebra (Include \ Exclude) ────────────────────────

test('resolveEffectiveLanguageFilter computes Included \\ Excluded set difference', () => {
  // Include EU, exclude French and German -> EU languages minus fr & de
  const res = resolveEffectiveLanguageFilter({
    includeSmartTags: ['eu'],
    excludeLanguageCodes: ['fr', 'de'],
  });
  assert.ok(!res.withOriginalLanguage.includes('fr'));
  assert.ok(!res.withOriginalLanguage.includes('de'));
  assert.ok(res.withOriginalLanguage.includes('da'));
  assert.ok(res.withOriginalLanguage.includes('it'));
  assert.ok(!res.withOriginalLanguage.includes('en'));
});

test('resolveEffectiveLanguageFilter with only exclusions subtracts from ALL_DISCOVER_LANGUAGE_CODES', () => {
  // Hold to exclude European Union -> English and non-EU languages remain included!
  const res = resolveEffectiveLanguageFilter({
    excludeSmartTags: ['eu'],
  });
  assert.ok(res.withOriginalLanguage.includes('en'), 'English remains when only EU is excluded');
  assert.ok(res.withOriginalLanguage.includes('ja'), 'Japanese remains when only EU is excluded');
  assert.ok(!res.withOriginalLanguage.includes('fr'), 'French is removed when EU is excluded');
  assert.ok(!res.withOriginalLanguage.includes('da'), 'Danish is removed when EU is excluded');
});

test('holding Non-English to exclude resolves strictly to English-only', () => {
  const res = resolveEffectiveLanguageFilter({
    excludeSmartTags: ['non_english'],
  });
  assert.deepEqual(res.withOriginalLanguage, ['en']);
});

// ─── Effective Origin Country Resolution ──────────────────────────────────────

test('European Union smart filter scopes with_origin_country to all 27 EU member states', () => {
  const { withOriginCountries } = resolveEffectiveOriginCountries({
    includeSmartTags: ['eu'],
  });
  assert.equal(withOriginCountries.length, 27);
  assert.deepEqual(withOriginCountries, EU_COUNTRY_CODES);
  assert.ok(withOriginCountries.includes('FR'));
  assert.ok(withOriginCountries.includes('DE'));
  assert.ok(withOriginCountries.includes('DK'));
  assert.ok(withOriginCountries.includes('IE'));
  assert.ok(!withOriginCountries.includes('GB'), 'UK is not an EU member state');
  assert.ok(!withOriginCountries.includes('US'));
});

test('combining EU with Asian or Middle East unions partner country codes so cross-region queries work', () => {
  const { withOriginCountries } = resolveEffectiveOriginCountries({
    includeSmartTags: ['eu', 'middle_east'],
  });
  assert.ok(withOriginCountries.includes('FR'));
  assert.ok(withOriginCountries.includes('TR'));
  assert.ok(withOriginCountries.includes('LB'));
});

test('Nordic and Latin America smart filters scope with_origin_country to their member countries', () => {
  assert.deepEqual(
    resolveEffectiveOriginCountries({ includeSmartTags: ['nordic'] }).withOriginCountries,
    NORDIC_COUNTRY_CODES,
  );
  assert.deepEqual(
    resolveEffectiveOriginCountries({ includeSmartTags: ['latin_america'] }).withOriginCountries,
    LATIN_AMERICA_COUNTRY_CODES,
  );
});

// ─── Sort Count Invariance in buildDiscoverQueryParams ────────────────────────

test('sortBy NEVER changes vote_count.gte or any filter predicate in buildDiscoverQueryParams', () => {
  const sorts = [
    'popularity.desc',
    'vote_average.desc',
    'primary_release_date.desc',
    'primary_release_date.asc',
    'revenue.desc',
  ];

  const baseFilters = {
    mediaType: 'movie',
    minRating: 7,
    maxRating: 10,
    includeSmartTags: ['eu'],
    excludeGenreIds: [27],
  };

  const baseline = buildDiscoverQueryParams({ ...baseFilters, sortBy: 'popularity.desc' });
  assert.equal(baseline.params['vote_count.gte'], 20);

  for (const sortBy of sorts) {
    const built = buildDiscoverQueryParams({ ...baseFilters, sortBy });
    const { sort_by: _s1, ...restBaseline } = baseline.params;
    const { sort_by: _s2, ...restBuilt } = built.params;
    assert.deepEqual(
      restBuilt,
      restBaseline,
      `Filter query params for sortBy=${sortBy} must be 100% identical to popularity.desc`,
    );
  }
});

// ─── Vibe & Format Query Params ───────────────────────────────────────────────

test('vibe & format smart filters set exact TMDB discover parameters on include and exclude', () => {
  // Miniseries on TV
  const miniInc = buildDiscoverQueryParams({ mediaType: 'tv', includeSmartTags: ['miniseries'] });
  assert.equal(miniInc.params.with_type, '2');
  const miniExc = buildDiscoverQueryParams({ mediaType: 'tv', excludeSmartTags: ['miniseries'] });
  assert.equal(miniExc.params.with_type, '0|4');

  // Under 100m on Movie
  const shortInc = buildDiscoverQueryParams({ mediaType: 'movie', includeSmartTags: ['under_100m'] });
  assert.equal(shortInc.params['with_runtime.gte'], 60);
  assert.equal(shortInc.params['with_runtime.lte'], 100);
  const shortExc = buildDiscoverQueryParams({ mediaType: 'movie', excludeSmartTags: ['under_100m'] });
  assert.equal(shortExc.params['with_runtime.gte'], 101);

  // Hidden Gems
  const gemsInc = buildDiscoverQueryParams({ mediaType: 'movie', includeSmartTags: ['hidden_gems'] });
  assert.equal(gemsInc.params['vote_average.gte'], 7.5);
  assert.equal(gemsInc.params['vote_count.gte'], 50);
  assert.equal(gemsInc.params['vote_count.lte'], 500);
  const gemsExc = buildDiscoverQueryParams({ mediaType: 'movie', excludeSmartTags: ['hidden_gems'] });
  assert.equal(gemsExc.params['vote_count.gte'], 500);

  // African lowers vote_count.gte floor to 5 so African cinema isn't starved
  const africaInc = buildDiscoverQueryParams({ mediaType: 'movie', includeSmartTags: ['africa'] });
  assert.equal(africaInc.params['vote_count.gte'], 5);
});

test('isSmartFilterApplicableToMediaType scopes miniseries to TV and under_100m to Movie', () => {
  assert.equal(isSmartFilterApplicableToMediaType('miniseries', 'tv'), true);
  assert.equal(isSmartFilterApplicableToMediaType('miniseries', 'movie'), false);
  assert.equal(isSmartFilterApplicableToMediaType('under_100m', 'movie'), true);
  assert.equal(isSmartFilterApplicableToMediaType('under_100m', 'tv'), false);
  assert.equal(isSmartFilterApplicableToMediaType('eu', 'movie'), true);
  assert.equal(isSmartFilterApplicableToMediaType('eu', 'tv'), true);
});

// ─── Anime & Post-fetch Predicates ────────────────────────────────────────────

test('isAnimeItem requires Japanese original language AND the Animation genre', () => {
  assert.equal(isAnimeItem({ original_language: 'ja', genre_ids: [16] }), true);
  assert.equal(isAnimeItem({ original_language: 'ja', genre_ids: [18] }), false);
  assert.equal(isAnimeItem({ original_language: 'en', genre_ids: [16] }), false);
});

test('isExcludedBySmartFilters drops excluded languages, origin countries, or anime', () => {
  assert.equal(isExcludedBySmartFilters({ original_language: 'ko' }, ['korean']), true);
  assert.equal(isExcludedBySmartFilters({ original_language: 'cn' }, ['chinese']), true);
  assert.equal(isExcludedBySmartFilters({ original_language: 'hi' }, ['bollywood']), true);
  assert.equal(
    isExcludedBySmartFilters({ original_language: 'fr', origin_country: ['FR'] }, ['eu']),
    true,
  );
  assert.equal(
    isExcludedBySmartFilters({ original_language: 'ja', genre_ids: [16] }, ['anime']),
    true,
  );
  assert.equal(isExcludedBySmartFilters({ original_language: 'ko' }, []), false);
});

test('tvStatus: buildDiscoverQueryParams sets with_status for TV shows and ignores for movies', () => {
  const tvRet = buildDiscoverQueryParams({ mediaType: 'tv', tvStatus: 'returning' });
  assert.equal(tvRet.params.with_status, '0');

  const tvEnded = buildDiscoverQueryParams({ mediaType: 'tv', tvStatus: 'ended' });
  assert.equal(tvEnded.params.with_status, '3');

  const tvAll = buildDiscoverQueryParams({ mediaType: 'tv', tvStatus: 'all' });
  assert.equal(tvAll.params.with_status, undefined);

  const tvEmpty = buildDiscoverQueryParams({ mediaType: 'tv', tvStatus: '' });
  assert.equal(tvEmpty.params.with_status, undefined);

  // Numeric codes
  const tvCode0 = buildDiscoverQueryParams({ mediaType: 'tv', tvStatus: '0' });
  assert.equal(tvCode0.params.with_status, '0');

  const tvCode3 = buildDiscoverQueryParams({ mediaType: 'tv', tvStatus: '3' });
  assert.equal(tvCode3.params.with_status, '3');

  // Ignored on movies
  const movieEnded = buildDiscoverQueryParams({ mediaType: 'movie', tvStatus: 'ended' });
  assert.equal(movieEnded.params.with_status, undefined);
});
