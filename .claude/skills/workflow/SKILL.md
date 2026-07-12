---
name: workflow
description: How work ships in this repo — branch/PR cadence with a fast-merging owner, the merged-PR restart rule, BUILD_LOG conventions, and what a finished change includes. Follow this to avoid history messes and undocumented drift.
---

# Workflow

## The owner's cadence (design your work around it)

Sean reviews and merges PRs within minutes, iterates by feedback ("my friend
found X overwhelming"), and asks for PRs explicitly ("let's make PR N").
Therefore:

- Keep PRs small and themed; write bodies that explain the *why* (feedback →
  diagnosis → decision) with test evidence. He reads them.
- **Never create a PR unsolicited** — push the branch, summarize, and offer.
- **Check PR/branch state before every push.** A PR you opened an hour ago is
  probably merged. `list_pull_requests state=open`, or `git fetch origin main`
  and compare.

## The merged-PR restart rule

After the branch's PR merges, the branch must restart from main before new
work: `git fetch origin main && git rebase origin/main` (drops already-merged
commits) or `git checkout -B <branch> origin/main` when starting clean. Push
with `--force-with-lease` after any rebase. Never stack new commits onto
already-merged history and never force-push over unmerged commits without
rebasing them forward.

## Definition of done (every change)

1. All four test suites pass (see testing-and-verification).
2. New logic has unit tests; new UI flows have smoke tests; curated data has
   rot-proof validation tests.
3. Real-browser verification: changed flows driven in Chromium, desktop +
   390px (+320px if layout changed), zero horizontal overflow, screenshots
   shared with the owner.
4. **BUILD_LOG.md updated** — this is the project's memory and the owner's
   changelog. Convention per entry:
   `## vX.Y — Title (this session)` with: scope additions (M/E numbering
   continues: M13/E9 are taken), decisions & deviations (record REJECTED
   options and why — future sessions read these), and test evidence with
   counts.
5. Commit messages: imperative summary, body explains motivation and
   evidence. No model IDs in commits/PRs/code.

## Conventions that keep the codebase coherent

- ES5-flavored style in browser JS (var, function expressions, string
  concat) — match it; don't "modernize" drive-by.
- Unicode in JS strings as `\uXXXX` escapes where the file already does so.
- New user-visible strings go through `esc()` when interpolated.
- Delegated handlers over per-element listeners; `data-*` attributes as the
  contract between HTML strings and JS.
- Files ignored on purpose: node_modules, package*.json (dev-only tooling),
  ROADMAP.md (product plans are private — in the owner's Google Drive; ask
  them rather than committing strategy to this public repo).

## Session hygiene

- Scratch scripts (Playwright checks, probes) live in the session scratchpad,
  never in the repo.
- When the user reports something visual ("why is X not there?"), verify with
  instrumentation before explaining — screenshots can freeze mid-animation
  and mislead both of you.
