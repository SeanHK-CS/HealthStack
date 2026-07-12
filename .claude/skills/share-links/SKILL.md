---
name: share-links
description: How HealthStack's shareable coach-plan links work (js/share.js) — schema, caps, security rules, and the constraints any schema evolution (v2 custom exercises, programs) must satisfy. This is the product's growth loop; treat it as a public API.
---

# Share links (`#p=` fragments)

## How it works

A coach's plan serializes to compact JSON → UTF-8 → base64url, carried in the
URL fragment: `index.html#p=<code>`. Fragments never reach a server — that's a
stated privacy property. `js/share.js` is pure logic (Node-testable), used by
app.js.

Schema v1: `{ v:1, t:title, c:coach, m:message, x:[[exerciseId, note], ...] }`

Caps (Share.LIMITS): 15 items, 300-char notes, 80 title, 60 name, 500
message. A maxed-out plan stays well under 8KB of URL — inside practical
limits for chat apps. Don't raise caps without re-checking that test
(`share.test.js` "real-size plan").

## Rules that must survive any change

1. **Backward decodability.** Links live in old chat threads forever. A v2
   schema must still decode v1 payloads (`decodePlan` checks `raw.v`).
2. **Decode never throws, never trusts.** Garbage/tampered input → named
   error object (`{error}`), rendered as a friendly view with a way out.
   Unknown exercise ids are dropped silently (stale links across DB updates);
   all-unknown → error. Every field is length-clipped and type-coerced on
   decode, and HTML-escaped at render.
3. **XSS surface.** Notes/titles/messages are attacker-controlled (anyone can
   craft a link). They must pass through `esc()` at every render site,
   including inside `<textarea>` (escaping prevents `</textarea>` breakout).
   If v2 adds URLs (e.g. video links on custom exercises), allow http(s) only.
4. **base64url helpers** handle Unicode via encodeURIComponent byte-mapping —
   btoa alone corrupts non-ASCII. Node ≥16 and browsers both have btoa/atob;
   jsdom does NOT have TextEncoder in-page, which is why share.js avoids it.

## The flows

- Builder (Plans tab) → `encodePlan` → `planLink(location.href, code)` →
  clipboard (with visible-input fallback; jsdom/file:// has no clipboard).
- Recipient opens link → `checkSharedHash()` on load + hashchange → jumps to
  Plans tab, renders read-only view with coach's notes → "Load into my plan
  builder" imports → **dismiss must re-render the builder** (v1.6 bug: a
  fresh browser's builder was rendered pre-import and went stale).
- The recipient IS a new user landing on the product — anything on the
  shared view is acquisition surface. og: meta tags exist so links unfurl.

## Testing expectations

Any schema change updates: round-trip incl. Unicode, URL-safe charset,
hostile input battery, caps, `parseHash` variants (share.test.js), plus the
smoke-flow (build → link → open in CLEARED state → import → dismiss) and a
fresh-page Playwright pass. Remember the fresh-browser rule: recipients have
empty localStorage.
