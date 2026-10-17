---
prd: 2063
title: "OMNI KART: the player sees their own skid marks"
blocked-by: none
spec: file
phase0: server
---

# OMNI KART: the player sees their own skid marks

## Problem

PRD 1963 gave every kart skid marks: two at its rear wheels each step it skids or drifts, white on ice and powder, dark
on road, fading out over `MARK_LIFE` = 3 seconds, at most `MAX_MARKS` = 96 alive (`kart/fx.ts`). The player sees the
rivals' marks, ahead of them. They never see their own.

Measured on a recording canvas over a whole drift on COMET RING (the drift of `art.sparks.test.ts`, 69 frames), the
player's own marks show **0 pixels in 0 of 69 frames**, on the wide grid (640×360) and on the tall one (320×288). The
geometry explains it:

- `marksOf` lays a kart's marks at its rear wheels, `BEHIND` = 8 world px behind its middle.
- The chase camera (`cameraFor`) stands where the floor under the kart's middle lands on the row its sprite's wheels touch,
  `KART_FOOT` = 6 rows above the screen's edge: 66.3 world px behind the kart on the wide grid, 41.7 on the tall one. The
  bottom row is 64.7 and 40.4 world px ahead of it: the screen shows about **1.5 world px** of floor behind the kart's middle.
- The kart's shadow is drawn after the marks, over the floor under the kart, and its sprite over that.

Issues 2057 and 2061 fixed the same root for the player's drift sparks and for their BOOST trail, snow and wind: those are
now born under the kart's middle. The marks were left out on purpose: making them show is a look decision.

## Solution

1. **Where the player's marks are laid.** `marksOf` lays the player's two marks (racer 0, `race.player`) at its rear
   wheels **under its middle**, `wheelsOf(kart, 0)`: where its sprite draws its rear wheels, and where its drift sparks are
   born since issue 2057. A rival's marks stay at `BEHIND` = 8 world px behind its middle, as today. When a kart leaves
   marks does not change: travel more than `RULES.skidGap` off its heading, or a drift, on the ground, at a speed of 1 or
   more.
2. **Which marks are the player's.** A `Mark` the player's kart lays carries `own: true`; a rival's carries no `own`. The
   flag is the only change to the shape: `x`, `y`, `age` and `pale` keep their meaning.
3. **Where they are drawn.** `marksOnFloor` draws the rivals' marks where it does today, before the player's kart. The
   player's own marks are drawn by `playerKart` **after its shadow and before its sprite**: they lie over the shadow, under
   the kart. They show in the rows between the sprite's bottom and the screen's edge, just under its rear wheels.
4. **Nothing else about a mark changes:** its size (1.6 world px, at least 1 screen px), its colour (`white` when pale,
   `navy-dark` on road), its fade (0.8 × what is left of its life), `MARK_LIFE` = 3 s and `MAX_MARKS` = 96, the player's
   marks still counting towards that cap. Reduced motion draws them as it does today: marks do not move.

Measured with the same drift, the player's marks then show in **69 of 69 frames on both grids**: 11 099 pixels in all on
the wide grid, 8 151 on the tall one.

## Decisions

- **Option B, picked by the person** (2026-10-15) among four, each measured over the drift above, on both grids, with
  crops of each drawn on real canvases:
  - **B, under the kart, over its shadow** (this PRD): 69/69 frames, wide 11 099 px, tall 8 151 px.
  - C, as B, twice as wide: 69/69 frames, wide 22 093 px, tall 18 796 px; reads more as a dark smear under the kart than
    as two tyre tracks.
  - D, the kart higher on the screen (`KART_FOOT` 6 → 40): 69/69 frames, wide 51 161 px, tall 23 912 px, real trailing
    tracks; but it reframes the whole race (the camera 11 world px further back on the wide grid, the player's sprite no
    longer at the world's scale beside the rivals'). A camera change of its own, not this one.
  - Won't do: only the rivals' marks show.
- **Ruled out by measuring, not offered:** marks that last 10 s (0 px during the drift), 2.5 × wider and 10 s (0 px), marks
  at today's place drawn over the shadow (0 px), marks under the middle drawn under the shadow (wide 5 of 69 frames, 44 px).
  A mark's life and size cannot help while it is laid where the camera never looks. Joining each wheel's marks into one
  band changed little (wide 11 887 px against 11 099), so the marks stay squares.
- **The rivals' marks do not move.** They are seen from behind, ahead of the player, and trail behind them as they should.
- **The player's marks over its shadow on road** have about half the contrast a dark mark has on bare road (the shadow
  darkens the road under it). Accepted with B, from the crops; on ice and powder the marks are white and clear.
- **`MAX_MARKS` stays 96, shared.** It is 0.8 s of one kart skidding (two marks a frame). During the measured drift the
  player's marks held 82 of the 96 slots on average, 96 at most, so a long skid of the player pushes out the rivals' oldest
  marks. That is today's behaviour, kept on purpose here.
- **No proof video:** asked, the person said no. The marks live in six rows at the screen's edge during a driven drift;
  the pixel tests below measure them.
- **The voice.** persona:B-E DEv objected that a whole PRD for two marks of six pixels under a kart is the gimmick they
  expected. The person approved the design without answering it (`none`).

## User stories

- As a player drifting round a bend, I see my own tyres mark the road under my rear wheels, so I feel the slide as I do
  when a rival drifts ahead of me.
- As a player on FROST EIGHT's ice or powder, I see my own white marks under my kart while it slides.

## Scope

In:

- `kart/fx.ts`: `Mark.own`, and `marksOf` laying the player's marks under its middle.
- `kart/art.ts`: the player's own marks drawn after its shadow, before its sprite; the rivals' as today.
- The tests below.

Out:

- The rivals' marks, the cap `MAX_MARKS`, `MARK_LIFE`, a mark's size and colour.
- The camera, `KART_FOOT` and the kart's place on the screen (option D).
- The other effects (sparks, trail, snow, wind, smoke), fixed by issues 2057 and 2061.
- MULTI's messages: marks are drawn from each screen's own race and never sent.

## Test seams

- **`kart/fx.test.ts`, a unit test of `marksOf`:** a skidding player lays its two marks at its middle, 3 world px either
  side across its heading, with `own: true`; a skidding rival lays its two at 8 world px behind its middle, 3 either side,
  with no `own`. Today the player's are 8 behind: red.
- **`kart/art.sparks.test.ts`, the pixel test of the screen**, beside the sparks', trail's, snow's, wind's and smoke's,
  reusing its harness (`lastOf`, a scripted drive, a pure race stepped beside the game to say when the kart lays marks): a
  `marks` drive on COMET RING (the drift), and a measure of the rows between the player's sprite and the screen's edge,
  across its sprite and a sprite's width either side, where only floor nearer than the kart is drawn. On the wide grid and
  on the tall one, the marks' colour shows there in at least 3 frames of 4 while the kart lays marks, and on average at
  least a 2×2 block of the sprite's own pixels a frame. Today: 0 frames. Red.
- **The rivals' marks:** the existing `marksOf` tests keep their counts and colours; the new unit test pins a rival's
  place.
- No acceptance scenario: the repository's acceptance harness is off.

## Risks

- **The rivals' marks.** A slip in `marksOf` could move theirs too. The unit test pins a rival's marks 8 behind it.
- **The frame's cost.** No mark more is laid or drawn: the same list is split in two passes.
- **The look on road.** The player's dark marks lie on its shadow, at about half the contrast of a mark on bare road
  (Decisions).
- **What merging publishes:** the galaxy app's arcade, deployed to production by the release commit that follows the
  merge (`omni kb show releasing`). No migration, no change to the kit, the GitHub App, a board or MULTI's messages.
  Rolled back by reverting the feature PR.
- **The locked laws: none touched.** `omni kb laws` prints all twenty for every file here, none scoped by path. The two
  nearest hold: N-PRODUCT-16, the game's ledger only added to, because no score, time or ledger row is written; N-PRODUCT-17,
  no secret in the browser, because the change is the arcade's own drawing code and nothing is fetched.

## Acceptance criteria

1. On COMET RING, through a drift (`art.sparks.test.ts`'s drift: the start straight at full speed, a hop into a drift held
   until it ends), the player's own skid marks show under its kart, between its sprite and the screen's edge, in at least
   3 frames of 4 in which its kart lays marks, and on average at least a 2×2 block of the sprite's own pixels a frame: on
   the wide grid (640×360) and on the tall one (320×288).
2. A skidding player's two marks lie under its middle, 3 world px either side across its heading, and are its own
   (`own: true`).
3. A skidding rival's two marks lie 8 world px behind its middle, 3 either side, as today, are not the player's, and are
   drawn before the player's kart.
4. The player's marks are drawn after its shadow and before its sprite.
5. `MAX_MARKS` is still 96 and `MARK_LIFE` still 3 seconds; a mark's size, colour and fade are today's, with motion and with
   motion reduced.
6. A kart in the air (a hop, a fall) or slower than 1 lays no mark, as today.
