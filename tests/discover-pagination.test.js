import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPrefetchNextPage } from '../src/lib/discoverPagination.js';

const READY = {
  hasSearched: true,
  loading: false,
  loadingMore: false,
  loadMoreError: null,
  hasMore: true,
};

test('prefetch: fires when searched, idle, error-free, and more pages remain', () => {
  assert.equal(shouldPrefetchNextPage(READY), true);
});

test('prefetch: never fires before the first search (trending rail is one page)', () => {
  assert.equal(shouldPrefetchNextPage({ ...READY, hasSearched: false }), false);
});

test('prefetch: waits while a fresh search or refine is loading', () => {
  assert.equal(shouldPrefetchNextPage({ ...READY, loading: true }), false);
});

test('prefetch: does not stack a second page while one is in flight', () => {
  assert.equal(shouldPrefetchNextPage({ ...READY, loadingMore: true }), false);
});

test('prefetch: stops after a failed page so it cannot thrash the request (Rec #3)', () => {
  assert.equal(
    shouldPrefetchNextPage({ ...READY, loadMoreError: "Couldn't load more." }),
    false,
  );
});

test('prefetch: stops at the last page', () => {
  assert.equal(shouldPrefetchNextPage({ ...READY, hasMore: false }), false);
});

test('prefetch: a bare/empty call is safe and returns false', () => {
  assert.equal(shouldPrefetchNextPage(), false);
  assert.equal(shouldPrefetchNextPage({}), false);
});
