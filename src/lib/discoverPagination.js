// Discover pagination trigger — the predicate behind the FlatList `onEndReached`
// prefetch. Kept pure and separate from the component so the guard contract is
// unit-testable: `loadMore()` in the view-model already protects against
// double-fire and the page bound, but the auto-trigger needs the extra guards
// the manual "Load More" button used to provide implicitly.
//
//  - `hasSearched`  — pre-search / the trending rail is a single fixed page, so
//                     there is nothing to paginate; onEndReached is inert there.
//  - `loading`      — a fresh search (or a refine) is in flight; wait for it.
//  - `loadingMore`  — a page is already being fetched.
//  - `loadMoreError`— a page failed. Without this the auto-trigger would re-fire
//                     the failing request on every scroll frame (Rec #3); the
//                     user re-arms it deliberately via the inline "Tap to retry".
//  - `hasMore`      — there is another page to fetch.
export function shouldPrefetchNextPage({
  hasSearched,
  loading,
  loadingMore,
  loadMoreError,
  hasMore,
} = {}) {
  if (!hasSearched) return false;
  if (loading || loadingMore) return false;
  if (loadMoreError) return false;
  if (!hasMore) return false;
  return true;
}
