# Plan: OMNI KART, the player sees their own skid marks

PRD #2063, specified in `spec.md` beside this plan. Built on the feature branch `feat/kart-own-skid-marks` into `main`,
whose PR says `Closes #2063`; the slice is a sub-PR from `feat/kart-own-skid-marks--s1` into the feature branch, saying
`Part of #2063`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The player's own skid marks are laid under its rear wheels and drawn over its shadow, under its sprite, on the wide and the tall grid; the rivals' marks stay as today | `apps/galaxy/src/arcade/kart/fx.` `apps/galaxy/src/arcade/kart/art.` `apps/galaxy/README.md` | — | 1 |

**Shared ground.** None: one slice. Where a mark is laid (`fx.ts`) and where it is drawn (`art.ts`) are one path: laid
under the middle but drawn under the shadow, the marks show in 5 of 69 frames on the wide grid (the spec's Decisions),
so neither half is verifiable alone. The prefix `apps/galaxy/src/arcade/kart/art.` holds `art.ts` and every
`art.*.test.ts`, the pixel tests that draw a whole frame (`art.test.ts`, `art.sparks.test.ts`, `art.snow.test.ts`,
`art.circuit.test.ts`); `apps/galaxy/src/arcade/kart/fx.` holds `fx.ts` and `fx.test.ts`. `apps/galaxy/README.md`
describes the marks under **What a player sees and hears**.

## Per slice: done when

**s1** (`ui: yes`)

- `kart/fx.test.ts`: a skidding player's two marks lie at its middle, 3 world px either side across its heading, with
  `own: true`; a skidding rival's two lie 8 world px behind its middle, 3 either side, with no `own`. Red before the
  change (the player's are 8 behind), green after.
- `kart/art.sparks.test.ts`, a `marks` drive beside the sparks', trail's, snow's, wind's and smoke's, with the same
  harness (`lastOf`, the scripted drift on COMET RING, a pure race stepped beside the game to say when the kart lays
  marks): on the wide grid (640×360) and on the tall one (320×288), the marks' colour shows in the rows between the
  player's sprite and the screen's edge, across its sprite and a sprite's width either side, in at least 3 frames of 4 in
  which the kart lays marks, and on average at least a 2×2 block of the sprite's own pixels a frame. Red before (0
  frames), green after.
- The player's own marks are drawn after its shadow and before its sprite; the rivals' are drawn before the player's
  kart, as today. A test pins that order on the recording canvas.
- `MAX_MARKS` is still 96 and `MARK_LIFE` still 3; a mark's size (1.6 world px, at least 1 screen px), colour (`white`
  when pale, `navy-dark` on road) and fade are today's, with motion and with motion reduced. The existing `marksOf` and
  `stepMarks` tests pass unchanged.
- A kart in the air (a hop, a fall) or slower than 1 lays no mark, as today.
- `apps/galaxy/README.md` says the player's own marks lie under its rear wheels, over its shadow.
- The design review compares the built frame with the crops in `before-after.html` (screen `kart-race`).
