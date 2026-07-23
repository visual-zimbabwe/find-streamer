---
name: feature-critique
description: >-
  Runs a brutal, best-in-class UX critique of ONE Trova feature at a time, then
  stops at recommendations. Use whenever the user wants to evaluate, critique,
  review, "roast", teardown, or benchmark a Trova view/screen or a specific
  feature against a world-class app — including vague asks like "let's look at
  the next view", "pick something and tear it apart", "how does our search
  compare", "brutal review of the watchlist", or just "/feature-critique". When
  the user does not name a view, feature, or comparison app, this skill picks
  them itself (weakness-first) using a ledger of past critiques so it never
  repeats work. It never implements changes without a separate explicit go.
---

# Feature Critique

A repeatable teardown of Trova, one feature at a time, benchmarked against the
app that does that feature best. It ends at a prioritized set of recommendations
the user can approve, adjust, or reject — it does **not** implement anything
unless the user separately says go.

This encodes a method the user and I ran by hand once (the Results-view bookmark
vs. Spotify's add-to-playlist flow). The value is in keeping the *quality* of
that critique consistent: grounded in the real code, honest about wins as well
as losses, and never repeating a feature that's already been covered.

## Operating rules

- **One feature per run.** Depth beats breadth. Don't sprawl across a whole view.
- **Ground every claim in code.** Read the actual component and its handlers and
  cite `file:line`. A critique built from memory or vibes is worthless — the
  credibility comes from "here's what the code literally does on line N".
- **Pick the reference app yourself** (unless the user names one). Choose the
  single best-in-class analog for *this* feature and justify the analogy.
- **Stop at recommendations.** Producing recommendations is the finish line.
  Implementation, tests, release builds, and PRs happen only when the user later
  says go — treat that as a separate task, not part of this skill.
- **Never repeat a covered feature** unless the user points at it on purpose.
  The ledger is the source of truth for what's been done.

## The ledger — read first, write last

`ledger.md` sits next to this file. It's a Markdown table of every critique run.
**Read it at the start of every run** to know what's already covered, and
**append to it at the end** of every run (including rejected critiques, so they're
remembered without being blindly re-run).

Columns: `Date | View | Feature | Compared to | Verdict | Decision | Outcome`.

- `Verdict` — the one-line graded take (e.g. "B− flow, A-tier feature set").
- `Decision` — how the user responded at the gate: Approved / Adjusted (+note) / Rejected / Pending.
- `Outcome` — where it went afterward: "Recommendations delivered", "Shipped — PR #NN", "Not pursued", etc. Start it as "Recommendations delivered" since the skill stops there; the user updates it later if they implement.

## Step 1 — Pick the target (weakness-first)

If the user named a view and/or feature, use those and skip the picking logic for
whatever they specified.

Otherwise choose it yourself, biased toward **likely weakness** — go where the
problems probably are, not the easy wins:

1. Read `ledger.md`; exclude everything already listed.
2. Enumerate candidate views live from the codebase so the inventory never goes
   stale. Trova's screens live in `src/components/*Screen.js` and `src/components/*View.js`,
   wired up in `src/navigation/*Stack.js`. Skim these to build the current map of
   views and their notable features (buttons, sheets, toggles, inputs, lists,
   empty states, transitions).
3. Rank remaining features by *risk of being sub-par*: things that are
   custom-built where a platform pattern exists, interactions that are one-off or
   inconsistent with siblings, dense/complex controls, destructive actions, empty
   or error states, anything the user has grumbled about before. Prefer the
   highest-risk untouched feature.
4. State the pick in one line with the reason and an explicit override note, e.g.:
   > Picking **Discover → filter chips** (auto-selected, weakness-first: custom
   > multi-select with no obvious "clear all" and it competes with a platform
   > pattern). Say the word to point me somewhere else.

Don't over-deliberate here — name it and move on. The user can redirect in one reply.

## Step 2 — Trace how it actually works

Before judging it, understand it. Read the component and follow the feature end to
end: the control, its handler, the state it mutates, any sheet/modal it opens,
where persistence happens. Write a short, plain "here's what happens when the user
does X" walkthrough with `file:line` references for the load-bearing parts.

This is not filler — it's what separates a credible teardown from armchair
opinion, and it frequently surfaces the real problem (e.g. a "toggle" that never
toggles off, a save that pre-commits before the user chooses).

## Step 3 — Choose the best-in-class reference

Pick the one app that does this feature *best*, matched to the feature's real job —
not a generic "famous app". Some starting analogies (use judgment, these aren't
rules):

- Save / bookmark / add-to-collection → Spotify add-to-playlist, Pinterest
  save-to-board, Letterboxd.
- Search / autocomplete → Google, Spotify search, Arc.
- Media detail / hero → Netflix, Letterboxd, IMDb, Apple TV.
- Filters / faceted browse → Airbnb, Zillow, Booking.
- Lists / library management → Notion, Things, Goodreads.
- Onboarding / empty states → Duolingo, Superhuman.

Name the app, name the *specific* flow within it, and justify why it's the right
mirror for Trova's feature. If the user named an app, use theirs — but if it's a
poor analog for the job to be done, say so and offer the better mirror.

## Step 4 — The brutal evaluation

Be genuinely brutal, and genuinely fair. Flattery is useless; so is dunking
without credit. Use this structure:

```
## Where it loses to <reference>
Numbered, concrete, code-cited failures. Each: what the code does, what the
reference does instead, and why the reference's choice is better.

## Where it wins (credit due)
The things Trova does as well or better — especially domain-specific strengths
the reference app has no reason to have. If there are none, say so plainly.

## Verdict
A graded, quotable one-liner (e.g. "B− flow wearing an A-tier feature set"),
then 2–4 sentences on the single biggest problem and why it's the one to fix.
```

Keep it tight and opinionated. Give a recommendation, not an exhaustive survey.

## Step 5 — The gate

Stop and hand the evaluation to the user. Make the three paths explicit:

> **Approve** to get recommendations as-is · **Adjust** (add a constraint or
> disagree with a point) and I'll re-aim · **Reject** and I'll log it and move on.

Then wait. Do not proceed to recommendations, and never to implementation, before
the user responds. Record the response as the `Decision` in the ledger.

A constraint added here can invalidate part of the critique — that's expected and
good (e.g. "I actually want the user to pick a destination every time" flipped a
"forced modal" complaint from a bug into the intended design). Fold the constraint
in and re-derive; don't defend the original critique.

## Step 6 — Recommendations, then stop

Only after Approve or Adjust: produce a prioritized, numbered set of
recommendations that honor any constraint the user added. Each recommendation
says *what* to change and *why*, ordered by impact (fix the worst thing first).
Reference the exact files/handlers so the work is actionable later.

Then **stop.** Update the ledger. Do not write code, run builds, or open PRs. If
the user wants that, they'll say so — and that's a separate task (the repo's own
run/test/PR workflow), not part of this skill.

## Updating the ledger

Append one row at the end of every run. Example seeded row shows the format. For a
rejected critique, still add the row with `Decision = Rejected` and
`Outcome = Not pursued` so it isn't silently re-selected next time.

## Tone

Sharp, specific, senior. Think a principal designer doing a product teardown for a
team they respect enough to be blunt with. No hedging, no filler praise, no walls
of caveats. When you're confident, say it plainly; when something's genuinely good,
give the credit and move on.
