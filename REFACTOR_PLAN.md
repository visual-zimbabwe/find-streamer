# Trova — Refactor Plan

> **Context:** Solo-developer, Android-only, local-only hobby app. No backend, ever. Built locally with **Android Gradle** (bare/prebuild workflow) — **not** EAS. Repo is **private**.
>
> **Guiding principle:** _Cleaner codebase **and** don't break what works._ Every phase is incremental, low-risk, independently committable, and gated by `npm test` (Node's built-in test runner). Behavioral tests are written **before** the code they protect is touched, so behavior is locked down as we go.
>
> **Hard rule:** No phase may proceed until `npm test` is green. Each phase is a logical commit boundary.

---

## Goals (locked)

1. Decompose the ~1,200-line `App.js` god component using **plain React** (domain Context providers + custom hooks — no new dependencies).
2. Add lightweight type safety via **JSDoc `@typedef` + per-file `// @ts-check`** on the core data models (Option B — stay in `.js`, no file renames).
3. Add **ESLint + Prettier** — lenient, warnings-only (`eslint-config-expo`).
4. Fix **`.gitignore`** and stop tracking build artifacts.
5. Add the missing **TMDB + JustWatch attribution** block (the one real compliance gap).
6. **Rebalance tests** — replace the source-string "release-hardening" assertions with **behavioral** equivalents.
7. **Delete `eas.json`** and **strip EAS** from the README.
8. **Fully reconcile the README** with reality (Gradle build, no iOS, correct file tree).

### Explicitly out of scope

Backend/proxy, accounts/sync, multi-user, monetization, iOS, CI/CD, full TypeScript migration, key rotation (private repo → non-issue).

---

## Phase 0 — Tooling & hygiene (zero behavior change)

**Goal:** Establish guardrails before touching any logic.

**Steps**

1. Add `eslint`, `prettier`, `eslint-config-expo`, `eslint-config-prettier` as dev dependencies.
2. Add `.eslintrc.js` extending `expo` + `prettier`, **all rules at `warn`** severity. Add `.prettierrc`.
3. Add npm scripts: `"lint": "eslint . --ext .js,.jsx"`, `"format": "prettier --write ."`.
4. Fix `.gitignore` to exclude build output, and untrack what's already committed:
   - `android/build/`, `android/app/build/`, `android/.gradle/`, `android/app/.cxx/`
   - `.expo-export-check/`, `.expo/`, `dist/`, `web-build/`
   - `git rm -r --cached` the above (files stay on disk, leave the index).
5. Run `npm run format` once to normalize whitespace **in a standalone commit** (so formatting noise never mixes with logic diffs in later phases).

**Files:** `package.json`, `.eslintrc.js`, `.prettierrc`, `.gitignore` (new/updated).
**Risk:** Very low (no runtime code changes).
**Verify:** `npm test` green; `npm run lint` runs (warnings OK).

---

## Phase 1 — Extract pure logic out of `App.js` into testable units

**Goal:** Pull the decision logic currently trapped inside `App.js` closures into pure, importable functions in `src/lib/`, and **write behavioral tests against them**. This is where behavior gets locked before decomposition.

**Targets in `App.js`:**

- `mergeResolvedSynopsisIntoWatchlistRow` (already near-pure) → move to `src/lib/watchlistModel.js` (or new `watchlistActions.js`).
- Watchlist mutation logic embedded in `openWatchlistSheet` / `handleToggleWatchlist` / `handleMarkWatched`:
  - create-collection → updates item's `collectionIds` + un-drops status
  - toggle-collection (special-casing `watched`)
  - set-status (special-casing `watched` collection membership)
  - toggle/restore library membership
  - remove item
    Extract these into **pure reducers** in `src/lib/watchlistActions.js`, e.g.:
  - `applyCreateCollection(item, collection)`
  - `applyToggleCollection(item, collectionId)`
  - `applySetStatus(item, status)`
  - `addOrRestoreItem(watchlist, result)` / `removeItem(watchlist, key)`

**New tests:** `tests/watchlist-actions.test.js` — covers each reducer's edge cases (watched↔collection sync, dropped→saved un-drop, dedup by `watchlistEntryKey`, no-op detection).

**Files:** `src/lib/watchlistActions.js` (new), `src/lib/watchlistModel.js`, `App.js` (call the new pure fns), `tests/watchlist-actions.test.js` (new).
**Risk:** Low — logic is moved, not changed; tests assert equivalence.
**Verify:** `npm test` green (new + existing).

---

## Phase 2 — Domain hooks (move state + handlers out of `App.js`)

**Goal:** Relocate `App.js`'s ~30 `useState` slices and handlers into focused custom hooks, **while keeping the `appState` object shape identical** so `AppStateContext` and every consumer screen remain untouched. This is the big maintainability win at near-zero blast radius.

**Proposed hooks (in `src/hooks/`):**
| Hook | Owns (state) | Owns (handlers) |
|---|---|---|
| `useToast` | — | `showToast` |
| `useRequestError` | `error`, `errorInfo`, `offlineBanner` | `handleRequestError` |
| `useSearchController` | `query`, `results`, `filter`, `typeResults`, `typeLoading`, `loading`, `recentSearches` | `handleQueryChange`, `handleSearch`, `handleTypeSelect`, `handleSelectMatch`, `clearSearchResults`, `clearTypeResults`, `rememberSearch` |
| `useDetailController` | `selectedResult`, `recentViewed` | `openDetail`, `rememberViewed` |
| `useWatchlistController` | `watchlist`, `watchlistCollections` (+ derived `userWatchlistCollections`, `savedWatchlistKeys`, `hasHighlyRecommendedSeeds`) | `handleToggleWatchlist`, `handleMarkWatched`, `handleRemoveWatchlistItem`, `handleEnrichWatchlistItem`, `openWatchlistSheet`, `persistWatchlistChange`, `persistCollectionsChange`, `syncWatchlistFromResolvedDetail` |
| `usePeopleController` | `filmographyPerson`, `filmographyResults`, `filmographyLoading` | `handlePersonPress`, `handleCompanyPress`, `handleSelectFilmographyItem`, `openFilmography` |
| `useSurpriseController` | `surpriseLoading`, `surprisePickerVisible` | `handleSurpriseMe`, `handleSurpriseByGenre` |
| `useAppNavigation` | `homeMediaFilter`, `collectionsSubView`, `collectionsImdbTab` | `goBack`, hardware `BackHandler` effect, `handleTabPress`, `openCollections`, `openHomeFromCollections`, `onNavigationReady` |

**Notes**

- Replace the manual `watchlistRef` / `watchlistCollectionsRef` mirroring with the reducer pattern from Phase 1 (functional `setState` updates), eliminating the stale-closure footgun.
- `discoverVm` already follows this pattern (`useDiscoverViewModel`) — use it as the template.
- `MobileApp` shrinks to: call hooks → assemble the **same** `appState` object → render. No consumer changes this phase.

**Files:** `src/hooks/*` (new), `App.js` (slimmed to composition).
**Risk:** Medium (most code moves) — mitigated because the context shape is unchanged and Phase 1 tests + existing tests assert behavior.
**Verify:** `npm test` green after **each** hook is extracted (extract one at a time, commit per hook).

---

## Phase 3 — Split `AppStateContext` into domain contexts (optional, after Phase 2 is stable)

**Goal:** Reduce re-render cascades by giving each domain its own provider, so e.g. a watchlist edit no longer re-renders search/discover consumers.

**Steps**

1. Create `SearchProvider`, `WatchlistProvider`, `PeopleProvider`, `DetailProvider`, `NavProvider` wrapping the Phase 2 hooks.
2. Migrate consumer screens **one at a time** (`useAppState()` → the specific `useWatchlist()` etc.), running `npm test` + a manual smoke check between each.
3. Remove the monolithic `AppStateContext` only once the last consumer is migrated.

**Risk:** Medium — touches screen files. Strictly incremental, one screen per commit.
**Verify:** `npm test` green per migrated screen.
**Gate:** Only start this phase if Phase 2 has been stable. If appetite is low, Phase 2 already delivers most of the maintainability benefit — Phase 3 can be deferred indefinitely.

---

## Phase 4 — Lightweight typing (Option B: JSDoc + `// @ts-check`)

**Goal:** Catch data-shape bugs in the objects that flow through many transforms, without renaming files or adding build steps.

**Steps**

1. Create `src/lib/types.js` (or co-locate in `watchlistModel.js`) with `@typedef` blocks for the high-value shapes:
   - `WatchlistItem`, `WatchlistCollection`
   - `SearchResult` / resolved detail result
   - `ProviderAvailability` (the per-service country map)
2. Add `// @ts-check` to the top of the **core lib files only** (`watchlistModel.js`, `watchlistActions.js`, `storage.js`, and the new hooks as they stabilize). Per-file opt-in keeps it lenient — no global `checkJs` flag, so the rest of the app is unaffected.
3. Annotate function params/returns with `@param`/`@returns` referencing the typedefs.
4. Fix only the genuine shape mismatches surfaced; suppress noisy false positives with targeted `// @ts-ignore` + comment rather than chasing perfection.

**Files:** `src/lib/types.js` (new), targeted `// @ts-check` additions.
**Risk:** Low — editor/type-check only; no runtime change.
**Verify:** `npm test` green; no new runtime behavior.

---

## Phase 5 — Attribution & compliance fix

**Goal:** Close the one real ToS gap (TMDB requires attribution even for non-commercial use; watch-provider data is JustWatch-sourced).

**Steps**

1. Add an **About / Credits** section to `SettingsView.js` containing:
   - The TMDB logo (approved asset) — must be less prominent than Trova's own branding.
   - Notice: _"This product uses the TMDB API but is not endorsed or certified by TMDB."_
   - JustWatch credit for streaming-availability data.
   - (Optional) Trakt + OMDb credits for completeness.
2. Confirm `expo-image` caches remote artwork (Trakt's image policy forbids hotlinking) — it does by default; just verify no raw `<Image>` hotlinks bypass it for Trakt-sourced art.

**Files:** `src/components/SettingsView.js`, an added TMDB logo asset.
**Risk:** Low (additive UI).
**Verify:** `npm test` green; manual check that the credits render.

---

## Phase 6 — Test rebalance (replace source-string assertions with behavioral tests)

**Goal:** Replace `tests/release-hardening.test.js` — which asserts exact source substrings (brittle, breaks on harmless refactors) — with tests that assert **behavior**.

**Mapping (representative):**
| Old source-string assertion | New behavioral test |
|---|---|
| regex that `tmdb.js` contains `cbc_gem: new Set(['CA'])` etc. | Import `availabilityFromResults`; feed fixtures; assert CBC Gem appears **only** for `CA`, BBC iPlayer/Channel 4/ITVX only for `GB`, SBS/ABC only for `AU`. |
| regex that providers come from `['flatrate','free','ads']` | Fixture with a provider in the `free`/`ads` bucket → assert it's surfaced. |
| regex that TV episode lookup is env-gated | Assert default (`confidence === 'show'`) without the env flag set. |
| regex for accessibility roles/labels in components | Keep a **trimmed** static guard for a11y presence (a legitimate lint-style check), or move to an a11y test if feasible. |
| regex for `usesCleartextTraffic === false` in `app.json` | Keep as-is — this is a genuine config assertion, not a source-string smell. |
| regexes asserting feature wiring (surprise, collections, presets, live search) | Convert to behavioral tests on the underlying lib functions (`fetchSurpriseRecommendation` filter ≥7, preset→code mapping, collection sort order) where a pure function exists; drop pure-wiring greps with no behavioral surface. |

**Steps**

1. Add the new behavioral tests first (they should pass against current code).
2. Delete the now-redundant source-string assertions from `release-hardening.test.js`; keep the few genuine config assertions (e.g. cleartext traffic).
3. Rename the file to `tests/availability.test.js` / split by concern if cleaner.

**Files:** `tests/release-hardening.test.js` (gutted/renamed), new `tests/*.test.js`.
**Risk:** Low — test-only.
**Verify:** `npm test` green with the new suite; brittle greps gone.

> **Sequencing note:** The provider/availability behavioral tests from this phase are valuable as a safety net for _all_ earlier phases. If `tmdb.js` is touched during Phases 1–2, pull those specific behavioral tests forward into Phase 1.

---

## Phase 7 — Docs & build cleanup

**Goal:** Make the repo's docs match reality and remove EAS dead weight.

**Steps**

1. **Delete `eas.json`.**
2. **README — strip EAS** entirely; rewrite the Build & Release section around the **local Gradle** workflow (`npx expo prebuild` if applicable, `./gradlew assembleRelease` / `assembleDebug`, where the APK lands).
3. **README — remove iOS claims** (out of scope; `app.json` is Android-only).
4. **README — fix the project-structure tree** to match the actual `src/` (it lists files/paths that don't match, e.g. `utils/responsive.js`, several contexts/components that have since moved or been added).
5. **README — add the attribution note** (TMDB/JustWatch) and drop the "fallback token compiled into source" framing.
6. Update `PROGRESS.md` with a session entry summarizing the refactor.
7. (Optional) Trim unused Android permissions in `app.json` (`READ/WRITE_EXTERNAL_STORAGE`) if backup still works via SAF — verify on device first; defer if uncertain.

**Files:** `eas.json` (deleted), `README.md`, `PROGRESS.md`, optionally `app.json`.
**Risk:** Low (docs/config). Permission trim is the only item needing a device check — keep it optional/last.
**Verify:** `npm test` green; a local Gradle build still succeeds.

---

## Suggested execution order & checkpoints

```
Phase 0  → commit (tooling + gitignore + format)
Phase 1  → commit (pure logic + watchlist-actions tests)
Phase 6* → pull provider/availability behavioral tests forward if tmdb.js will be touched
Phase 2  → commit-per-hook (one hook extracted at a time)
Phase 4  → commit (JSDoc typedefs + @ts-check on stabilized libs)
Phase 5  → commit (attribution block)
Phase 6  → commit (finish test rebalance, delete brittle greps)
Phase 3  → optional, commit-per-screen (defer if appetite is low)
Phase 7  → commit (docs + eas.json removal)
```

**Every checkpoint:** `npm test` must be green before moving on. Phases 2 and 3 are intentionally split into per-unit commits so any regression is trivially bisectable and revertible — the core of "don't break what works."

---

## Risk summary

| Phase           | Risk     | Why it's contained                        |
| --------------- | -------- | ----------------------------------------- |
| 0 Tooling       | Very low | No runtime code                           |
| 1 Pure logic    | Low      | Move-not-change + tests                   |
| 2 Hooks         | Medium   | Context shape unchanged; per-hook commits |
| 3 Context split | Medium   | Per-screen; optional/deferrable           |
| 4 Typing        | Low      | Editor-only, per-file opt-in              |
| 5 Attribution   | Low      | Additive UI                               |
| 6 Tests         | Low      | Test-only                                 |
| 7 Docs/build    | Low      | Docs/config; permission trim optional     |
