# Trova Programme Redesign — Chat Prompt

Copy into a new chat when redesigning a Trova screen:

---

Read `.codex/skills/trova-programme-redesign/SKILL.md` and the canonical references:

| Priority | File | Why |
|----------|------|-----|
| Home | `HomeScreen.js`, `ContentRail.js`, `HomeTopNav.js`, `BottomNav.js` | Programme north star — spotlight, horizontal rails, nav |
| **Shipped Search** | `SearchPanel.js`, `SearchStack.js` | Editorial search theatre, live Matches, ContentRail rails |
| **Shipped Top Matches** | `MatchResults.js` | Featured hero + Also Matched 2-col grid |
| Shared | `AppShell.js` | Surprise Roulette Programme modal |

**Screen to redesign:** [Discover | Watchlist | Settings | Collections | Detail | Filmography | other]

**Already shipped (do not redo unless asked):** Search, Top Matches (`MatchResults`), Surprise Roulette modal styling.

**Task:** Revolution — new layout for refined cinematic luxury streaming, seamless with Programme home **and Search**. Same data and behaviors as today; no new APIs unless I say so. Android S24 Ultra performance rules apply.

**Match shipped Search / Top Matches patterns where applicable:**

- Gold `#D4A853` accent, uppercase tracked eyebrows, hairline dividers
- `scale(22)` horizontal inset, `scale(14)` rail gap
- Horizontal poster rails via `ContentRail` (same card width as legacy 2-col grid)
- Theme-aware glass surfaces — no full-screen blur under scroll
- `Haptics.selectionAsync()` for toggles; no spring bounce cards
- Explicit thumbnail dimensions in flex rows (never unsized `100%` artwork)

**Phase 1 (now):** Summarize your understanding, list ambiguities (you decide as design lead), propose concept + ASCII layout. **No code.**

**Phase 2 (when I say go):** Implement, run `node --test tests/release-hardening.test.js`, rebuild release APK only if I ask (`cd android && ./gradlew.bat assembleRelease`).

---

## Quick prompts (copy-paste)

### Redesign a new screen

```
Read .codex/skills/trova-programme-redesign/SKILL.md and PROMPT.md

Redesign {{SCREEN}} for Trova using the Programme design system.
Follow shipped Search (SearchPanel, SearchStack) and Top Matches (MatchResults) patterns.
Rebuild release APK when done.
```

### Search + Top Matches (reference — completed in prior chat)

```
Read .codex/skills/trova-programme-redesign/SKILL.md

Redesign Search. rebuild release APK when done.
```

Shipped deliverables:

- **SearchPanel.js** — editorial search theatre, live Matches typeahead, ContentRail history
- **SearchStack.js** — atmosphere gradient, Programme Roulette dock, bottom-nav scroll
- **AppShell.js** — gold Surprise Roulette modal
- **MatchResults.js** — Top Matches featured hero + Also Matched grid
- **Fix:** live Matches rows require explicit poster dimensions (not `100%` in flex rows)
