---
prd: 394
title: HOME hero polish — aligned, readable, alive, full screen
blocked-by: none
spec: file
---

# HOME hero polish — aligned, readable, alive, full screen

**Date:** 2026-09-28 · **PRD:** #394 · **Touches:** HOME's poster in the galaxy app
(`apps/galaxy/src/home/poster/`, `apps/galaxy/src/home/home.css`). No migration, no change to the
kit, no change to the game at `/play`, and no change to the magazine spreads under the fold.

## Problem

The poster above HOME's fold (PRD 261) is the first thing a visitor sees, and on a desktop it reads
badly:

- **The text column looks misaligned.** The kicker ("THE DELIVERY FRAMEWORK FOR CODING AGENTS"),
  the headline ("AGENTS SHIP. YOU STEER.") and the quote ("TO JOIN INSTANTLY, SIGN UP WITH
  GITHUB!") are slanted with `transform: skewX(…)` from their bottom-left corner. A skewed box
  pushes its upper lines to the right, so "AGENTS SHIP." starts further right than "YOU STEER.",
  and none of the three starts on the left edge the pitch, the promises and Omni-man share.
- **The kicker is hard to read.** It is `--red` (#ff3b5c) on `--ad-purple` (#5b1a86), a contrast
  of about 3:1, under the 4.5:1 body text needs.
- **The planet stands still.** It swaps between three still frames of the invasion spreading; it
  never turns, and nothing moves in the sky. The game's own title screen turns its planet.
- **The hero does not fill the screen.** Its height is `min(100svh, 820px)`: on a tall desktop
  screen the next spread shows under it, and the column's content hugs the top of the purple.
- **The crest sinks.** On the starfield side the planet takes all the free height and the OMNI LOOP
  crest and PRESS START are pushed to the bottom, far from the planet.

## Solution

### 1. One left edge for the text column

- The kicker, the headline and the quote stop skewing their box. Their letters lean instead, with
  `font-style: oblique` at the angle of the design tokens' slant (`--type-display-s-slant`,
  `--type-display-xl-slant`), as the phone layout already does for the kicker and the quote.
- Every line of the column (the kicker's two lines, the headline's two lines, the pitch, the
  promises, the quote's two lines, Omni-man) starts on the column's left padding.

### 2. A readable kicker

- The kicker is `--cyan` on the purple. Red leaves the poster's text.
- Every text colour the poster sets on `--ad-purple` (the kicker, the headline, the pitch, the
  promises, the quote) has a contrast of at least 4.5:1 against it, measured with `@omni/design`'s
  `contrast()`.

### 3. The planet turns

- A small client component, `PosterPlanet`, draws the planet on a canvas with `@omni/design`'s
  `drawPlanet`, the same renderer and seed (`PLANET`) as today, at the same size, turning slowly
  (one turn in about 60 s, like the game's title planet).
- While it turns, the invasion keeps spreading as today: 25 %, then 50 %, then 80 % secured, a step
  every 1.5 s.
- Until the canvas has drawn its first frame, when JavaScript does not run, and when the visitor
  asks for reduced motion (`prefers-reduced-motion: reduce`), the three server-drawn SVG frames
  show exactly as today; under reduced motion the canvas is never mounted.
- The planet keeps its role and label ("A pixel planet, green patches of secured ground spreading
  across it: the invasion"). The canvas is `aria-hidden`.
- HOME stays static on the server: the page still reads no database and opens no session. The
  poster now ships two client components, `Controls` and `PosterPlanet`; the comments that say
  "one client component" say two.

### 4. Omni-man flies past

- Every 12 s, Omni-man (the `omni-cheer-cape` sprite from `@omni/design`: fist up, cape out, drawn on the server as
  an SVG like the pointing pose, tilted to follow his path) crosses the starfield from its left edge to its right on a gentle arc passing over the
  planet, in about 2.5 s, with a short plasma trail behind him, then is gone until the next pass.
- It is CSS only: no script moves him. He is `aria-hidden` and takes no clicks
  (`pointer-events: none`).
- Under reduced motion he never appears.
- On a phone (≤ 760 px) he flies too, across the starfield band at the top of the stacked poster.

### 5. Full screen on a desktop

- Above 760 px wide the poster is exactly `100svh` tall (at least its content's height) and the full
  width of the page. The 820 px cap goes.
- The text column's content, kicker to sign-up, is centred vertically in the purple.
- The phone layout (≤ 760 px) keeps its height and its order.

### 6. The crest sits under the planet

- On the starfield side the planet, the crest and PRESS START form one group, centred vertically:
  the crest right under the planet, PRESS START under the crest, with the same gaps as between the
  other items of the side (20 px).
- On a phone, the order stays as today (crest, headline, PRESS START, planet…).

## Decisions

- **Rotation is drawn in the browser, not pre-drawn.** Turning smoothly would need dozens of
  pre-drawn SVG frames, each a few tens of kilobytes of paths, in the page's HTML. A canvas running
  the game's own `drawPlanet` costs one small component and is how `/play` already turns its
  planets. The server-drawn frames stay as the fallback.
- **The flyby is CSS, not script.** It needs no state, no randomness and no timing the CSS
  animation cannot give, and it keeps working without JavaScript.
- **Omni-man flies in `omni-cheer-cape`.** Of the poses `@omni/design` draws (`omni`,
  `omni-point`, `omni-run`, `omni-run-cape`, `omni-cheer-cape`), the fist-up pose with the cape out
  reads as flying; chosen by the PRD's author from the rendered sprites. No new sprite is drawn.
- **Cyan, not yellow, for the kicker.** Yellow is already the quote, the dotted rule and the stars;
  cyan is the arcade's other accent and reads well on purple.
- **Oblique letters, not a compensated skew.** Offsetting a skewed box by hand breaks each time the
  font size changes (the headline is fluid); letters that lean keep every line on one edge.

## User stories

- As a visitor on a desktop, I land on a hero that fills my screen, with every line of the text
  column starting on one edge, so the pitch reads as one block.
- As a visitor, I read the kicker at a glance, without squinting at red on purple.
- As a visitor, I see the planet turn and, now and then, Omni-man fly past it, so the page feels
  like the game it leads to.
- As a visitor who asks for reduced motion, I see a still planet and no flyby.
- As a visitor on a phone, I get the stacked poster I get today, with Omni-man flying across the
  starfield band.

## Scope

**In:** the poster's text column styles, the kicker's colour, the rotating planet component, the
Omni-man flyby, the poster's desktop height and the starfield side's layout.

**Out:** the game at `/play` and its title screen; the magazine spreads; the poster's words; the
phone layout's order; any new colour token.

## Test seams

- **Poster markup** (a page test, `renderToStaticMarkup` of HOME as `home.test.ts` renders it):
  the flyby's Omni-man is present, `aria-hidden`, and holds the `omni-cheer-cape` sprite's SVG; the
  three server-drawn planet frames are still present inside the planet's labelled box; the kicker,
  the headline and the quote are still in the page with their words.
- **Contrast** (a unit test beside the poster): every (text colour, `--ad-purple`) pair the poster
  uses scores at least 4.5 with `@omni/design`'s `contrast()`; the pair list is exported from the
  poster module so the test and the stylesheet name the same colours.
- **The stylesheet** (a unit test reading `home.css`, like the design-system test reads
  stylesheets): no rule under `.home-poster` uses `skewX`; the kicker's colour is `var(--cyan)`;
  the desktop poster's height names `100svh` and no `820px`; the flyby and the planet's canvas are
  switched off under `prefers-reduced-motion: reduce`.
- **PosterPlanet** (a component test with a stubbed canvas and `matchMedia`): under reduced motion
  it mounts no canvas; otherwise it calls `drawPlanet` with the poster's seed and a `rot` that grows
  from one frame to the next, and with the progress steps 0.25, 0.5, 0.8 in turn.
- **The look** is checked by hand in a browser: 1440×900 and 1920×1080 (one left edge, full height,
  crest under the planet, planet turning, a flyby within 12 s) and 375×812 (the stacked poster as
  today, the flyby across the top band).

## Risks

- **What merging publishes.** A merge to `main` changes the galaxy app's HOME page, which Vercel
  deploys from this repository. No database, kit or plugin change ships with it.
- **Rollback.** Revert the feature PR's merge commit; the poster returns to its three still frames,
  the red kicker and the 820 px cap. Nothing is stored, so nothing needs undoing.
- **Performance.** `drawPlanet` redraws a 64-pixel-wide planet a few times a second; it reuses its
  last frame while the surface moves less than a pixel, and the component stops drawing when the
  tab is hidden. A slow phone costs little, and reduced motion costs nothing.
- **Motion sensitivity.** Handled by `prefers-reduced-motion`: no turning planet, no flyby.

## Acceptance criteria

1. On a desktop viewport (1440×900), the kicker's, the headline's and the quote's first lines start
   at the same horizontal position as the pitch (within 2 px), and no rule under `.home-poster`
   uses `skewX`.
2. The kicker is `--cyan`, and every text colour the poster sets on `--ad-purple` scores at least
   4.5:1 with `contrast()`.
3. Above 760 px wide the poster is `100svh` tall and the full width of the page, with the text
   column's content centred vertically; there is no 820 px cap.
4. On the starfield side, the crest sits directly under the planet (a 20 px gap) and PRESS START
   under the crest, the group centred vertically.
5. With motion allowed and JavaScript running, the planet turns (successive frames drawn with a
   growing `rot`) while the invasion steps through 25 %, 50 % and 80 % secured.
6. Without JavaScript, or under reduced motion, the three server-drawn planet frames show as today,
   and no canvas is mounted under reduced motion.
7. With motion allowed, Omni-man (`omni-cheer-cape`) crosses the starfield once every 12 s, is
   `aria-hidden` and takes no clicks; under reduced motion he never appears.
8. On a phone (375 px), the poster stacks in today's order, with Omni-man flying across the
   starfield band.
9. HOME still renders on the server with no Supabase call (`home.test.ts` stays green).
