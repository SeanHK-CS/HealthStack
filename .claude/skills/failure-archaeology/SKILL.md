---
name: failure-archaeology
description: Every dead end, revert, and shipped-then-fixed bug in HealthStack's history, with the reason it happened — so no future session re-fights a settled battle or reintroduces a buried mistake.
---

# Failure archaeology

Settled battles. Don't reopen them without new evidence.

## Reverted / rejected designs

- **BYO-key Claude coach (v1.1 → removed v1.2).** An optional "paste your
  Anthropic API key" mode powered unparseable coach questions. Owner removed
  it over cost/abuse concerns. The rule-based coach IS the product. If AI
  answers ever return, the correct design is a rate-limited server proxy
  (Tier-3 backend decision) — never a key in the client, never a shipped key.
- **Algorithmic top picks (v1.5, same-day fix).** Ranking exercises by
  compound/beginner/equipment surfaced junk ("Spell Caster", "Cable Judo
  Flip", five push-up variants) because the dataset has no popularity signal.
  Fixed by hand-curating canonical picks with the algorithm as filtered
  fallback. Lesson: **this dataset cannot rank popularity; curate.**
- **Static muscle-group tiles (v1.5 → replaced v1.5.1).** Tiles were abstract
  category boxes; the owner asked for carousels. Rows showing real exercises
  beat category abstractions. Auto-rotating carousels were explicitly
  rejected (anti-pattern).
- **Catalog-size numbers (v1.0 → removed v1.5.2).** "873 exercises" and
  per-row counts overwhelmed a real user. Counts are filter feedback only.
- **Streaks / workout logging** — considered in the retention pass (v1.4) and
  rejected as scope creep toward a tracking app. Only reconsider bundled with
  a workout-mode feature, per the private roadmap.
- **Weekday split as a hard rule (v1.4 → fixed PR#3).** Locking Saturday to
  core day broke for anyone on their own program. Defaults must be
  overridable suggestions.

## Shipped bugs and their root causes

- **Shared-plan import showed an empty builder (fixed v1.6).** The builder
  rendered before import and was never re-rendered. Root cause of the miss:
  the jsdom test's same-page draft made the stale render look correct —
  a coincidental pass. Rule: test share flows from a CLEARED state.
- **Global animation stagger (fixed v1.5.1).** `--mp-i` indexed across all 72
  cards, so the Back row waited ~600ms after scrolling into view and looked
  empty on mobile. Stagger per parent container, always.
- **Nutrition tab overflowed 63px on phones (fixed v1.3.1).** Long `<select>`
  option labels set the intrinsic min-width of grid tracks. Fix:
  `min-width: 0` on grid children. This class of bug (intrinsic min-width vs
  narrow viewport) has now happened twice — also the supplements grid's hard
  `minmax(330px,1fr)` floor at 320px (fix: `minmax(min(330px,100%),1fr)`).
- **`.map(exerciseCard)` passed the index as the `topPick` flag.** Any
  function with optional trailing params must be wrapped when mapped:
  `list.map(function (x) { return exerciseCard(x); })`. One un-wrapped call
  would have put "Top pick" chips on every saved exercise.
- **iOS zoom-on-focus** — form text under 16px makes Safari zoom the page on
  input focus. The `(pointer: coarse)` block sets 16px and must stay LAST in
  style.css (a later base rule once beat it on specificity-tie; that's why
  it's positioned at the end with a comment).
- **jsdom asserts on textContent immediately** — never animate/tween text
  nodes that tests read synchronously (counts, calculator results).

## Environment gotchas

- Sandbox proxies block raw.githubusercontent + Google Fonts: screenshots
  show grey thumb placeholders and fallback fonts. Expected; not a bug.
- `git` sessions here: PRs are merged fast by the owner — always check PR
  state before pushing to a branch, and restart the branch from main after a
  merge (see workflow skill).
