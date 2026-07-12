---
name: design-system
description: HealthStack's quiet-luxury visual identity and interaction rules — palette tokens, typography, the motion layer's constraints, and the UX laws (numbers as feedback, curation over algorithms, progressive disclosure) that every UI change must obey.
---

# Design system — "quiet luxury"

The brand (owner-confirmed, non-negotiable): a calm, premium training
reference. Warm ivory, editorial serif, champagne gold. Changes REFINE this
look; they never replace it.

## Tokens (css/style.css `:root`)

- `--bg` #f4f1ea warm ivory · `--card` #fffefb · `--ink` #15171b
- `--accent` #23408e deep navy (actions, links, focus)
- `--gold` #b08d3e / `--gold-bright` #c9a95c / `--gold-soft` #f3ead3
  (brand mark, tab indicator, kickers, badges, top-pick chips, spotlight)
- `--line` #e3ded2 warm hairlines · `--radius` 12px
- `--display` Playfair Display (serif; headings, brand, tabs) ·
  `--body` Inter
- Tier plates A green / B cobalt / C amber / D gray are **semantic data
  colors** — never restyle them to match the theme.
- Gold is seasoning, not sauce: kickers, indicators, chips. Actions stay navy;
  large surfaces stay ivory/ink.

## UX laws (each one exists because of real user feedback)

1. **Numbers are feedback, never advertising** (v1.5.2). Result counts appear
   after a search/filter ("12 matches · Chest"); browsing surfaces show no
   digits. The "873 exercises" framing overwhelmed a real user — don't
   reintroduce it.
2. **Curation beats algorithms for anything user-facing** (v1.5). The ranking
   heuristic alone surfaced "Spell Caster" as a top core exercise. Canonical
   picks are hand-curated in `Logic.MUSCLE_GROUPS`; `rankSuggestions` only
   fills filtered gaps. Unit tests validate curated ids so curation can't rot.
3. **Progressive disclosure by default** (v1.5/v1.5.1). Browse = carousel rows
   per muscle group → group view with 5 top picks → full list. Never open a
   view on a wall of content.
4. **Calm > features.** Max 1–2 new features per release; each must serve the
   daily loop (open → today's session → train) or the coach loop (curate →
   share link → client trains). The default-NO list (social feeds, badges,
   progress photos, per-vendor wearable APIs) is in the owner's private
   roadmap.
5. **Carousels scroll, never rotate.** Rows move only when the user moves
   them; arrows on desktop, swipe on touch (arrows hide ≤560px).

## Motion layer rules (js/motion.js)

- Everything is gated: `prefers-reduced-motion: reduce` → motion.js returns
  before adding `.mp-motion` to `<html>`, and all motion CSS lives under
  `.mp-motion` + a `no-preference` media query. The static page must be
  complete without it.
- Stagger indexes are **per-parent, not global** — the global version made
  lower carousel rows appear empty on mobile (v1.5.1 fix). Keep
  `--mp-i` computed from `parentNode.children` position.
- Card reveal uses `animation-fill-mode: backwards` (not forwards) so hover
  transforms still work after entry.
- New dynamic containers must be added to motion.js's watched-ids list to get
  reveal animations.
- Signature effects: per-word tagline reveal, gold brand shimmer, cursor
  spotlight (fine pointers only), sliding gold tab indicator. Port patterns in
  vanilla; never add an animation library.

## Copy voice

Plain, confident, no hype, no exclamation marks. Explanations state the
evidence ("Tier A — strong evidence"), notes state limits ("not medical
advice"). Empty states always offer a next action (button), never a shrug.
