import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_LABELS,
  SERVICE_DEFAULT_REGION,
  isRegionLockedService,
  isServiceAvailableInRegion,
  getProviderIdsForService,
} from '../src/lib/providerAvailability.js';
import { buildDiscoverQueryParams } from '../src/lib/smartFilters.js';

test('providerAvailability: service definitions and provider ID mappings', () => {
  // Exactly 10 streaming services
  assert.equal(Object.keys(SERVICE_LABELS).length, 10);
  assert.equal(SERVICE_LABELS.paramount_plus, 'Paramount+');
  assert.equal(SERVICE_LABELS.cbc_gem, 'CBC Gem');
  assert.equal(SERVICE_LABELS.bbc_iplayer, 'BBC iPlayer');
  assert.equal(SERVICE_LABELS.channel_4, 'Channel 4');
  assert.equal(SERVICE_LABELS.itvx, 'ITVX');
  assert.equal(SERVICE_LABELS.sbs_on_demand, 'SBS On Demand');
  assert.equal(SERVICE_LABELS.abc_iview, 'ABC iview');
  assert.equal(SERVICE_LABELS.netflix, 'Netflix');
  assert.equal(SERVICE_LABELS.amazon_prime_video, 'Prime Video');
  assert.equal(SERVICE_LABELS.max, 'Max');

  // Verify provider IDs exist for all 10 services
  for (const key of Object.keys(SERVICE_LABELS)) {
    const ids = getProviderIdsForService(key);
    assert.ok(Array.isArray(ids), `Provider IDs for ${key} must be an array`);
    assert.ok(ids.length > 0, `Provider IDs for ${key} must not be empty`);
  }

  // Check specific notable IDs
  assert.ok(getProviderIdsForService('netflix').includes(8));
  assert.ok(getProviderIdsForService('amazon_prime_video').includes(9));
  assert.ok(getProviderIdsForService('amazon_prime_video').includes(119));
  assert.ok(getProviderIdsForService('paramount_plus').includes(2303) || getProviderIdsForService('paramount_plus').includes(531));
});

test('providerAvailability: region-locking and automatic default region resolution', () => {
  // Paramount+ is locked to US only
  assert.equal(isRegionLockedService('paramount_plus'), true);
  assert.equal(isServiceAvailableInRegion('paramount_plus', 'US'), true);
  assert.equal(isServiceAvailableInRegion('paramount_plus', 'CA'), false);
  assert.equal(isServiceAvailableInRegion('paramount_plus', 'FR'), false);
  assert.deepEqual(SERVICE_DEFAULT_REGION.paramount_plus, { code: 'US', label: 'United States' });

  // CBC Gem is locked to CA only
  assert.equal(isRegionLockedService('cbc_gem'), true);
  assert.equal(isServiceAvailableInRegion('cbc_gem', 'CA'), true);
  assert.equal(isServiceAvailableInRegion('cbc_gem', 'US'), false);
  assert.deepEqual(SERVICE_DEFAULT_REGION.cbc_gem, { code: 'CA', label: 'Canada' });

  // BBC iPlayer, Channel 4, ITVX are locked to GB only
  assert.equal(isServiceAvailableInRegion('bbc_iplayer', 'GB'), true);
  assert.equal(isServiceAvailableInRegion('bbc_iplayer', 'US'), false);
  assert.equal(isServiceAvailableInRegion('channel_4', 'GB'), true);
  assert.equal(isServiceAvailableInRegion('channel_4', 'AU'), false);
  assert.equal(isServiceAvailableInRegion('itvx', 'GB'), true);
  assert.equal(isServiceAvailableInRegion('itvx', 'FR'), false);

  // SBS On Demand and ABC iview are locked to AU only
  assert.equal(isServiceAvailableInRegion('sbs_on_demand', 'AU'), true);
  assert.equal(isServiceAvailableInRegion('sbs_on_demand', 'US'), false);
  assert.equal(isServiceAvailableInRegion('abc_iview', 'AU'), true);
  assert.equal(isServiceAvailableInRegion('abc_iview', 'GB'), false);

  // Multi-region services (Netflix, Prime, Max) are available globally
  assert.equal(isRegionLockedService('netflix'), false);
  assert.equal(isServiceAvailableInRegion('netflix', 'US'), true);
  assert.equal(isServiceAvailableInRegion('netflix', 'FR'), true);
  assert.equal(isServiceAvailableInRegion('netflix', 'JP'), true);
  assert.equal(isServiceAvailableInRegion('amazon_prime_video', 'CA'), true);
  assert.equal(isServiceAvailableInRegion('max', 'US'), true);
});

test('smartFilters: buildDiscoverQueryParams includes monetization gating and providers', () => {
  // When no streaming filter is active: no provider params are attached
  const queryWithoutStreaming = buildDiscoverQueryParams({
    mediaType: 'movie',
    watchRegion: null,
    watchProviders: [],
  });
  assert.equal(queryWithoutStreaming.params.watch_region, undefined);
  assert.equal(queryWithoutStreaming.params.with_watch_providers, undefined);
  assert.equal(queryWithoutStreaming.params.with_watch_monetization_types, undefined);

  // When streaming filter is active: watch_region, with_watch_providers, and monetization gating are attached
  const queryWithStreaming = buildDiscoverQueryParams({
    mediaType: 'movie',
    watchRegion: 'US',
    watchProviders: [8, 1796],
  });
  assert.equal(queryWithStreaming.params.watch_region, 'US');
  assert.equal(queryWithStreaming.params.with_watch_providers, '8|1796');
  assert.equal(queryWithStreaming.params.with_watch_monetization_types, 'flatrate|free|ads');
});

test('smartFilters: buildDiscoverQueryParams handles Paramount+ US locked query', () => {
  const pplusIds = getProviderIdsForService('paramount_plus');
  const queryParamount = buildDiscoverQueryParams({
    mediaType: 'tv',
    watchRegion: 'US',
    watchProviders: pplusIds,
  });
  assert.equal(queryParamount.params.watch_region, 'US');
  assert.equal(queryParamount.params.with_watch_providers, pplusIds.join('|'));
  assert.equal(queryParamount.params.with_watch_monetization_types, 'flatrate|free|ads');
});
