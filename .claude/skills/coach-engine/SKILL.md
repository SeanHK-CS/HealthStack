---
name: coach-engine
description: How the rule-based coach (js/coach.js) parses questions and generates workouts — split slots, intent patterns, rep schemes — and how the today-card and future workout features should reuse it instead of reinventing generation.
---

# Coach engine (js/coach.js)

Pure logic, no DOM, no network, no AI. It answers from bundled data only and
says so honestly when it can't (E5 fallback). This honesty is a feature.

## Generation model

`SPLITS` maps a split name to **slots** — ordered lists of acceptable primary
muscles, one exercise picked per slot:

    upper: [["chest"], ["lats","middle back"], ["shoulders"], ["biceps"], ["triceps"]]
    // cardio is special-cased: 4 picks from cardio/plyometrics categories

`Coach.generate(exercises, opts, rng)`:
- filters candidates per slot by training categories (strength/powerlifting/
  oly), level expansion (beginner→[beginner]; default→[beginner,intermediate];
  expert→all), and optional equipment;
- compound-first bias: first two slots prefer compounds, later slots 60%;
- `rng` is injectable — Math.random for chat, `Logic.mulberry32(dateSeed)`
  for the deterministic today card. ANY new feature that generates workouts
  (workout mode, plan seeds, challenges) must reuse this function with an
  injected rng, not reimplement selection.
- Returns `{items: [{ex, scheme}], gaps: [unfilled slots]}` — always surface
  gaps to the user ("no match for X with those constraints").

`repScheme(goal, mechanic)`: strength → 4×4–6 compounds / 3×8 isolation;
endurance → 3×15–20; hypertrophy default → 4×8–10 / 3×10–15. Rest times
included in the string.

## Parsing model (`Coach.parse`)

Regex-based intent detection in priority order: protein/calorie questions →
specific supplement mention (matched against SUPPLEMENTS names/ids) →
supplement-goal → workout (split words, equipment words, level, goal) →
greeting → "another" (re-runs `state.lastWorkout`) → unknown.

Extending it: add patterns to the word tables (SPLIT_WORDS, EQUIP_WORDS,
goal regexes) and add cases to `test/coach.test.js` (22 tests). Answers are
structured objects (`{type, ...}`) rendered by app.js — keep that split so
the engine stays Node-testable.

## Content stances (owner-approved, don't soften)

- Fat-loss questions get the honest "no Tier A/B fat-loss pill" answer
  pointing at the deficit + protein + caffeine, not a supplement list.
- Supplement verdicts map tier → blunt language ("Skip it — the evidence
  doesn't support the claim" for D).
- Protein math: 1.6–2.2 g/kg. Calculator: Mifflin-St Jeor with ±200 kcal
  trend-adjustment advice. These numbers are sourced consensus; change only
  with sources.

## Known limits (fine to live with)

- English-only regex parsing; typos miss ("suplement" won't match).
- No conversation memory beyond `lastWorkout`.
- If an intent can't be parsed, it must fall to the capability fallback —
  never fabricate an answer. If AI-backed answers are ever requested, that's
  the Tier-3 proxied-API decision (see failure-archaeology: BYO-key history).
