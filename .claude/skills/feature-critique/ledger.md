# Feature Critique — ledger

One row per critique run. Read this before picking a target (skip anything listed
here unless the user points at it on purpose); append to it at the end of every
run, including rejected critiques.

| Date | View | Feature | Compared to | Verdict | Decision | Outcome |
|------|------|---------|-------------|---------|----------|---------|
| 2026-07-23 | Results / ResultView | Bookmark → save to collections | Spotify add-to-playlist sheet | B− flow wearing an A-tier feature set | Adjusted — "user must pick a destination every time" | Shipped — PR #68 |
| 2026-07-23 | Results / ResultView | Where To Watch availability table | JustWatch title-detail "Where to watch" | C+ presentation wrapped around an A− dataset | Adjusted — global atlas is the point (don't localise it away); no deep links (users just want to know which country has it); free-to-watch only is deliberate, rent/buy stays excluded | All 8 shipped — PR #70, verified on release APK on the A54 |
| 2026-07-23 | Results / ResultView | Cast & Crew rail (grouping, See All overflow, long-press peek sheet) | IMDb title page "Top cast" + "Cast & crew" full page | A-tier cards on a rail with no information architecture — B for any single card, D for everything past card ten | Approved | All 8 shipped — PR #71, verified on release APK on the A54; user chose full-cast screen for #2 and left #5's affordance to me (persistent corner badge) |
| 2026-07-23 | Results / ResultView | Seasons rail (TV titles) — inert cards, no header, no season-scoped availability | Apple TV app series page (season selector + per-season provider attribution) | A-tier data pipeline feeding a rail of coasters — B+ for the fetch, D for the section | Approved | All 7 shipped — verified on release APK on the A54 (Squid Game 3-season, Chernobyl 1-season, Parasite movie regression). Core fix: `getCompleteTvProviderCountries` now folds the same episode fan-out twice (per-season, then across seasons) instead of intersecting season granularity away. Per-season availability needs `EXPO_PUBLIC_TMDB_TV_EPISODE_LOOKUP=true`; the sheet degrades to a fallback line when off |
