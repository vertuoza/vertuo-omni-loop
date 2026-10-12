---
screen: doorway
status: draft
kind: shared
mock: doorway.html
implements: [apps/galaxy/src/doorway/Doorway.tsx, apps/galaxy/src/doorway/doorway.css]
reads: [apps/galaxy/app/ask/(doorway)/layout.tsx, apps/galaxy/app/signup/layout.tsx, apps/galaxy/src/home/poster/art.ts, apps/galaxy/src/ask/theme-tokens.ts, apps/galaxy/src/ask/theme-script.tsx, apps/galaxy/src/ask/ask.css]
routes: [/ask/device, /ask/signin, /signup]
supersedes: null
---

## Purpose

The frame around the pages a person meets *before* they are inside the app (PRD 1705): the
terminal's sign-in by code, its sign-in by browser, and sign-up. It holds one thing, a card, and no
part of the app: someone arriving from a terminal link or from HOME has one thing to do here. Each
page inside it lists these files in its `reads`, never in its `implements`.

## Regions

- **The ground:** Ask's `ground` for the stored theme, the whole viewport. Under Omni and Dark the
  starfield HOME draws (`starfieldSvg()`, static, `aria-hidden`) lies behind everything; under Light
  the ground stays plain.
- **The mark,** centred: the crest's full form (`logoSvg(CREST_FORM)`), 3×, 2× below 900 px, named
  `OMNI LOOP`, linking to `/`.
- **The card:** the page's `ask-card`, at most 460 px wide, in the reading face on Ask's tokens.
- **The foot:** one `Docs` link, in `muted`.

## States

- **Omni** (the default): the starfield on the void.
- **Dark:** the starfield on the deep ground.
- **Light:** the plain ground, no stars.
- **Below 900 px:** the card spans the width less a 16 px gutter; the crest at 2×; the page never
  scrolls sideways.

## Words

Only `Docs`. Every other word is the page's.

## Refusals

- No sidebar, no top bar, no theme switch, no Game mode, no bell, no avatar.
- No motion: the stars never move.
- Reads no session and no viewer: a doorway is shown to someone who may not be signed in.
- The pixel face only in the mark and, on `ask-device`, the code.

## Open questions

- Should the crest's link go to `/` (HOME) or to `/app` for someone already signed in? The spec
  says `/`.

## Source

/omni:brainstorm, PRD 1705: .omni-loop/delivery/shipped/1705-doorway/before-after.html
