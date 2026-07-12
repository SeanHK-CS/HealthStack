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

## v1.3 — Motion polish + shareable coach plans (this session)
Scope additions:
- M9 Coach plan builder (Plans tab): any exercise card gets "+ Plan"; per-exercise coach notes, plan title, coach name, and a message to the client; reorder/remove items; draft persists in localStorage (cap: 15 exercises, 300-char notes).
- M10 Shareable links with zero backend: the plan serializes to base64url JSON in the URL fragment (#p=...), so links work on the static Vercel deploy and from file://. Recipients get a read-only plan view with the coach's notes, tap through to full exercise instructions, and can load the plan into their own builder to edit/re-share.
- M11 Motion layer (js/motion.js + CSS): motion-primitives-style interactions — per-word tagline reveal (TextEffect), brand shimmer (TextShimmer), staggered in-view card entrances (AnimatedGroup/InView), cursor-tracking spotlight on cards (Spotlight), sliding tab indicator, panel/chat entrance animations, refined masthead gradient + grid texture.
- E7 Tampered/garbage/stale share links render a named error view (never crash); unknown exercise ids are dropped; all shared text is length-capped and HTML-escaped on render.
- E8 All animation is progressive enhancement: gated on prefers-reduced-motion, and the page is fully usable with js/motion.js absent (also keeps jsdom smoke tests deterministic — no IntersectionObserver there means cards reveal instantly).

Decisions & deviations:
- motion-primitives.com is a React/Motion component library; adding React (or any bundler) would break M4 (plain static site, boots from disk). Ported the signature primitives to dependency-free vanilla CSS/JS instead of importing the library.
- Share links carry the plan in the fragment, which browsers don't send to servers — nothing is uploaded anywhere. The builder states plainly that anyone with the link can read the notes.
- "Load into my plan builder" overwrites the single local draft without a confirm dialog: the draft is scratch space, and jsdom has no confirm() to test one.
- 15-exercise cap keeps worst-case links ~6 KB, comfortably inside practical URL limits for chat apps and browsers.

Test evidence: unit 16/16, coach 22/22, share 9/9 (new: round-trip incl. unicode, hostile input, caps, hash parsing), smoke 27/27 (new: builder flow, link generation, opening a #p= link, import, tampered-link recovery). Real-browser check (Chromium): motion layer engages, plan built and shared link opened in a fresh page shows the read-only coach view.

## v1.3.1 — Mobile pass (this session)
- E9 Audited every tab (plus exercise detail, plan builder, shared-plan view, coach chat) in emulated mobile Chromium at 390px and 320px: zero horizontal overflow, no page errors.
- FIXED: Nutrition tab overflowed 63px on phones — long <select> option labels set the intrinsic min-width of grid tracks; added min-width:0 to nutrition/calculator/plan grid children.
- FIXED: Supplements grid overflowed 24px at 320px — inline minmax(330px,1fr) column floor exceeded the viewport; replaced inline styles with a .grid-wide class using minmax(min(330px,100%),1fr) (base .grid gets the same min() guard).
- Food table now sits in an overflow-x:auto wrapper so worst-case width scrolls inside its card instead of widening the page.
- Touch ergonomics (@media pointer:coarse, kept last in the cascade): bigger tap targets for .btn/.btn.icon/coach close, 16px form text so iOS Safari doesn't auto-zoom on input focus.
- Test evidence: unit 16/16, coach 22/22, share 9/9, smoke 27/27 unchanged; mobile audit script reports 0px overflow on all views at both widths.

## v1.4 — Retention pass (this session)
UX goal: give people a reason to come back and never leave them at a dead end, without adding scope (still no accounts, no logging, no backend).
- M12 Today's session: a date-seeded daily workout at the top of Workouts (same pick all day, fresh tomorrow; Sun full / Mon upper / Tue lower / Wed push / Thu pull / Fri full / Sat core). Reshuffle button re-rolls deterministically; "Add all to plan" feeds the coach-plan builder. Uses the existing Coach.generate engine with a mulberry32 PRNG seeded from the calendar date (Logic.dateSeed/mulberry32/dailySplit — pure, unit-tested).
- Tab badges: Plans and Saved tabs show live item counts, so collected work is visible from every screen.
- Actionable empty states: no-result searches get "Clear all filters"; empty Saved/Plans get buttons that jump to the right tab.
- Exercise card thumbnails: 60px lazy-loaded photo per card (first image from the exercise's own set); hides itself on load failure so the offline layout is unchanged (E2 pattern).
- Cross-links: calculator results add "See protein-rich foods →" (filters + scrolls to the food table); the app reopens on the tab you last used (localStorage; share links still take priority).
- Copy: tagline tightened.

Decisions & deviations:
- No streaks/logging — considered and rejected as scope creep toward a tracking app; the daily-session card is the comeback trigger instead.
- Thumbnail failure collapses the image (display:none) rather than reserving space, so offline cards look exactly like v1.3.

Test evidence: unit 20/20 (new: seed/PRNG/split mapping + deterministic generation), coach 22/22, share 9/9, smoke 34/34 (new: today card, reshuffle, add-all-to-plan + badges, badge tracking, empty-state actions, protein cross-link, thumbnail fallback). Real-browser: badges render, last-tab restore works after reload, 0px mobile overflow at 390/320.

## v1.4.1 — Today's session respects the user's own split (this session)
- Feedback (Sean, via PR #2 review): the daily card locked Saturday to core — wrong for anyone following their own program.
- The weekday rotation is now a *suggestion*, not a rule: the card gets a focus picker (Full-body/Upper/Lower/Push/Pull/Core/Arms/Chest/Back/Shoulders/Glutes/Cardio). The day's suggestion is marked "· suggested"; an override is labelled "· your pick", survives reshuffles and reloads, and expires at midnight (stored as {dateSeed, split} in localStorage with in-memory fallback) so tomorrow suggests fresh.
- Test evidence: smoke 35/35 (new: picker present, suggestion marked, override relabels card + survives reshuffle); real-browser: override persists across reload same-day, 0px mobile overflow.
