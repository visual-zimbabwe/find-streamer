# Trova Quality Improvement Plan

**Goal:** Elevate Trova toward a Prime Video–grade Android experience — sleek, clean dark mode, poster-forward, minimal chrome — while preserving the Programme design identity (editorial luxury, gold accent, cinematic typography).

**North star:** Same data and behaviors; better spatial grammar, surface discipline, and motion restraint.

**Canonical references:** `.codex/skills/trova-programme-redesign/SKILL.md`, `HomeScreen.js`, `SearchPanel.js`, `MatchResults.js`, `ContentRail.js`, `BottomNav.js`, `src/theme/tokens.js`.

---

## Current state

| Area | Status |
|------|--------|
| Home | ✅ Programme shipped — featured spotlight, `ContentRail`, gold tabs |
| Search + Top Matches | ✅ Programme shipped |
| Discover | 🟡 Partial — gold tokens, section headers; still dense filter UI, spinners in places |
| Watchlist | 🟡 Partial — Programme headers/gold; layout not fully aligned with Home grid grammar |
| Settings | 🟡 Partial — specification sheet direction started |
| Detail (`ResultView`) | 🔴 Legacy — purple primary chrome, pre-Programme typography |
| Collections / Filmography | 🔴 Legacy patterns remain |
| Theme tokens | 🟡 Dark mode is `#000000` background but surface ladder still has 5+ shades competing with posters |

---

## Phase 1 — Dark mode & surface discipline

**Objective:** True cinematic black canvas; posters supply color. Match Prime Video Android’s “quiet UI, loud imagery.”

### 1.1 Token updates (`src/theme/tokens.js`)

| Token | Current | Target | Rationale |
|-------|---------|--------|-----------|
| `background` | `#000000` | `#000000` | Keep |
| `surface` | `#000000` | `#0B0B0B` | Slight lift for scroll areas only |
| `surfaceContainerLow` | `#0d0d0d` | `#0B0B0B` | Collapse near-black tiers |
| `surfaceContainer` | `#141414` | `#121212` | Cards/rails |
| `surfaceContainerHigh` | `#1c1c1e` | `#1A1A1A` | Poster placeholders |
| `surfaceContainerHighest` | `#242428` | `#222222` | Elevated chips only |
| `onSurfaceVariant` | `#aeaeb2` | `#8E8E93` | Softer secondary text |
| `glass` (dark) | `rgba(0,0,0,0.85)` | `rgba(12,12,14,0.94)` | Align with Programme Android glass |

Add shared Programme constants (extract from per-file duplicates):

```js
// src/theme/programme.js (new)
export const GOLD_ACCENT = '#D4A853';
export const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';
export const GRID_PAD = scale(22);
export const GRID_GAP = scale(14);
export const FADE_MS = 320;
```

### 1.2 Surface usage rules

- **Page background:** always `colors.background` — no mid-gray full-screen fills.
- **Cards/rails:** `surfaceContainerHigh` for poster frames only.
- **Headers/docks:** glass (`rgba(12,12,14,0.94)`) on Android; `BlurView` on iOS headers only.
- **Kill:** `colors.primary` purple for active chrome anywhere — gold accent only.
- **Atmosphere:** static top `LinearGradient` (Search/Home pattern); never live blurred backdrops under scroll.

### 1.3 Deliverables

- [ ] Update `tokens.js` dark palette
- [ ] Create `src/theme/programme.js` and migrate `GOLD_ACCENT` / grid constants from components
- [ ] Audit all screens for hard-coded surface colors outside tokens
- [ ] Visual pass on Android S24 Ultra emulator/device

---

## Phase 2 — Finish Programme screen rollout

**Objective:** No screen feels like “old Trova.” One spatial grammar end-to-end.

Follow the skill workflow: **Phase 1 audit (ASCII layout) → Phase 2 implement → verify.**

### 2.1 Detail — `ResultView.js` (highest impact)

**Concept:** Cinema dossier — backdrop hero, minimal chrome, refined provider matrix.

```
┌─────────────────────────────────────┐
│  parallax backdrop hero             │
│  gradient scrim (no full-screen blur)│
│  TITLE · year · rating eyebrow      │
│  synopsis · meta hairlines          │
│  ─── WHERE TO WATCH ───             │
│  provider rows (refined table)      │
│  ─── CAST / CREW ───                │
│  tappable links (gold underline)    │
└─────────────────────────────────────┘
```

- [ ] Replace purple badges/bookmarks with gold accent
- [ ] Align typography to Programme tokens (uppercase eyebrows, tracked labels)
- [ ] Keep parallax hero; disable under `AccessibilityInfo.isReduceMotionEnabled()`
- [ ] Use `DetailSkeleton` during load (already exists in `SkeletonLoaders.js`)

### 2.2 Discover — `DiscoverScreen.js`

**Concept:** Filter console — editorial results, quieter filter chrome.

- [ ] Collapse filter sections behind expandable “Advanced” blocks (reduce always-visible noise)
- [ ] Results: 2-col grid matching `ContentRail` / Home dimensions (`GRID_PAD`, `GRID_GAP`, `GRID_COL_W`)
- [ ] Replace `ActivityIndicator` with `ResultsSkeleton` for initial load
- [ ] Filter chips: uppercase, gold active state, hairline dividers between sections
- [ ] Preserve all filter logic, presets, modals, pagination

### 2.3 Watchlist — `WatchlistView.js`

**Concept:** Personal ledger — cinema stills, quiet swipe actions.

- [ ] Unify item cards to Home 2-col poster grid (or landscape stills for “Continue” if added later)
- [ ] Swipe actions: gold text/icons, no loud background fills
- [ ] Collection headers: icon + eyebrow + hairline (already started — finish alignment)
- [ ] Empty states via `EmptyState.js` with Programme copy

### 2.4 Settings — `SettingsView.js`

**Concept:** Specification sheet — grouped sections, hairlines, no playful toggles.

- [ ] Finish appearance picker (dark/light) with gold selection ring
- [ ] Group settings into labelled blocks with `ProgrammeSectionHeader`
- [ ] Attribution/links section at bottom — muted `onSurfaceVariant`

### 2.5 Collections & Filmography

| File | Direction |
|------|-----------|
| `CollectionsScreen.js` | Franchise index; `ContentRail` for catalogue rails |
| `FranchiseRailsView.js` | Already uses `ContentRail` — align section headers |
| `FilmographyScreen.js` | 2-col poster grid, gold role eyebrow, film/TV badge on cards |

### 2.6 Deliverables

- [ ] All six screen groups above redesigned
- [ ] No remaining `colors.primary` active states in user-facing chrome
- [ ] `tests/release-hardening.test.js` passes after each screen

---

## Phase 3 — Reduce chrome

**Objective:** More poster, less UI — Prime hides navigation while you browse.

### 3.1 Bottom nav auto-hide

Already wired via `useBottomNavScroll` / `BottomNavVisibilityContext`.

- [ ] Verify hide-on-scroll on Home, Search, Discover, Watchlist, Detail
- [ ] Tune threshold so nav hides after ~40px scroll down, reappears on scroll up
- [ ] `paddingBottom`: `insets.bottom + 112` on all scroll surfaces

### 3.2 Header simplification

- [ ] Immersive feeds: `HomeTopNav` `variant="programme"` only
- [ ] Tool screens: centered Trova wordmark OR eyebrow + title — never both
- [ ] Remove redundant borders; use `GOLD_DIM` hairlines between sections only

### 3.3 Section headers

Standardize on shared `ProgrammeSectionHeader` (extract to `src/components/ProgrammeSectionHeader.js`):

- Eyebrow: uppercase, gold, `letterSpacing: 1.2`
- Title: `typography.titleLg` or headline variant
- Optional subtitle: `onSurfaceVariant`

### 3.4 Deliverables

- [ ] Shared `ProgrammeSectionHeader` component
- [ ] Bottom nav scroll behavior verified on all main tabs
- [ ] Section header duplication removed from 5+ files

---

## Phase 4 — Imagery quality

**Objective:** Posters and backdrops carry the visual weight.

### 4.1 Hero vs poster rules

| Context | Asset priority |
|---------|----------------|
| Home featured / Search top match / Detail hero | `backdropUrl` → fallback `posterUrl` |
| Rails / grids / watchlist | `posterUrl` (16:9 landscape chips where designed) |
| Live search rows | Small poster thumb (explicit 36×52 — never `%` sizing) |

### 4.2 `MediaArtwork` policy

- Grids/lists/rails: `instant` + `cachePolicy="memory-disk"`
- Heroes: progressive load acceptable; show skeleton until ready
- Consistent aspect ratios: poster `2:3`, chip `16:9`, hero `~16:9` full-bleed

### 4.3 Loading states

Replace spinners with skeletons:

| Screen | Skeleton |
|--------|----------|
| Detail | `DetailSkeleton` ✅ exists |
| Discover results | `ResultsSkeleton` ✅ exists |
| Home feed | Add `HomeFeedSkeleton` (hero block + 2 rail rows) |
| Watchlist | Add `WatchlistSkeleton` (2-col grid shimmer) |
| Search Matches | Inline row skeletons (3 placeholder rows) |

### 4.4 Deliverables

- [ ] Spinner audit — replace with skeletons on all main flows
- [ ] `HomeFeedSkeleton` + `WatchlistSkeleton` added to `SkeletonLoaders.js`
- [ ] Hero backdrop preference enforced in spotlight/top-match/detail components

---

## Phase 5 — Motion & polish

**Objective:** Luxury = restraint. Prime feels fast because nothing bounces.

### 5.1 Motion rules

| Allowed | Forbidden |
|---------|-----------|
| Crossfades 280–360ms (`FADE_MS`) | Spring scale (1.04×, 1.18×) |
| Opacity transitions | MorphingText, dot pagers |
| Gold sliding tab indicator (`BottomNav`) | Bouncy `AnimatedCard` on lists |
| Haptics.selectionAsync on tabs/bookmarks | Heavy impact haptics on every tap |

- [ ] Honor `AccessibilityInfo.isReduceMotionEnabled()` — disable hero auto-rotation, parallax
- [ ] Home hero rotation: already gated — verify on Discover/Detail animations

### 5.2 Haptics consistency

Add `Haptics.selectionAsync()` to:

- [ ] Bottom nav tab changes (if not already)
- [ ] Discover filter chip toggles
- [ ] Watchlist swipe completion
- [ ] Settings appearance picker
- [ ] Bookmark toggle on Detail (match `MatchResults.js`)

### 5.3 Performance (Android baseline)

- [ ] No nested `FlatList` inside `ScrollView` — use `ScrollView` + `.map()` or single scroll surface
- [ ] No full-screen `BlurView` under scrolling content
- [ ] `removeClippedSubviews` on Android vertical scrolls
- [ ] Header scroll state: threshold-cross updates only (ref pattern from Home)

### 5.4 Deliverables

- [ ] Motion audit — remove remaining spring/bounce animations
- [ ] Reduce-motion support on all auto-advancing UI
- [ ] Scroll perf verified on Android S24 Ultra (no jank on Home + Discover)

---

## Phase 6 — Shared component extraction

Reduce duplication and drift across screens.

| Component | Source | Used by |
|-----------|--------|---------|
| `ProgrammeSectionHeader` | Extract from Search/Discover/Watchlist | All Programme screens |
| `ProgrammeHairline` | 1px `GOLD_DIM` divider | Section breaks |
| `GridPosterCard` | Already in `ContentRail.js` | Discover, Watchlist, Filmography |
| `programme.js` tokens | New file | All screens |

---

## Implementation order (recommended)

```
Week 1   Phase 1 (tokens) + Phase 3.3 (shared header) + Phase 4.3 (skeletons)
Week 2   Phase 2.1 Detail (ResultView) — highest user-visible impact
Week 3   Phase 2.2 Discover + Phase 2.3 Watchlist
Week 4   Phase 2.4 Settings + Phase 2.5 Collections/Filmography
Week 5   Phase 3 (chrome reduction) + Phase 5 (motion/haptics polish)
         Final Android pass + release-hardening tests
```

Adjust pacing as needed — one screen per PR keeps review manageable.

---

## Verification checklist

Before marking the initiative complete:

- [ ] Visually seamless with Home header + BottomNav marquee on every tab
- [ ] Dark mode: true black canvas, ≤3 visible surface tiers on any screen
- [ ] Gold accent for all active states; zero purple primary chrome
- [ ] No spinners on main content loads — skeletons only
- [ ] Bottom nav hides on scroll on all tab scroll surfaces
- [ ] `AccessibilityInfo.isReduceMotionEnabled()` disables motion-heavy features
- [ ] `node --test tests/release-hardening.test.js` passes
- [ ] Manual smoke test: Home → Search → Detail → Back → Watchlist → Discover → Settings
- [ ] APK build (when requested): `cd android && ./gradlew.bat assembleRelease`

---

## Out of scope (unless explicitly requested)

- New APIs or metadata fields (TMDB, Trakt, etc.)
- Light mode full redesign (dark mode is the priority)
- iOS-specific polish beyond existing BlurView header pattern
- Font loading (Manrope/Inter placeholders in tokens remain System for now)

---

## Prompt template (per screen)

```
Read TROVA_QUALITY_PLAN.md and .codex/skills/trova-programme-redesign/SKILL.md

Implement Phase 2.X for {{SCREEN}}.
- Same data and behaviors — no new APIs
- Apply Phase 1 token rules and Phase 5 motion rules
- Phase 1 audit: ASCII layout + ambiguities — wait for go before coding
```
