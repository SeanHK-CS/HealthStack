---
name: architecture-contract
description: Load-bearing architecture decisions for HealthStack. Read before changing structure, adding any dependency, or considering any server/account/build-step feature — several "obvious improvements" are deliberately rejected here.
---

# Architecture contract

## The prime directive (M4)

HealthStack is a **plain static site that boots from `file://`**: double-click
`index.html` and everything works. No build step, no bundler, no framework, no
package.json in the repo, no accounts, no server. This is not legacy debt — it
is the product's identity (offline-friendly, zero-trust, nothing to abuse) and
every feature since v1.0 has been designed inside it. Do not break it casually;
breaking it is a Tier-3 product decision the owner must make explicitly.

Consequences you must respect:
- Data ships as `window.X = [...]` assignments in `data/*.js`, NOT fetched
  JSON — `fetch()` is CORS-blocked on `file://`.
- No npm dependencies at runtime. jsdom (tests) and playwright-core
  (verification) are dev-only, installed ad hoc, and gitignored.
- New libraries: the answer is almost always "port the pattern in vanilla".
  Precedent: motion-primitives is a React library, so `js/motion.js`
  re-implements its patterns dependency-free (v1.3).
- External requests at runtime: Google Fonts and exercise images only, both
  with graceful offline fallbacks (system font stack; `onerror` hides images).

## Module pattern

Every JS file is an IIFE that attaches one namespace to `window` AND exports
via `module.exports` when present, so the same file runs in browser and Node
tests:

    (function (root) {
      var Thing = {};
      // ...
      if (typeof module !== "undefined" && module.exports) module.exports = Thing;
      root.Thing = Thing;
    })(typeof window !== "undefined" ? window : globalThis);

- **Pure logic** (filtering, calculators, encoding, ranking, seeded RNG) lives
  in `js/logic.js`, `js/share.js`, `js/coach.js` — no DOM access, fully
  Node-testable. **DOM wiring** lives in `js/app.js`. Keep this split; it is
  why the test suite is fast and honest.
- `js/motion.js` is progressive enhancement only: the app must be 100%
  functional if it never runs (it doesn't in jsdom).
- Script load order in index.html matters: data → logic → share → coach →
  app → motion.

## State & storage

- localStorage keys: `healthstack.saved`, `healthstack.plan`,
  `healthstack.tab`, `healthstack.todaySplit`.
- **Always use the memory-fallback pattern** (see `store` and `planStore` in
  app.js): jsdom blocks localStorage on `file://` origins and strict private
  browsing throws — every read/write is try/catch'd with an in-memory
  fallback that persists for the session.
- Shareable plans travel entirely in the URL fragment (`#p=` + base64url
  JSON). Fragments are never sent to servers — this is a stated privacy
  property; any feature that changes it must say so loudly in the UI.

## Rendering

- Views render by assigning `innerHTML` with string concatenation. ALL user
  or data text goes through `esc()` — no exceptions, including textarea
  contents and attribute values.
- Events use two delegated document-level listeners (click, input) driven by
  `data-*` attributes and element ids. Add branches there; don't bind
  per-element listeners on re-rendered content.
- The exercise browse has three modes in `renderExercises()`: carousel rows
  (no filters), group view (`browseGroup` set), flat results (any filter).
  `#ex-grid` gets/loses class `rows-mode` accordingly.

## The Tier-3 fork

Hosted links, coach profiles, client check-ins, and a proxied AI coach all
require a real backend. That fork is documented in the owner's private
roadmap (Google Drive — ask them). Until the owner explicitly opens it, the
answer to "should we add a server for this?" is no.
