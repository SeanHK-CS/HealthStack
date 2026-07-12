---
name: data-model
description: Shapes and invariants of HealthStack's bundled datasets (exercises, supplements, foods), id conventions, curated-list validation, and how the daily-session seeding works. Read before touching data/ or anything that joins against it.
---

# Data model

## Exercises — `data/exercises.js` → `window.EXERCISES` (873)

    { id, name, level: beginner|intermediate|expert,
      equipment,            // "body only", "dumbbell", "barbell", "cable",
                            // "machine", "kettlebells", "bands", "other",
                            // "none listed", "e-z curl bar", "foam roll", ...
      primary: [muscle...], secondary: [muscle...],
      category,             // strength|stretching|cardio|plyometrics|
                            // powerlifting|"olympic weightlifting"|strongman
      mechanic: compound|isolation|null,
      instructions: [step...], images: [path...] }

- 17 primary muscles exist; `Logic.MUSCLE_GROUPS` (9 groups) must cover all
  of them — a unit test enforces this.
- ids are the name with underscores/punctuation variations
  ("Barbell_Bench_Press_-_Medium_Grip"). Never construct ids; look them up.
- Images hotlink to the free-exercise-db GitHub raw CDN via
  `L.exerciseImageUrl(path)`; every `<img>` must carry the
  `onerror="this.style.display='none'"` fallback (offline/E2 pattern).
- "Training categories" for suggestions = strength, powerlifting, olympic
  weightlifting (`CORE_CATS` in app.js).

## Supplements — `data/supplements.js` → `window.SUPPLEMENTS` (33)

    { id, name, tier: A|B|C|D, goals: [...], dose, timing,
      evidence, safety, slug /* examine.com */ }

Tiers are curated research consensus — content edits need sources (Examine,
ISSN position stands), not vibes. Tier ordering (A first) is enforced by
`filterSupps` and asserted in tests. `dose === "—"` means "not applicable" and
suppresses dose/timing rows in cards.

## Foods — `data/foods.js` → `window.FOODS` (85+)

    { n: name, g: protein|carb|fruit|fat|veg|dairy, kcal, p, c, f, fb }

Per 100g, all numeric, no NaN (unit-tested). The calculator's "See
protein-rich foods" cross-link filters `g === "protein"`.

## Curated lists — the rot-proofing pattern

Any hand-curated list that references data ids (`Logic.MUSCLE_GROUPS[].picks`,
future featured plans) MUST ship with a unit test that resolves every id
against the dataset and checks group membership. This is what lets the
dataset update without curation silently breaking. Copy the pattern from
unit.test.js "curated group picks".

## Daily session seeding

`Logic.dateSeed(date)` → YYYYMMDD int; `Logic.mulberry32(seed)` → deterministic
PRNG; `Logic.dailySplit(date)` → weekday rotation (Sun full … Sat core).
Same day = same workout for everyone; reshuffle offsets the seed (+97/step);
the user's split override is stored keyed to the seed so it expires at
midnight. Determinism is the point — never swap in Math.random, and never
call these with `new Date()` inside pure logic tests (pass fixed dates).
