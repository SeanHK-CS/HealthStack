---
name: testing-and-verification
description: How HealthStack is tested and what "done" means — the four suites, jsdom's traps, and the mandatory real-browser verification pass (desktop + mobile) before any push.
---

# Testing & verification

## The suites (run all four before every commit)

    npm install jsdom          # once per environment; gitignored
    node test/unit.test.js     # data integrity + pure logic (logic.js)
    node test/coach.test.js    # rule-based coach parsing/generation
    node test/share.test.js    # share-link encode/decode, hostile input
    node test/smoke.test.js    # jsdom loads the REAL index.html, clicks through UI

Suites print `N tests passed` and exit non-zero on failure. Every feature
ships with: unit tests for its pure logic + smoke tests for its UI flow.
Record counts in BUILD_LOG.md ("Test evidence: unit 26/26, ...").

## jsdom traps (all learned the hard way)

- **localStorage is blocked on file://** → the app's memory-fallback stores
  kick in. Tests therefore run with per-load empty state.
- **No IntersectionObserver** → motion.js reveals cards instantly. Never make
  functionality depend on the motion layer.
- **`window.location.hash = ...` fires hashchange asynchronously** → after
  setting it, `await new Promise(r => setTimeout(r, 100))` before asserting.
- **No navigator.clipboard** → share-link code falls back to showing the link
  in `#plan-link`; tests assert the input, not the clipboard.
- **`confirm()` doesn't exist** → the app never uses it (import overwrites the
  draft silently by design).
- **THE BIG ONE — coincidental passes.** The shared-plan import bug (v1.6)
  shipped because the smoke test imported into a page that already held the
  same draft, so the stale render looked correct. When testing flows meant
  for OTHER people's browsers (share links!), reset local state first so the
  test genuinely proves restoration. Ask: "would this pass in a fresh
  browser?"

## Real-browser verification (not optional)

Tests passing ≠ done. Before any push, drive the changed flows in real
Chromium and screenshot them (house rule, owner-confirmed):

    npm install playwright-core
    // launch: chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
    //                           args: ["--no-sandbox"] })
    // file URL: "file:///home/user/HealthStack/index.html"

- Playwright locators are strict-mode: use `.first()` when a selector can match multiple elements.
- The sandbox blocks fonts/images CDNs — grey thumbnail placeholders and
  fallback fonts in screenshots are expected; production loads them.
- Send before/after screenshots to the owner with every visual change.

## The mobile audit (regressions happen here first)

At 390×844 and 320×568 (`isMobile: true, hasTouch: true`), on EVERY tab:

    document.documentElement.scrollWidth - document.documentElement.clientWidth
    // must be 0 — anything >0 is a shipped bug

Known overflow causes (see debugging-playbook): intrinsic min-width of long
`<select>` options (fix: `min-width: 0` on grid children), hard minmax()
column floors (fix: `minmax(min(Npx, 100%), 1fr)`), tables (fix: wrap in
`.table-scroll`). Also verify `(pointer: coarse)` styles apply (bigger tap
targets, 16px form text — stops iOS focus-zoom) and that the coarse block
stays LAST in style.css (cascade order is load-bearing).
