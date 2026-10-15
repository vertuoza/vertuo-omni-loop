---
screen: anti-loop-mode
status: draft
kind: shared
mock: anti-loop-mode.html
implements: []
reads: []
routes: [/knowledge?tab=lessons, /prd/<id>?tab=retro, /prd/<id>?tab=rewind, /play#planet-<owner>/<repo>/<n>]
supersedes: null
---

## Purpose

Anti-loop mode, Rewind Light: the look the anti-loop's surfaces share, Lessons, the PRD page's Retro
and Rewind tabs, and Breach Night. It changes the light, never the layout: six tokens remap under
the Omni theme, the lockup flips, and one wipe enters and leaves it. Drafted once here; each page
that shows it lists this screen's files in its `reads` and never redraws it. The shell itself stays
`app-shell`.

## Regions

- **The lockup:** forward, `[mark] OMNI LOOP`; in the mode, `ANTI LOOP [mirrored mark]`: the same
  pixel mark (`packages/design/src/logo.ts`), mirrored so its arrow turns the other way, on the other
  side of the wordmark, at a whole-number scale, same font and size as the forward wordmark. The
  mark's ring and arrow take the magenta ramp #ffd1e8 / #ff8cc8 / #ff3ea5 / #c41f7e; its navy outline
  and violet shadow are kept; the forward mark is untouched. Breach Night wears it in the arcade
  header.
- **The bar's end:** forward, an Anti-loop button that enters the mode; in the mode, the Anti-loop
  pill and Leave.
- **The token remap (theme Omni):** lines and strong lines go plum (#3a1458, #b0489a), the signal
  goes magenta (#ff3ea5, soft #3a1238), the state badge "never landed" takes magenta, and the primary
  takes the yellow (#ffd84a on #07061c). Light and Dark have their own values.

## States

- **Forward:** the app as today.
- **Anti-loop:** the remap and the mirrored lockup.
- **Entering and leaving:** one 360 ms wipe, from the right entering, from the left leaving; the
  lockup swaps as part of it; instant under reduced motion.

## Words

OMNI LOOP · ANTI LOOP · Anti-loop · Leave.

## Refusals

- Errors stay red: no red turns orange.
- Magenta marks state only; the primary keeps a distinct yellow treatment.
- No mirrored sidebar, no scanlines, no single-hue world: Side B was "too much".
- Every text pair passes AA.
- The layout does not move: only the tokens and the lockup change.

## Open questions

- The remap's values in Light and Dark were drawn in the tour, not checked against the ASK AA test
  in `packages/design/src/tokens.ts`.
- Whether the mode is a switch a person turns, or follows state (the Skeptic: Lessons stays in rewind
  colours while anything never landed, and turns back at 0), is not decided.
- B-E DEv: "A mode is still costume; the card worked without it." Whether the mode can be turned off
  for good is not said.
- The Visionary wanted Side B's screenshot; the concept kept only its lockup.
- Where the Anti-loop button sits on pages that are not anti-loop surfaces, if anywhere, is not said.

## Source

- /omni:think-big, concept #1964, crowned M on 2026-10-14: .omni-loop/delivery/inbox/concepts/1964-anti-loop/vision.html
