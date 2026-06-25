import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_LABELS,
  STREAMING_PROVIDER_BUCKETS,
  serviceKey,
  directStreamingServices,
  isServiceAvailableInRegion,
  availabilityFromResults,
} from '../src/lib/providerAvailability.js';

/**
 * Build a TMDB `watch/providers` `results` map. Each entry is keyed by ISO
 * country code and holds monetization buckets of `{ provider_name, logo_path }`.
 */
function providersByCountry(map) {
  const results = {};
  for (const [country, buckets] of Object.entries(map)) {
    results[country] = {};
    for (const [bucket, names] of Object.entries(buckets)) {
      results[country][bucket] = names.map((name) => ({
        provider_name: name,
        logo_path: `/${name.replace(/\s+/g, '_').toLowerCase()}.png`,
      }));
    }
  }
  return results;
}

// ─── Region locking ──────────────────────────────────────────────────────────

test('CBC Gem is surfaced only for Canada, never other regions', () => {
  const results = providersByCountry({
    CA: { flatrate: ['CBC Gem'] },
    US: { flatrate: ['CBC Gem'] },
    GB: { flatrate: ['CBC Gem'] },
  });

  const availability = availabilityFromResults(results);
  assert.deepEqual(availability.cbc_gem, ['CA']);
});

test('BBC iPlayer, Channel 4, and ITVX are surfaced only for the UK', () => {
  const results = providersByCountry({
    GB: { flatrate: ['BBC iPlayer', 'Channel 4', 'ITVX'] },
    US: { flatrate: ['BBC iPlayer', 'Channel 4', 'ITVX'] },
    CA: { free: ['BBC iPlayer'] },
  });

  const availability = availabilityFromResults(results);
  assert.deepEqual(availability.bbc_iplayer, ['GB']);
  assert.deepEqual(availability.channel_4, ['GB']);
  assert.deepEqual(availability.itvx, ['GB']);
});

test('Paramount Plus Essential is surfaced only for the US', () => {
  const results = providersByCountry({
    US: { flatrate: ['Paramount Plus Essential'] },
    CA: { flatrate: ['Paramount Plus Essential'] },
    GB: { flatrate: ['Paramount Plus Essential'] },
  });

  const availability = availabilityFromResults(results);
  assert.deepEqual(availability.paramount_plus, ['US']);
});

test('Paramount Plus Premium and channel bundles are not mapped to paramount_plus', () => {
  assert.equal(serviceKey('Paramount Plus Essential'), 'paramount_plus');
  assert.equal(serviceKey('Paramount Plus Premium'), null);
  assert.equal(serviceKey('Paramount+ Amazon Channel'), null);
  assert.equal(serviceKey('Paramount+ Roku Premium Channel'), null);
});

test('SBS On Demand and ABC iview are surfaced only for Australia', () => {
  const results = providersByCountry({
    AU: { free: ['SBS On Demand', 'ABC iview'] },
    US: { free: ['SBS On Demand', 'ABC iview'] },
    NZ: { free: ['SBS On Demand'] },
  });

  const availability = availabilityFromResults(results);
  assert.deepEqual(availability.sbs_on_demand, ['AU']);
  assert.deepEqual(availability.abc_iview, ['AU']);
});

test('region-unlocked services surface in every region they appear in', () => {
  const results = providersByCountry({
    US: { flatrate: ['Netflix'] },
    GB: { flatrate: ['Netflix'] },
    CA: { flatrate: ['Netflix'] },
    DE: { flatrate: ['Netflix'] },
  });

  const availability = availabilityFromResults(results);
  assert.deepEqual(availability.netflix, ['CA', 'DE', 'GB', 'US']);
});

test('isServiceAvailableInRegion gates locked services but allows global ones anywhere', () => {
  assert.equal(isServiceAvailableInRegion('cbc_gem', 'CA'), true);
  assert.equal(isServiceAvailableInRegion('cbc_gem', 'US'), false);
  assert.equal(isServiceAvailableInRegion('bbc_iplayer', 'GB'), true);
  assert.equal(isServiceAvailableInRegion('bbc_iplayer', 'FR'), false);
  // Global services have no region lock → available everywhere.
  assert.equal(isServiceAvailableInRegion('netflix', 'US'), true);
  assert.equal(isServiceAvailableInRegion('netflix', 'JP'), true);
});

// ─── Bucket collection (flatrate / free / ads, never rent / buy) ───────────────

test('providers are collected from flatrate, free, and ad-supported buckets', () => {
  assert.deepEqual(STREAMING_PROVIDER_BUCKETS, ['flatrate', 'free', 'ads']);

  const results = providersByCountry({
    US: { flatrate: ['Netflix'], free: ['Amazon Prime Video'], ads: ['Max'] },
  });

  const availability = availabilityFromResults(results);
  assert.deepEqual(availability.netflix, ['US']);
  assert.deepEqual(availability.amazon_prime_video, ['US']);
  assert.deepEqual(availability.max, ['US']);
});

test('rent and buy buckets are ignored for streaming availability', () => {
  const results = providersByCountry({
    US: { rent: ['Netflix'], buy: ['Amazon Prime Video'] },
  });

  const availability = availabilityFromResults(results);
  assert.deepEqual(availability.netflix, []);
  assert.deepEqual(availability.amazon_prime_video, []);
});

// ─── Provider name normalization / aliases ─────────────────────────────────────

test('serviceKey maps known aliases and rejects unknown providers', () => {
  assert.equal(serviceKey('Netflix'), 'netflix');
  assert.equal(serviceKey('Netflix basic with ads'), 'netflix');
  assert.equal(serviceKey('HBO Max'), 'max');
  assert.equal(serviceKey('Max'), 'max');
  assert.equal(serviceKey('Amazon Prime Video'), 'amazon_prime_video');
  assert.equal(serviceKey('Disney Plus'), null);
  assert.equal(serviceKey(''), null);
});

test('ad-supported Netflix tiers fold into the base Netflix service', () => {
  const results = providersByCountry({
    US: { flatrate: ['Netflix'], ads: ['Netflix Standard with Ads'] },
  });

  const availability = availabilityFromResults(results);
  // Same service key, same region → deduped to a single entry.
  assert.deepEqual(availability.netflix, ['US']);
});

// ─── Shape, dedupe, ordering ───────────────────────────────────────────────────

test('country codes are deduplicated and sorted per service', () => {
  const results = providersByCountry({
    US: { flatrate: ['Netflix'], free: ['Netflix'] },
    CA: { flatrate: ['Netflix'] },
    AU: { flatrate: ['Netflix'] },
  });

  const availability = availabilityFromResults(results);
  assert.deepEqual(availability.netflix, ['AU', 'CA', 'US']);
});

test('availabilityFromResults always returns every service key plus a logos map', () => {
  const availability = availabilityFromResults({});
  Object.keys(SERVICE_LABELS).forEach((key) => {
    assert.deepEqual(availability[key], [], `${key} should default to an empty country list`);
  });
  assert.ok(availability.logos, 'logos map should be present');
  Object.keys(SERVICE_LABELS).forEach((key) => {
    assert.equal(availability.logos[key], null, `${key} logo should default to null`);
  });
});

test('the first non-null logo path is captured per service', () => {
  const results = {
    US: { flatrate: [{ provider_name: 'Netflix', logo_path: null }] },
    CA: { flatrate: [{ provider_name: 'Netflix', logo_path: '/netflix.png' }] },
  };

  const availability = availabilityFromResults(results);
  assert.equal(availability.logos.netflix, '/netflix.png');
});

test('directStreamingServices returns matched service keys with their logos', () => {
  const matched = directStreamingServices({
    flatrate: [{ provider_name: 'Netflix', logo_path: '/n.png' }],
    free: [{ provider_name: 'Disney Plus', logo_path: '/d.png' }],
    rent: [{ provider_name: 'Max', logo_path: '/m.png' }],
  });

  assert.equal(matched.get('netflix'), '/n.png');
  assert.equal(matched.has('max'), false, 'rent bucket must be ignored');
  assert.equal(matched.has('disney'), false, 'unknown providers are dropped');
});
