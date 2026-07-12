---
name: debugging-playbook
description: Symptom → cause → fix table for HealthStack's known failure modes. Check here before investigating from scratch — most bugs in this codebase rhyme with an old one.
---

# Debugging playbook

| Symptom | Likely cause | Fix / where |
|---|---|---|
| Horizontal scroll on mobile | Intrinsic min-width: long `<select>` options or hard `minmax(Npx,1fr)` floors or a wide table | `min-width:0` on grid children; `minmax(min(Npx,100%),1fr)`; wrap tables in `.table-scroll`. Audit with `scrollWidth - clientWidth` per tab at 390/320 |
| Cards/rows look empty or ghosted | Motion reveal: waiting on IntersectionObserver or a big stagger delay | Check `--mp-i` is per-parent (motion.js `reveal`); container must be in motion.js watched-ids; screenshot may just be mid-animation — wait 1s and re-shoot |
| Feature works in tests, broken in a real browser | jsdom gap: no IO, no clipboard, blocked localStorage, sync-looking hashchange | See testing-and-verification skill; add a Playwright check for that flow |
| Share link "doesn't contain a readable plan" | Truncated copy (chat apps), tampered payload, or schema drift | `Share.parseHash` → `decodePlan` in console; verify base64url charset `[A-Za-z0-9_-]`; check `raw.v` version handling |
| Recipient's builder empty after import | Builder rendered pre-import and not re-rendered | `checkSharedHash` else-branch must call `renderPlans()` when the panel is visible (v1.6 fix) — verify it survived refactors |
| Saved/Plans state vanishes | localStorage blocked (file:// in jsdom, strict private mode) — memory fallback active | Expected behavior, session-only persistence; don't "fix" |
| Wrong browse view showing | `browseGroup` state vs filter precedence in `renderExercises()` | Order: muscle filter nulls group → group view → no-filters rows → flat. Check `rows-mode` class toggling on `#ex-grid` |
| Count label wrong/missing | Numbers-as-feedback rule, not a bug | Bare browse/group views show no counts; counts only with active filters (design-system skill) |
| "Top pick" chips where they shouldn't be | `exerciseCard` mapped directly (index becomes topPick arg) | Wrap: `map(function (x) { return exerciseCard(x); })` |
| Today's card same after "Reshuffle" | Deterministic seed working as intended (same day = same base) | Shuffle offsets seed by +97/step; verify `todayShuffle` increments; split override stored keyed to dateSeed, expires at midnight |
| Exercise images broken/blank boxes | CDN unreachable (offline or sandbox proxy) | Expected: `onerror` hides them; layout must look right without images |
| iOS zooms when tapping an input | A form control under 16px font on touch | `(pointer: coarse)` block sets 16px — it must remain the LAST block in style.css |
| Animations missing entirely | `prefers-reduced-motion`, or motion.js not loaded/errored | By design under reduced motion. Otherwise check `<html class="mp-motion">` present |
| Coach chat answers "I'm a built-in coach..." | Question didn't match any parse rule | That's the honest fallback; extend `Coach.parse` patterns + tests rather than faking an answer |

## Triage order for a new bug

1. Reproduce in real Chromium (not just jsdom) at desktop AND 390px.
2. Check this table + failure-archaeology — most bugs rhyme.
3. Isolate: pure logic (unit-testable, fix in logic/share/coach.js) vs DOM
   wiring (app.js delegated handlers) vs presentation (style.css/motion.js).
4. Write the failing test FIRST if the class of bug is "tests passed but
   browser broke" — that means coverage has a hole worth filling.
5. After fixing: full suite + browser verify + add the entry to this table
   if it's a new failure class, and to BUILD_LOG under the version.
