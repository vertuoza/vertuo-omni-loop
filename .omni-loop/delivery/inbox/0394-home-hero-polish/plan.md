# Plan: HOME hero polish — aligned, readable, alive, full screen

PRD #394, spec beside this plan (`spec.md`). The feature branch `feat/home-hero-polish` merges into
`main` with `Closes #394`; each slice is a sub-PR from `feat/home-hero-polish--<slice>` into the
feature branch, with `Part of #394`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every line of the text column starts on one left edge, the kicker is cyan, the hero is 100svh on a desktop with its column centred, and the crest sits right under the planet | `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/poster/Poster.tsx` `apps/galaxy/src/home/poster/contrast` `apps/galaxy/src/home/poster/poster-css` | — | 1 |
| s2 | The planet turns on a canvas drawn with the game's own drawPlanet while the invasion spreads, the server-drawn frames staying as the fallback and under reduced motion | `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/poster/Poster.tsx` `apps/galaxy/src/home/poster/PosterPlanet` `apps/galaxy/src/home/Home.tsx` `apps/galaxy/src/home/Controls.tsx` | s1 | 2 |
| s3 | Every 12 s Omni-man flies past the planet across the starfield, CSS only, aria-hidden, and never under reduced motion | `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/poster/Poster.tsx` `apps/galaxy/src/home/poster/art.ts` `apps/galaxy/src/home/poster/art.test.ts` `apps/galaxy/src/home/poster/flyby` | s2 | 3 |

**Shared ground.** `home.css` and `poster/Poster.tsx` are declared by s1, s2 and s3, one per wave
(1, 2, 3): each slice adds its own block to the stylesheet and its own element to the poster. The
new files each slice creates start with a prefix only that slice names: `contrast` and `poster-css`
(s1), `PosterPlanet` (s2), `flyby` (s3). `home.test.ts` is left to no slice: each slice's markup
assertions go in its own test file under its own prefix.

## Per slice: done when

**s1: one edge, a readable kicker, full screen, the crest under the planet**
- No rule under `.home-poster` in `home.css` uses `skewX`; the kicker, the headline and the quote
  lean with `font-style: oblique` (a test reading the stylesheet, `poster/poster-css.test.ts`).
- The kicker's colour is `var(--cyan)`; the poster module exports the (text colour, `--ad-purple`)
  pairs it uses, and each scores at least 4.5 with `@omni/design`'s `contrast()`
  (`poster/contrast.test.ts`).
- Above 760 px the poster's height names `100svh` and no `820px`; the column's content is centred
  vertically (`align-content: center`).
- On the starfield side the planet, the crest and PRESS START are one group centred vertically,
  20 px apart; the phone rules (≤ 760 px) keep today's order.
- `home.test.ts` stays green; checked by hand at 1440×900 and 375×812.

**s2: the planet turns**
- `PosterPlanet` (a client component) under reduced motion mounts no canvas; otherwise it calls
  `drawPlanet` with the poster's seed and radius, a `rot` that grows from one frame to the next,
  and the progress steps 0.25, 0.5, 0.8 in turn, a step every 1.5 s (a component test with a
  stubbed canvas and `matchMedia`, `poster/PosterPlanet.test.ts`).
- It stops drawing while the tab is hidden and when it unmounts.
- The server-rendered markup still holds the three planet frames inside the planet's labelled box;
  the canvas is `aria-hidden`, and the frames are hidden only once the canvas has drawn.
- The comments in `Home.tsx` and `Controls.tsx` say the page ships two client components.
- Under `prefers-reduced-motion: reduce`, the stylesheet hides the canvas and shows the last frame,
  as today.

**s3: Omni-man flies past**
- `art.ts` draws the `omni-cheer-cape` sprite as an SVG for the flyby (`art.test.ts`).
- The rendered poster holds the flyby inside the starfield side, `aria-hidden`, with the sprite's
  SVG (`poster/flyby.test.ts`).
- The stylesheet animates it on a 12 s cycle, visible for about 2.5 s of it, with
  `pointer-events: none`, and switches the animation off (and hides it) under
  `prefers-reduced-motion: reduce`; on a phone it crosses the starfield band at the top.
- Checked by hand: a flyby within 12 s at 1440×900 and at 375×812.
