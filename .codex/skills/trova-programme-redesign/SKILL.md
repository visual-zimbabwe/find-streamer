---
name: trova-programme-redesign
description: >-
  Redesign Trova (FindStreamer) React Native screens to match the Programme
  home aesthetic — refined cinematic luxury streaming, revolutionary layouts,
  seamless with HomeScreen and BottomNav. Use when redesigning Trova screens,
  applying Programme design system, luxury streaming UI, or continuing the
  home-screen design rollout to Search (shipped), Top Matches (shipped), Discover,
  Watchlist, Settings, Detail, Collections, or other Trova components.
---

# Trova Programme Redesign

Redesign Trova screens the same way Home was rebuilt: **revolutionary layout**, **refined cinematic luxury streaming**, **no new data** unless the user explicitly asks to add content.

## North star

**Concept: "The Programme"** — Trova is a personal cinema programme, not a generic streaming app clone. Editorial, vertical, typographically confident. Imagery is atmosphere; structure carries luxury.

**One line:** *Same information and behaviors — new spatial grammar that feels intentional and expensive.*

## Canonical references (read before redesigning)

| File | Role |
|------|------|
| `src/components/HomeScreen.js` | Programme home: featured spotlight, 2-col grids, scroll perf; exports `ContentRail` |
| `src/components/HomeTopNav.js` | `variant="programme"`: centered Trova, gold underline tabs |
| `src/components/BottomNav.js` | Programme Marquee: full-width dock, sliding gold indicator |
| `src/components/SearchPanel.js` | **Shipped Search:** editorial search theatre, live Matches rows, `ContentRail` history grids |
| `src/components/MatchResults.js` | **Shipped Top Matches:** featured hero + “Also Matched” 2-col grid |
| `src/navigation/SearchStack.js` | **Shipped Search shell:** atmosphere gradient, bottom-nav scroll, Programme Roulette dock |
| `src/navigation/AppShell.js` | Surprise Roulette modal — gold Programme sheet (shared with Search) |

## Completed Programme rollouts (shipped)

Use these as the reference implementation when redesigning Discover, Watchlist, Settings, etc.

### Search (`SearchPanel.js`, `SearchStack.js`, `AppShell.js`)

**Layout IA**

```
┌─────────────────────────────────────┐
│         Trova (AppHeader)           │
├─────────────────────────────────────┤
│  atmosphere LinearGradient (top)    │
│                                     │
│     CATALOGUE / Find a Title        │  ← eyebrow + centred title
│  ┌─────────────────────────────┐    │
│  │  🔍  centred query input     │    │  ← glass surface, gold hairline
│  │  ─────────────────────────  │    │
│  │         VOICE               │    │
│  └─────────────────────────────┘    │
│  ┌ Matches ────────────────────┐    │  ← live typeahead (while typing)
│  │ poster │ Title · year    › │    │
│  └─────────────────────────────┘    │
│  ─── hairline ───                   │
│  RECENTLY VIEWED (ContentRail 2-col)│
│  TRENDING ON TRAKT (ContentRail)    │
│  NOW PLAYING (ContentRail)          │
│  ┌ Programme Roulette │ Surprise Me │  ← full-width dock (not rainbow FAB)
└─────────────────────────────────────┘
```

**Killed:** horizontal `FlatList` poster rails, purple search chrome, rainbow gradient Surprise FAB.

**Preserved:** voice search, live people/media typeahead, recent searches chips, recent viewed, Trakt/now-playing feeds, surprise genre picker modal, all navigation handlers.

**Key patterns:** `ProgrammeSectionHeader`, `LiveResultRow`, theme-aware glass `searchSurface`, gold `GOLD_ACCENT` / `GOLD_DIM`, import `ContentRail` from `HomeScreen` (no nested `FlatList` in `ScrollView`).

### Top Matches (`MatchResults.js`)

**Layout IA**

```
┌─────────────────────────────────────┐
│  ─── hairline ───                   │
│     RESULTS / TOP MATCHES           │
│     N TITLES FOUND                  │
│  ┌─────────────────────────────┐    │
│  │  cinematic backdrop hero     │    │  ← top result only
│  │  TOP MATCH eyebrow (gold)    │    │
│  │  title · synopsis · meta     │    │
│  │                    [bookmark]│    │
│  └─────────────────────────────┘    │
│  ─── hairline ───                   │
│  ALSO MATCHED                       │
│  ┌──────┐  ┌──────┐                 │  ← 2-col grid (Home grammar)
│  │poster│  │poster│                 │
│  └──────┘  └──────┘                 │
└─────────────────────────────────────┘
```

**Killed:** `AnimatedCard` spring bounce (0.96× / 1.04×), purple “TOP MATCH” badge, purple bookmarks, loose 46% grid.

**Preserved:** top match hero + remaining grid, watchlist toggle, tap → detail, `watchlistEntryKey`, accessibility labels, result order.

**Key patterns:** `TopMatchFeature` (LinearGradient scrims — no blur under scroll), `MatchGridCard` matching Home poster grid dimensions (`GRID_PAD`, `GRID_GAP`, `GRID_COL_W`), `Haptics.selectionAsync()` on bookmarks.

### Surprise Roulette modal (`AppShell.js`)

Gold eyebrow “Surprise Roulette”, uppercase genre chips, gold hairline dividers, favourites CTA with gold border — no emoji, no `colors.primary` purple chrome.

## Search implementation pitfalls

- **Live Matches thumbnails:** poster styles must use **explicit** `width` / `height` (e.g. 36×52). Never apply `width/height: '100%'` on artwork inside a flex row without a sized parent — artwork expands and covers title text (blank-looking rows).
- **Matches loading state:** show the Matches card with a spinner while `typeLoading && !results` so the section is not an empty box.
- **`release-hardening.test.js`:** keep `styles.posterImg`, `styles.liveAvatar`, `Recently Viewed`, `Trending on Trakt`, `Surprise Roulette`, `LinearGradient` in SearchStack, voice-search accessibility strings.

## Design tokens (mandatory)

| Token | Value | Usage |
|-------|-------|-------|
| Gold accent | `#D4A853` | Active states, underlines, indicators, eyebrows |
| Gold dim | `rgba(212, 168, 83, 0.42–0.55)` | Hairlines, rules, dividers |
| Rating gold | `#FFD580` / `#FFD700` | TMDB badges (existing) |
| Horizontal inset | `scale(22)` | Page padding; matches home grids |
| Grid gap | `scale(14)` | 2-column watchlist-style grids |
| Wordmark | Georgia / serif italic | "Trova" only — do not overuse |
| Section titles | Uppercase, `letterSpacing` 0.8–1.4, `fontWeight` 800 | Collection/rail headers |
| Tab labels | Uppercase, `scale(9–11)`, tracked | Filters, nav, chips |

### Surfaces (theme-aware)

- **Android glass:** `rgba(12, 12, 14, 0.94–0.97)` dark / `rgba(247, 247, 242, 0.94–0.97)` light
- **iOS:** `BlurView` allowed on headers/docks only — never full-screen blur behind scroll
- **Background atmosphere:** static top `LinearGradient` only — no live blurred backdrops under scroll

### Motion

- **Luxury = restraint:** crossfades 280–360ms, opacity transitions, sliding indicators
- **Never:** bouncy scale (1.18×), MorphingText, dot pagers, playful spring on lists
- **Honor** `AccessibilityInfo.isReduceMotionEnabled()` — disable auto-advance and parallax
- **Haptics:** `Haptics.selectionAsync()` for tabs/filters (not heavy impact)

## Revolution checklist (every screen)

Before coding, answer internally:

1. **What is the new layout IA?** (not just restyled widgets)
2. **What old pattern are we killing?** (floating pills, horizontal poster carousels, overlay nav on hero, purple-primary chrome, nested `FlatList` in `ScrollView`)
3. **What fields are on screen today?** — redesign may only resurface existing metadata (e.g. collection icons), not new APIs
4. **How does this screen relate to Home, Search, Discover, Watchlist?** — no redundant "second home"

## Layout patterns (reuse)

### Headers

| Context | Pattern |
|---------|---------|
| Immersive feed (Home) | `HomeTopNav` `variant="programme"` — centered wordmark + underline tabs, glass on scroll |
| Collections overlay | `HomeTopNav` `variant="overlay"` — keep for backdrop contexts |
| Standard tool screens | Centered Trova wordmark OR section eyebrow + title — match `AppHeader` centered mode |
| Detail / immersive | Minimal chrome; content leads |

### Content

| Pattern | When |
|---------|------|
| **Featured card** | Single hero item ~45–50% viewport; crossfade rotation (Home) or static hero (Search Top Match) |
| **Live editorial rows** | Search typeahead Matches — poster thumb + title/meta + gold chevron |
| **Landscape chips** | Secondary spotlight row (horizontal `ScrollView`, not `FlatList`) |
| **2-column poster grid** | Watchlist-style collections; sort unchanged |
| **Hairline section dividers** | Between collection blocks |
| **Eyebrow + title** | `SPOTLIGHT`, collection name with icon |

### Bottom chrome

- Always use redesigned `BottomNav` (Programme Marquee) — do not reintroduce floating capsule
- Scroll content `paddingBottom`: `insets.bottom + 112` unless measured otherwise

## Performance rules (Android S24 Ultra baseline)

- No full-screen `BlurView` under scrolling content
- No nested virtualized lists (`FlatList` inside `ScrollView`) — use `ScrollView` + `.map()` for small sets, or one primary scroll surface
- `removeClippedSubviews` on Android vertical scroll
- `MediaArtwork` with `instant` for grid/list thumbnails; `cachePolicy="memory-disk"`
- Header scroll state: update only on threshold cross (ref + `setState`), not every frame
- Solid glass on Android; blur only on iOS headers/docks

## Workflow per screen

### Phase 1 — Audit (no code)

1. Read the target screen component(s) and route wiring
2. List **fixed content inventory** (fields, actions, empty/loading copy)
3. List **behaviors to preserve** (navigation, filters, back handler, bottom nav scroll)
4. Propose **revolution concept** in 3–5 bullets + ASCII layout sketch
5. Note shared exports/tests that must stay stable (`ContentRail`, accessibility tests in `tests/release-hardening.test.js`)

### Phase 2 — Implement

1. Match tokens and patterns from canonical references
2. Minimize diff scope — one screen per pass unless user asks batch
3. Keep `accessibilityRole`, `accessibilityLabel`, 48px touch targets
4. Run `node --test tests/release-hardening.test.js`
5. Build APK only when user asks: `cd android && ./gradlew.bat assembleRelease`

## Screen-specific defaults (design lead decisions)

| Screen | Revolution direction |
|--------|---------------------|
| **Search** | ✅ **Shipped** — editorial search theatre, centred glass query, live Matches rows, `ContentRail` 2-col history, Programme Roulette dock; see [Completed rollouts](#completed-programme-rollouts-shipped) |
| **Top Matches** | ✅ **Shipped** — `MatchResults.js`: featured top-match hero + “Also Matched” 2-col grid; no spring cards; gold bookmarks |
| **Discover** | Filter console — uppercase filter chips, results as editorial cards not generic list rows; keep all filter logic |
| **Watchlist** | Personal ledger — 2-col grid or landscape cinema stills; collection headers with icons; swipe actions retained but visually quieter |
| **Settings** | Specification sheet — grouped sections with hairlines; no playful toggles |
| **Collections** | Franchise index — align `HomeTopNav` overlay → programme where possible; rails → grids or landscape editorial rows |
| **Detail (ResultView)** | Cinema dossier — parallax hero kept but typographically aligned; provider matrix as refined table |
| **Filmography** | Cast grid — 2-col or 3-col with same poster grammar |

## Leave behind (global anti-patterns)

- Paramount-style floating pills on imagery (unless Collections backdrop requires overlay nav)
- Horizontal hero pager + dot indicators
- Endless horizontal poster carousels as default
- Theme `colors.primary` purple for active chrome — use **gold accent**
- Generic glassmorphic floating capsules with heavy shadow
- MorphingText, excessive blur, nested carousel scroll
- `AnimatedCard` spring scale on result lists (removed from `MatchResults.js`)

## Prompt template for new chats

Paste and fill in `{{SCREEN}}`:

```
Read .codex/skills/trova-programme-redesign/SKILL.md

Redesign {{SCREEN}} for Trova using the Programme design system.
- Revolution: new layout, not a polish pass
- Refined cinematic luxury streaming, seamless with Home and Search
- Follow shipped patterns in SearchPanel.js, MatchResults.js, SearchStack.js
- Same data and behaviors as today — no new APIs or content
- Android S24 Ultra performance rules apply
- Phase 1: summarize understanding, list ambiguities (you decide), ASCII layout — no code
- Phase 2: implement only when I say go
```

See also `.codex/skills/trova-programme-redesign/PROMPT.md` for the full chat prompt.

## Verification

- [ ] Visually seamless with Home header + BottomNav marquee
- [ ] Gold accent active states, uppercase tracked labels
- [ ] No new user-facing data unless requested
- [ ] Scroll smooth on Android (no jank patterns)
- [ ] `release-hardening.test.js` passes
- [ ] APK path communicated if build requested
