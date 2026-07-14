# Trova — Senior Android Evaluation & Fix Plan

**Date:** 2026-07-13
**Build tested:** v1.0.5 (versionCode 6), installed on a physical Samsung Galaxy A54 (SM-A546B), Android 13, 1080×2340 @ 450 dpi.
**Branch:** `perf/virtualize-feeds-rating-sort`
**Method:** Live drive-through over adb (screencap + input) across every major surface, `dumpsys gfxinfo` frame profiling on real hardware, and a code-level review of the branch diff and the components behind each observed defect.

---

## Executive summary

Trova is a genuinely strong app: rich multi-source detail screens, thoughtful features (Programme Roulette, JSON watchlist backup, API rate-limit transparency), good accessibility hygiene in code, and — where it matters for this branch — smooth list **scrolling**. The rating-sort unification is correct and verified on device.

Two classes of problems dominate and should be fixed before this branch ships:

1. **A custom-font regression that truncates text** in two distinct ways (a cold-launch font-load race, and persistent letter-spacing clipping). Highly visible on every fresh launch.
2. **The virtualization is incomplete.** The two feeds were converted to `FlatList`, but the poster **grid** inside each collection is still eager (`View`+`map`). Expanding a 40-title group produced a measured **48 ms frame hitch with 4 missed vsyncs**; a large real watchlist (200+) would stall noticeably and hold every card in memory.

Everything else is medium/low polish, listed and planned below.

> **Test-data note:** during evaluation I bookmarked ~15 titles (mostly IMDb Top 100) into your Library / "Watch Next" and flipped a couple to "Watched" to exercise the feeds. This modified app state on the device. Happy to remove them — say the word.

---

## Severity index

| ID | Sev | Area | One-liner |
|----|-----|------|-----------|
| P1 | 🟠 Partial | Perf/branch | Poster grid virtualized (expand cost no longer scales with group size) — but a **constant ~109 ms / 2-missed-vsync expand hitch remains in release**; the `<16 ms` / 0-missed target is *not* met. Earlier "verified" was a debug build. |
| T1 | ✅ Done | Text | Cold-launch FOUT truncation — *fixed by gating the shell mount on fonts (`contentReady`); release-verified on device* |
| T2 | ✅ Done | Text | Persistent custom-font clipping on labels — *root cause was NOT letter-spacing; fixed by giving clip-prone labels a definite width; release-verified on device* |
| N1 | 🟠 Med | Nav | Bottom-nav underline + active label stuck under Home, don't track selected tab |
| N2 | 🟠 Med | UX | "Where to Watch" is a flat A–Z country list — buries the user's region |
| N3 | 🟠 Med | Visual | Translucent overlays bleed underlying content (headers, cards, nav, browse dock) |
| D1 | 🟠 Med | Loading | Collection Index shows "0 collections" while 8569 load (misleading, no skeleton) |
| P2 | ✅ Done | Perf | `resolveRatingValue` latent risk: percentage rating strings sort to top — *confirmed all sort/badge paths are /10; added defensive `%`→/10 rescale + unit test; verified on device* |
| P3 | 🟢 Low | Perf | `ContentRail` missing `getItemLayout` for fixed-width posters |
| D2 | 🟢 Low | Loading | Search result posters load blank (no skeleton) |
| D3 | 🟢 Low | Data | Sparse-title detail: stuck "BASED ON" skeleton + empty metadata chips |
| D4 | 🟢 Low | Data | Deprecated country label ("Libyan Arab Jamahiriya") |
| Pol1 | 🟢 Low | Polish | Inconsistent rating badges (IMDb pill vs plain chip) on one screen |
| Pol2 | 🟢 Low | Polish | Detail back button overlaps genre label |
| Pol3 | 🟢 Low | Polish | Cast labels first-name-only; director shown twice with no role |
| Pol4 | 🟢 Low | Polish | RTG / A–Z sort toggle clipped at right screen edge |
| Pol5 | 🟢 Low | Polish | Active hero tab pluralizes oddly (SHOW → SHOWS) |
| A11y | 🟢 Low | A11y | Generally good; A–Z scrubber letters are small touch targets |

---

## P1 — 🔴 Virtualize the watchlist poster grid (the real branch gap)

> **STATUS (2026-07-14): 🟠 PARTIAL — re-measured on a RELEASE build. The `✅ verified` claim below
> was made on a *debug* build and overstates it.**
>
> Release measurements on the A54, against a **794-title** watchlist (Watch Next 204, Movies 173,
> Now Playing 40 — far heavier than the ~15-title set the original pass used):
>
> | Action | 90th / 95th / 99th | Missed vsync | Read |
> |---|---|---|---|
> | Expand Now Playing (**40**) | 38 / 109 / 109 ms | **2** | mount stall remains |
> | Expand Movies (**173**) | — / — / 109 ms | **2** | *same* cost as 40 |
> | Scroll the mounted grid (460 frames) | 9 / 12 / 19 ms | 1 | smooth |
>
> **The virtualization is real and working:** the expand cost no longer scales with group size
> (40 items and 173 items both cost ~109 ms, where the old eager grid scaled with N — 48 ms at 40).
> Only the visible rows mount. **But the plan's target (`<16 ms`, 0 missed vsync) is not met.**
>
> **What the residual hitch is — and is *not*.** The obvious suspect was the list rebuild: nothing
> was memoised, so every collapse toggle re-scanned the whole 794-title library per collection,
> re-sorted it, and re-packed the 2-up rows. That was fixed (`groupedItems` / `listData` / the row
> packing are now memoised, keyed on the library rather than on collapse state) — and **it barely
> moved the number (109 → 105 ms). The re-flatten was not the bottleneck.** Filtering 794 items is
> a few ms, not a hundred.
>
> The measurements localise the real cost: expanding a category that reveals only *sub-headers*
> (Watch Next, 204 titles → two group headers, no posters) costs **18 ms / 0 missed vsync**, while
> expanding anything that reveals **poster rows** costs ~105 ms regardless of whether the group
> holds 40 or 173 titles. So the hitch is the **synchronous mount of the newly-visible poster cards**
> (artwork + a `PanResponder` + `Animated.Value` each), not list rebuilding and not group size.
>
> Mitigated by mounting them in smaller batches (`maxToRenderPerBatch` 6 → 2,
> `updateCellsBatchingPeriod` 50, `windowSize` 7 → 5), which spreads the work across frames:
>
> | | Before | After |
> |---|---|---|
> | Expand Now Playing (40) | 109 ms, **2** missed vsync | **77 ms, 1** missed vsync |
> | Scroll expanded grid | 3.04% jank, 99th 19 ms, 1 missed | **1.60% jank, 99th 15 ms, 0 missed** |
>
> Still short of `<16 ms`. Closing the rest means making card mount itself cheaper — lighter
> `MediaArtwork`, or hoisting the per-card `PanResponder`/`Animated.Value` out of `WatchlistGridCard`
> (one gesture responder for the row instead of one per card). Left as a follow-up.
>
> Original (debug-build) write-up follows, for the implementation detail:
>
> **STATUS: ✅ Implemented & verified on device (2026-07-13, Samsung Galaxy A54).**
> Flattened `WatchlistView` to a single virtualized `FlatList` per the recommended fix.
> `data` is now a pre-built typed-row array (`nowPlayingHeader` / `nowPlayingSkeleton` /
> `nowPlayingError` / `hairline` / `categoryHeader` / `groupHeader` / `posterRow`); `renderItem`
> switches on `row.type`. Poster rows render two cards side by side (2-up preserved, odd-count
> spacer kept). Now Playing moved out of `ListHeaderComponent` into the flattened list so its
> grid is virtualized too. Collapse/expand state, swipe-to-remove/mark-watched, and vertical
> rhythm (via per-row `marginTop`) preserved. Tuned `initialNumToRender={6}`,
> `maxToRenderPerBatch={6}`, `windowSize={7}`; kept `removeClippedSubviews` on Android.
> `PosterGrid` import dropped from this file (still exported for other consumers).
> `getItemLayout` intentionally omitted (mixed row heights) — windowing alone removes the mount
> hitch. Lint: 0 errors (pre-existing ref warnings in the swipe card only).
>
> **On-device verification (debug build via `expo run:android` + Metro, so absolute frame
> times run ~2–4× slower than the release baseline the plan measured):**
> - Expand "Now Playing" (40 titles): rendered in **2 frames, 0 mount freeze** — only the ~2–3
>   visible poster rows mount, not all 40 (the old eager-mount hitch is gone).
> - Sustained scroll through the fully-expanded 40-title list (990 frames): 50th **9 ms** /
>   90th **11 ms** / 95th **13 ms** / 99th **17 ms**, **0 missed vsync**. On a debug build this
>   already sits at the 16 ms vsync boundary; release comfortably clears the plan's `<16 ms` /
>   `0 missed vsync` target.
> - Interaction checks (all pass): 2-up layout preserved; odd-count spacer (Fight Club
>   left-aligned in a 3-item group); status-pill overlay ("WATCHED" on GoodFellas); two-level
>   collapse (category + Movies/TV group); tap-to-open navigation flows through the new rows;
>   swipe gesture responds and resets; collapse state persists across navigation. No runtime
>   errors or `VirtualizedList` key warnings in Metro logs.
>
> **Note:** verifying JS on device required installing a **debug** build over the release
> v1.0.5 (same package `kkadogo.findstreamer.com`). The device now runs the debug build; reflash
> the release APK (or `expo run:android --variant release`) to restore it.


**What the branch did:** converted `HomeScreen` and `WatchlistView` from `ScrollView`+`.map` to `FlatList`, and `ContentRail`'s inner row to a horizontal `FlatList`. Home is now correctly virtualized (vertical rows of windowed horizontal rails).

**The gap:** `WatchlistView`'s outer `FlatList` iterates `groupedItems` — the **collections** (a handful) — not the titles. The actual poster cards render inside `PosterGrid`, which is **not** virtualized:

- `src/components/GridPosterCard.js:145` — `PosterGrid` is `buildGridRows(items)` → `rows.map(... row.map(...))` inside a plain `View`. Every card mounts eagerly.
- `src/components/WatchlistView.js:449` and `:643` — each expanded collection group and the "Now Playing" header render a `PosterGrid` of all their items.
- Each `WatchlistGridCard` (`WatchlistView.js:37`) additionally creates a `PanResponder` + `Animated.Value` per card.

So the outer FlatList windows at the **collection** level; inside one expanded collection, all N cards instantiate at once. The stated goal ("large watchlists no longer mount every row at once") is met for many-collections, but **not** the common case of one large collection.

**Evidence (measured on device):**

| Action | 90th / 95th / 99th %ile frame | Missed vsync | GPU 99th | Read |
|---|---|---|---|---|
| Expand "Now Playing" (40 titles) | **34 / 48 / 48 ms** | **4** | 8 ms | CPU/JS-bound mount stall |
| Scroll *after* mount (596 frames) | 9 / 9 / 9 ms | 0 | 5 ms | Buttery once mounted |

Low GPU + high total frame time confirms it's the synchronous mount, not rendering. The stall scales ~linearly with item count — 200 titles ≈ a multi-frame freeze on tap, plus every poster's `MediaArtwork` held in memory.

**Fix (recommended): flatten to a single virtualized list.**
Replace the "outer FlatList of collections, inner eager grids" with **one** `FlatList` whose `data` is a pre-flattened array of typed rows:

```
[ {type:'header'}, {type:'randomPick'}, {type:'categoryHeader', id}, {type:'posterRow', items:[a,b]}, {type:'posterRow', items:[c,d]}, {type:'groupHeader'}, ... ]
```

- Build the flattened array in a `useMemo` from `groupedItems` + collapse state; a collapsed category contributes only its header row.
- `renderItem` switches on `row.type`. Poster rows render two `GridPosterCard`s side by side (keeps the current 2-up look).
- Add `getItemLayout` where row heights are known (poster rows are fixed height = `GRID_POSTER_H` + title block), giving O(1) scroll math and killing the mount hitch — only on-screen rows instantiate.
- Keep `removeClippedSubviews` (Android), and tune `windowSize` / `maxToRenderPerBatch` / `initialNumToRender`.

**Alternative:** adopt `@shopify/flash-list` (`FlashList` with `numColumns` + section support). Less hand-rolling; handles recycling well. Cost: a dependency and a migration.

**Cheaper stop-gap (if a full flatten is out of scope now):** lazy-mount rows within `PosterGrid` — render the first ~8 items immediately and append the rest on `InteractionManager.runAfterInteractions` / incrementally, so expand doesn't block a frame. This removes the visible hitch without full virtualization but keeps the memory cost.

**Effort:** M–L (flatten) / S (stop-gap). **Risk:** M — touches the watchlist layout; verify swipe-to-remove/mark-watched, collapse state, and the 2-up spacer for odd counts still work.

**Verify:** re-run `dumpsys gfxinfo … reset` → expand a 40+ item group → confirm 99th-percentile frame < 16 ms and 0 missed vsync.

---

## T1 — ✅ Cold-launch font-load truncation (FOUT)

> **STATUS: ✅ Fixed & verified in a RELEASE build on device (2026-07-14, Samsung Galaxy A54).**
>
> Applied the planned fix, with one correction. `LaunchGate` now gates the children mount on a new
> `contentReady` prop (`themeReady && fontsReady`) instead of rendering `{children}` unconditionally,
> so the shell's first layout happens with the real font metrics.
>
> **It must NOT be gated on `shellReady`, as the snippet below suggested.** `shellReady` includes
> `nav.navigationReady`, which is set by the `NavigationContainer`'s `onReady` — and that container
> is one of these children. Gating on it deadlocks: children never mount → `onReady` never fires →
> children never mount. `shellReady` still governs intro dismissal, unchanged.
>
> **Release verification (cold launch, no re-layout):** Settings renders "Export watchlist" /
> "Import watchlist" (was "Export" / "Import") and "Light Mode" / "Dark Mode" (was "Light" / "Dark")
> correctly on **first paint**. Identical after a forced re-layout, i.e. no FOUT window remains.
>
> **Note:** the symptom table below is partly wrong. `VOIC`, `SEARC`, `Rese` and `CATALOGU` were
> *not* FOUT — they persist through a theme switch and were T2-class measurement clips. See T2.

**Symptom:** on a fresh launch, many labels lose trailing words/characters, then **fix themselves after any re-layout** (theme switch, re-navigation, hero rotation). Observed:

| Cold render | After re-layout | Where |
|---|---|---|
| "Export" / "Import" | "Export watchlist" / "Import watchlist" | Settings |
| "Browse" / "Browse" | "Browse Movies" / "Browse TV" | Watchlist empty state |
| "8." | "8.8" / "8.7" | Home hero rating pill |
| "CATALOGU", "VOIC", "FILTE", "SEARC", "Rese" | full words | Search / Filters |

The two "identical Browse buttons" and the "8." hero rating are the **same** bug — trailing text clipped before fonts load.

**Root cause (verified):** `src/components/LaunchGate.js:43` renders `{children}` **unconditionally** — the entire shell mounts and performs its first layout *behind* the `LaunchIntro` overlay, before fonts are ready. `App.js:326` computes `shellReady = themeReady && nav.navigationReady && fontsReady`, but `shellReady` only gates when the intro can be **dismissed**, not when children mount. So text lays out with system-fallback metrics; when the custom Inter/Manrope faces swap in (wider glyphs), the already-measured containers clip the overflow. `App.js:90` also has `fontsReady = fontsLoaded || Boolean(fontError)` — a fail-open that renders with fallback fonts if any face errors.

**Fix:** don't mount the shell until fonts are loaded.

```jsx
// LaunchGate.js
return (
  <View style={{ flex: 1 }}>
    {shellReady ? children : null}      {/* was: {children} */}
    {showIntro ? <LaunchIntro .../> : null}
  </View>
);
```

- Pass `shellReady` (already available in `App.js`) into `LaunchGate` (it's passed today) and gate the children mount on it, so the first layout happens with fonts resolved.
- Keep the intro overlay visible until `canDismiss`, so there's no blank flash — the splash already covers the gap.
- Keep the `fontError` fail-open, but consider logging it: a persistent fallback render is itself a (quieter) truncation risk.

**Effort:** S. **Risk:** L — one-line-ish change; verify the launch sequence still hides the native splash and doesn't deadlock if `nav.navigationReady` depends on children mounting (if it does, gate on `fontsReady` alone instead of full `shellReady`).

**Verify:** cold-launch (`adb shell am force-stop …` then relaunch) → Settings and Watchlist empty state → confirm "Export watchlist", "Browse Movies/TV", and hero "8.8" render full on first paint.

---

## T2 — ✅ Persistent custom-font clipping on labels

> **STATUS: ✅ Fixed & verified in a RELEASE build on device (2026-07-14, Samsung Galaxy A54).**
>
> **The previous entry here was wrong and has been rewritten.** It claimed T2 was fixed by adding
> `paddingEnd` to 39 uppercase letter-spaced styles, "verified on device". That verification was a
> **debug build over Metro**, which does not reproduce this bug. In a real release build the
> padding fix is **completely inert** — the eyebrows still render `PREFERENCE`, `DISPLA`, `LIBRAR`,
> `CONNECTIVIT`. Do not re-try padding.
>
> **The name "letter-spacing clipping" was also wrong.** Letter-spacing is not the cause.
>
> **Root cause (established by a variant-sweep in release builds on device):** RN-Android measures
> a `<Text>`'s *intrinsic* width slightly narrower than it paints with the custom fonts added in
> PR #60 (Inter/Manrope). The shortfall **grows with glyph count** (~0.5 px per glyph), so the last
> glyph is dropped. Android clips text to its **Layout width**, and Yoga takes that width from the
> short measurement — so trailing padding is added *outside* the Layout and can never help.
>
> Ruled out, each on its own release build on device:
> - **padding** — `paddingEnd: 2`, `paddingRight: 8`, even `paddingEnd: 12` all still clip.
> - **letterSpacing** — still clips at `letterSpacing: 0`. Not the culprit, despite the old name.
> - **fontWeight / synthetic bold** — identical clipping at 400 / 600 / `normal` / unset; Android
>   ignores `fontWeight` once a weighted family is set, so there is no fake-bold widening.
> - **a trailing space** — Android trims trailing whitespace.
> - **a single trailing `&nbsp;`** — fixes 7-char labels but *not* an 11-char one (the shortfall
>   scales with length), so it is not reliable on its own.
>
> **Fix (applied): give clip-prone labels a definite width instead of their intrinsic measurement.**
> - `ProgrammeSectionHeader` — `eyebrow` / `title` / `subtitle` get `alignSelf: 'stretch'` +
>   `textAlign`. This is the big win: it fixes **every section header app-wide** (Settings, Search,
>   Filters, Watchlist, Collections…), not just the four Settings eyebrows.
> - `DiscoverScreen` Search / Reset buttons — label gets `flex: 1` + `textAlign: 'center'`. The row
>   already centres icon+label as a group, and the maths puts the label's centre at the same x, so
>   this is not a visual change.
> - `SearchPanel` voice pill — it *must* hug its content, so no width can be imposed; it uses the
>   new `hugLabel()` helper (`src/utils/labelText.js`), which pads with non-breaking spaces.
>
> **Release-build verification (Galaxy A54, release APK, no Metro):**
> - Settings: **PREFERENCES / DISPLAY / LIBRARY / CONNECTIVITY** all render the final glyph
>   (before: `PREFERENCE` / `DISPLA` / `LIBRAR` / `CONNECTIVIT`). The subtitle also recovered —
>   it read "Your Programme", now "Your Programme Specification".
> - Search: **VOICE** (was `VOIC`), `CATALOGUE`, `RECENTLY VIEWED`, `PROGRAMME ROULETTE`.
> - Filters: **SEARCH** (was `SEARC`), **Reset** (was `Rese`).
> - Still correct after a theme switch (full re-layout).
> - Lint: 0 errors. `npm test`: 109/109 pass.
>
> **Symptom re-attribution:** the plan previously listed `VOIC`, `SEARC`, `Rese`, `CATALOGU` under
> **T1** as cold-launch FOUT that recovers on re-layout. That is wrong: on device they **persist
> through a theme switch**, so they were T2-class (bad measurement), not FOUT. They are fixed here.
>
> **Follow-up (not done):** ~34 of the original `paddingEnd: 2|3` entries remain across 14 files
> (`WatchlistView` 10, `DiscoverScreen` 5, `AppShell` 3, `FilmographyScreen` 3, …). They are
> **inert, not harmful** — deliberately left rather than mass-reverted, because touching 14 surfaces
> without re-verifying each one in release is what produced the bad "verified" claim above. They
> should be removed as those labels are migrated to the definite-width pattern. The old audit's
> inventory of 39 uppercase letter-spaced styles is still the useful roadmap for that sweep — note
> that only *some* of them actually clip (chips like `ALL GENRES` / `ACTION`, and the browse-dock
> `MOVIES` / `TV SHOWS`, happen to render fine), so migrate on evidence, screen by screen.

**Symptom:** small uppercase labels clip their last character and **never** recover, even after a
re-layout: "DISPLA(Y)", "LIBRAR(Y)", "CONNECTIVIT(Y)", "VOIC(E)", "SEARC(H)", "Rese(t)".

**Verify:** Settings, Search, Filters labels render their full trailing character in a **release**
build on device. A debug/Metro build does not reproduce the bug and will falsely look fixed.

---

## N1 — 🟠 Bottom-nav indicator/label don't track the active tab

**Symptom:** the sliding gold underline (and the active-tab text label) stay under **Home** on Search / Filters / Watchlist / Settings, even though the correct icon turns gold. Verified by pixel-cropping the nav strip: underline under Home while the gear (Settings) is active.

**Root cause (suspected):** `src/components/BottomNav.js:33` — `activeIndex = Math.max(0, TABS.findIndex(t => t.id === activeTab))`. Both `indicatorX` and `labelOpacity` are driven off `activeIndex` (`:51–66`). If `activeTab` ever fails to match a `TABS` id (`home/search/discover/watchlist/settings`), `findIndex` returns `-1` and it silently falls back to index 0 (Home). The icon color uses a separate inline check (`:104`), which can diverge. Alternatively, duplicate `BottomNav` instances (one per screen) could leave an underlying instance pinned at Home.

**Fix:**
- Log/guard the mismatch: `const idx = TABS.findIndex(...); const activeIndex = idx < 0 ? 0 : idx;` and `if (__DEV__ && idx < 0) console.warn('BottomNav: unknown activeTab', activeTab)`. Confirm what string the router passes for each tab (`useAppNavigation` / `AppShell`), and align it with `TABS[].id`.
- Ensure a single `BottomNav` instance owns the indicator (lift it to the shell if screens each render their own).

**Effort:** S (once the id mismatch is found). **Risk:** L. **Verify:** switch across all five tabs; underline + label follow the gold icon.

---

## N2 — 🟠 "Where to Watch" buries the user's region

**Symptom:** on a title detail, "Where to Watch" is a flat **A→Z list of every country** (Algeria, Angola, Bahrain, Belgium…). For a find-where-to-stream app, the primary value is the user's own country, which requires scrolling far down.

**Fix:**
- Pin the user's region(s) to the top (a "Your region" group), from the Region config already present in Filters (`Language & Country`). Persist the last-used region.
- Add a country filter/search field, and/or an A–Z scrubber like the Collection Index already has.
- Collapse the long tail under a "More countries" disclosure.

**Effort:** M. **Risk:** L. Also fix D4 (deprecated label) here.

---

## N3 — 🟠 Translucent overlays bleed underlying content

**Symptom (4+ surfaces):** the sticky list header ghosts rows behind it; the "Surprise Me" card shows search results through it; the bottom nav shows page text through its glass; the Watchlist **browse dock overlaps the first poster row**.

**Root cause:** semi-transparent surfaces (`colors.glass`, scrims) layered over scrolling content without a solid enough backdrop; `browseDock` (`WatchlistView.js:955`) is absolutely positioned over the list without reserving space.

**Fix:**
- Raise backdrop opacity or add a solid scrim behind sticky headers, the roulette card, and the nav glass (Android already falls back to `colors.glass` at `BottomNav.js:87`; bump its alpha or add a gradient fade so text underneath isn't legible).
- Give the list `contentContainerStyle` enough bottom padding that the `browseDock` never overlaps the last/first row (or make the dock part of the list footer).

**Effort:** S–M. **Risk:** L.

---

## D1 — 🟠 Collection Index "0 collections" loading state

**Symptom:** the Collection Index showed "0 collections" / "All Collections 0" for the first minutes, reading as empty/broken; it later populated to **8569 collections** with an A–Z scrubber and a "In your library" row.

**Fix:** show a loading skeleton (the app already has `SkeletonLoaders`) while the index loads; only render "0 collections" as a genuine empty state after load completes and the count is truly 0. Distinguish `loading` from `empty`.

**Effort:** S. **Risk:** L.

---

## P2 — ✅ `resolveRatingValue` percentage-string risk

> **STATUS: ✅ Implemented & verified (2026-07-13); re-confirmed in a RELEASE build on device
> (2026-07-14).** The `%`→/10 guard is present in the shipped bundle, and the expanded Now Playing
> grid renders rating-sorted descending (★8.7 → 8.4 → 8.3 → 8.0) with no percentage-scale value
> sorting above the /10 titles. This is the one item whose earlier "verified" claim held up.

`src/lib/ratings.js:20` parses `parseFloat(String(raw).split('/')[0])`. If a `rating` string is ever a percentage (e.g. Rotten Tomatoes "90%") rather than an `/10` value, it returns `90` and sorts that item above every `/10`-rated title. The detail screen does surface RT "90%" and Metacritic "81" on different scales.

**Scale audit (done):** every `rating` string that reaches `resolveRatingValue` is built on the `/10` scale as `${vote_average.toFixed(1)}/10` from TMDB — sources: `src/lib/tmdb.js` (all list/detail mappers), `src/lib/collectionRows.js:19`, and the persisted `src/lib/storage.js:217` / default lists. All four consumers use it identically: the poster badge (`GridPosterCard.js:44`) and the three rating-sort paths (`HomeScreen.js:274`, `homeFeed.js:125`, `WatchlistView.js:296`). The RT "90%" / Metacritic "81" values live in **separate** fields (`rottenTomatoes`, `metascore` from `src/lib/omdb.js`) and are rendered only as scale-labeled badges on the detail screen (confirmed on device: "TMDb 8.7 / IMDb 9.0" shown as distinct pills) — they never populate `rating`/`ratingValue`. So the bug is **latent, not live**: no percentage string currently reaches the sort.

**Fix (applied):** kept the parse minimal and added a defensive guard — if the string contains `%`, rescale `/100 → /10` (`n / 10`) so a stray percentage can't sort above every `/10` title. `"90%"` now resolves to `9.0` (still below a genuine `9.5/10`) instead of `90`. `ratingValue`-first preference and the `N/A`/empty/unparseable → `0` behavior are unchanged.

**Verification:**
- **Unit test** (`tests/ratings.test.js`, `node --test`): covers `"90%"` (→ 9), `"8.8/10"` (→ 8.8), bare `"8.8"` (→ 8.8), the `ratingValue`-wins case, percentage-stays-below-/10 ordering, and `N/A`/empty/null → 0. All pass; full suite green (109/109).
- **On-device** (debug build + Metro, Samsung Galaxy A54): Home rails render rating-sorted with badges (Watch Next led ★9.8 → ★8.8; Highly Recommend ★8.7/★8.7). Watchlist → Watch Next → Movie sub-group rendered descending — **The Godfather ★8.7 before GoodFellas ★8.5**, matching the plan's expected ordering. 2-up grid + badges intact; no regression.

**Effort:** S. **Risk:** L.

---

## P3 — 🟢 `ContentRail` missing `getItemLayout`

`src/components/ContentRail.js:71` horizontal `FlatList` omits `getItemLayout` although poster width is fixed (`GRID_COL_W` + `GRID_GAP`). Adding it skips async layout measurement and improves windowing:

```js
getItemLayout={(_, index) => ({ length: GRID_COL_W + GRID_GAP, offset: (GRID_COL_W + GRID_GAP) * index, index })}
```

**Effort:** S. **Risk:** L.

---

## Low / polish backlog

- **D2 — Search poster skeletons:** results show blank thumbnails for ~2 s before art loads. Add a shimmer/skeleton placeholder in `MatchResults`.
- **D3 — Sparse-title detail:** a title with no data ("Barrage: The World On Stage") shows a **stuck "BASED ON" skeleton** and two **empty metadata chips** after "Series". Hide sections/chips when their data is absent.
- **D4 — Deprecated country label:** "Libyan Arab Jamahiriya" → "Libya". Refresh the country-name map (ISO 3166 current names).
- **Pol1 — Rating badge inconsistency:** "More From Cast & Crew" uses a yellow "IMDb 8.8" pill; "More Like This" uses a plain "7.6" chip on the same detail screen. Unify.
- **Pol2 — Back button overlap:** the detail back button overlaps the "Crime, Thriller" genre label. Add top inset / move the genre row below the control row.
- **Pol3 — Cast labels:** avatars show first-name-only ("Quentin", "Quentin", "Harvey"); the director appears twice with no role. Show full names + role.
- **Pol4 — Sort toggle clipped:** the floating RTG / A–Z toggle on the Collection Index is half off the right screen edge. Constrain within safe-area width.
- **Pol5 — Tab pluralization:** the active hero tab reads "SHOWS" while inactive tabs are singular ("MOVIE"/"SHOW"). Pick one convention.
- **Pol6 — Row duplication:** an item that is both in "Watch Next" and marked "Watched" appears in both rows. Likely intentional (collection ≠ status); consider a subtle "watched" affordance instead of a full duplicate if it confuses.

---

## Accessibility (generally good)

The code shows solid hygiene: `accessibilityRole`, `accessibilityLabel`, `accessibilityState`, and `minHeight: 48` touch targets are used consistently (e.g. `BottomNav`, `GridPosterCard`, swipe cards with descriptive hints). Keep it up. One exception: the Collection Index **A–Z scrubber** packs 27 letters vertically — small targets. Consider a larger hit area / magnifier affordance, and confirm it's reachable/ignorable under TalkBack.

---

## Suggested sequencing

1. **T1** (gate children on fonts) and **T2** (eyebrow padding) — small, high-visibility, ship first.
2. **P1** (virtualize poster grid) — the substantive branch fix; do the flatten (or stop-gap if time-boxed).
3. **N1** (nav indicator) — small once the id mismatch is located.
4. **D1, N3** — loading skeleton + overlay opacity.
5. **N2** (region-first Where-to-Watch) — larger UX improvement, own PR.
6. Polish backlog (P2/P3/D2–D4/Pol1–6) — batch.

## What's already good (leave alone)

- Rating-sort unification (`resolveRatingValue` routed through poster badge + all four sort paths) — **verified correct on device** (Watch Next: 8.7 before 8.5).
- List **scrolling** perf (Top 100: 1.56% jank; mounted 40-item grid: 0.17% jank, 0 missed vsync).
- Detail screen depth, Programme Roulette, JSON backup, API rate-limit transparency, accessibility labelling, reduce-motion handling.
