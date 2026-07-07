# HealthStack BUILD_LOG

## Scope contract
MUST
- M1 Exercise database: browse/search/filter 873 exercises by muscle, equipment, level, category; detail view with step instructions + demo images; per-exercise MuscleWiki link.
- M2 Supplement rankings: curated evidence tiers A-D, dose, timing, safety, goal filter, Examine.com link per supplement.
- M3 Nutrition: TDEE/macro calculator (Mifflin-St Jeor, US + metric units) and searchable food macro table (85 foods).
- M4 Runs as a plain static site opened from disk (no server, no build step, no accounts).
- M5 Save exercises/supplements to a personal Saved tab (localStorage).

EDGE
- E1 Opened offline / file:// : data bundled as JS (no fetch), fonts fall back to system stacks.
- E2 Exercise images are hotlinked from GitHub; on failure they hide via onerror instead of showing broken icons.
- E3 No-result searches show an instructive empty state.
- E4 Calculator rejects blank/absurd inputs with a named message; never renders NaN.

OUT (agreed substitutions + not built)
- Live SuppCo integration: SuppCo has no public API. Substituted a curated 33-supplement dataset + outbound Examine links.
- Scraping MuscleWiki: no public API; substituted open-source free-exercise-db (873 exercises) + per-exercise MuscleWiki search links.
- Live USDA food search, accounts, workout logging/history, meal planner, deployment, mobile app.

## Decisions & deviations
- Data shipped as `window.X = ...` JS files instead of fetched JSON, so file:// opening works (fetch is CORS-blocked on file://).
- Exercise grid caps render at 60 cards for performance; count label says so.
- DEVIATION 1: tagline/tests said 34 supplements; 33 were authored. Corrected counts to 33.
- DEVIATION 2: jsdom blocks localStorage on file:// origin; added in-memory session fallback (also covers strict private browsing).

## Test evidence
- test/unit.test.js: 16/16 pass (data integrity, M1/M2/M3 logic, E3/E4).
- test/smoke.test.js (jsdom, real index.html): 12/12 pass (M1-M5, E3, E4, tabs/aria).
- Font-load warning in jsdom confirms E1 fallback path exercises without error.

## v1.1 — Coach chat (this session)
Scope additions:
- M6 Built-in coach chat: parses workout questions ("optimal upper body workout", "leg day dumbbells only, beginner") and generates real routines from the 873-exercise DB (splits: upper/lower/push/pull/full/arms/chest/back/shoulders/core/glutes/cardio), with sets/reps by goal, compound-first ordering, tap-through to exercise detail, and "another" to reshuffle.
- M7 Coach answers supplement verdicts/goal shortlists (tier data) and protein/calorie basics.
- M8 Optional Claude mode: user pastes their own Anthropic API key (settings gear); unparseable questions go to claude-haiku via direct browser API call. Key stored in localStorage only.
- E5 Unknown questions -> capability fallback, never fabricated answers.
- E6 Bad key / offline -> named error in chat; local mode keeps working.

Decisions & deviations:
- "Pre-installed AI" is impossible with a hidden paid key in a static site (anyone could read and abuse it), so the default coach is rule-based over bundled data, with BYO-key Claude as the optional upgrade path.
- Re-trimmed exercises.js to include the mechanic (compound/isolation) field for exercise ordering.
- FIXED pre-existing bug: Details clicked from the Saved tab (and now chat) didn't switch to the Workouts tab, so nothing visibly happened. Delegated handler now calls showTab("workouts") first.
- api.test.js regex initially failed against the API's literal "invalid x-api-key" string; loosened the test, code unchanged.

Test evidence: unit 16/16, coach 24/24, smoke 20/20 (jsdom on real index.html), api.test.js live 401 round-trip against api.anthropic.com. Untested for real: a successful paid-key completion (no key available in the build environment).

## v1.2 — Claude mode removed (owner decision)
- M8/E6 deleted from the scope contract at Sean's request (cost/abuse concern). Note: the removed design never shipped a key in the files (BYO-key, localStorage only), but removal makes the site pure static data: zero credentials, zero network writes, nothing abusable if deployed publicly.
- Removed: key field + settings gear (index.html), keyStore/askClaude/fetch path (app.js), buildClaudeRequest/parseClaudeResponse (coach.js), settings CSS, test/api.test.js, 2 M8 unit tests.
- E5 fallback text updated: lists coach capabilities, no API mention.
- Added removal-verification smoke test: no key field, no settings control, no api.anthropic.com string anywhere in the rendered page; grep across shipped files confirms zero API/key references.
