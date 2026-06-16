import test from 'node:test';
import assert from 'node:assert/strict';
import {
  codesForCountryPreset,
  findCountryPreset,
  filterCountriesByPreset,
} from '../src/lib/countryPresets.js';
import {
  codesForPreset,
  resolvePreset,
  findPreset,
  NON_ENGLISH_CODES,
  LANGUAGE_TO_COUNTRY_PRESET,
} from '../src/lib/languagePresets.js';

// ─── Country presets → effective ISO 3166-1 code sets ──────────────────────────

test('country preset ids expand to their curated code lists', () => {
  const latam = codesForCountryPreset('latin_america');
  assert.ok(latam.includes('BR'));
  assert.ok(latam.includes('AR'));
  assert.ok(latam.includes('MX'));
  assert.ok(latam.length > 5);

  const middleEast = codesForCountryPreset('middle_east');
  assert.ok(middleEast.includes('SA'));
  assert.ok(middleEast.includes('AE'));
  assert.ok(middleEast.includes('TR'));
});

test('unknown country preset ids resolve to an empty code list', () => {
  assert.deepEqual(codesForCountryPreset('atlantis'), []);
  assert.deepEqual(codesForCountryPreset(undefined), []);
});

test('country preset metadata carries its display label', () => {
  assert.equal(findCountryPreset('middle_east').label, 'Middle East 🕌');
  assert.equal(findCountryPreset('latin_america').id, 'latin_america');
  assert.equal(findCountryPreset('atlantis'), null);
});

test('filterCountriesByPreset narrows a country list but keeps the Any sentinel', () => {
  const allCountries = [
    { code: null, label: 'Any Country' },
    { code: 'BR', label: 'Brazil' },
    { code: 'US', label: 'United States' },
    { code: 'JP', label: 'Japan' },
  ];

  const filtered = filterCountriesByPreset(allCountries, 'latin_america');
  const codes = filtered.map((c) => c.code);
  assert.ok(codes.includes(null), 'Any Country sentinel is always retained');
  assert.ok(codes.includes('BR'));
  assert.ok(!codes.includes('JP'), 'Japan is not part of Latin America');

  // No active preset → full list passes through unchanged.
  assert.equal(filterCountriesByPreset(allCountries, null), allCountries);
});

// ─── Language presets → effective discover filters ─────────────────────────────

test('region language presets expand to their curated language codes', () => {
  const africa = codesForPreset('africa');
  assert.ok(africa.includes('zu'), 'Zulu is part of the Africa preset');
  assert.ok(africa.includes('xh'), 'Xhosa is part of the Africa preset');

  const europe = codesForPreset('europe');
  assert.ok(europe.includes('fr'));
  assert.ok(europe.includes('de'));
});

test('resolvePreset maps a region preset to languageCodes without excludeEnglish', () => {
  const resolved = resolvePreset('europe');
  assert.equal(resolved.excludeEnglish, false);
  assert.deepEqual(resolved.languageCodes, codesForPreset('europe'));
});

test('special presets resolve to the excludeEnglish toggle, not a code list', () => {
  assert.deepEqual(resolvePreset('exclude_english'), {
    languageCodes: [],
    excludeEnglish: true,
  });
  assert.deepEqual(resolvePreset('non_english_only'), {
    languageCodes: [],
    excludeEnglish: true,
  });
  assert.deepEqual(resolvePreset(null), { languageCodes: [], excludeEnglish: false });
});

test('the curated non-English fallback list never contains English', () => {
  assert.ok(!NON_ENGLISH_CODES.includes('en'));
  assert.ok(NON_ENGLISH_CODES.length > 20);
});

test('language presets link to their matching country preset', () => {
  assert.equal(LANGUAGE_TO_COUNTRY_PRESET.latin_america, 'latin_america');
  assert.equal(LANGUAGE_TO_COUNTRY_PRESET.middle_east, 'middle_east');
  assert.equal(findPreset('middle_east').label, 'Middle East 🕌');
});
