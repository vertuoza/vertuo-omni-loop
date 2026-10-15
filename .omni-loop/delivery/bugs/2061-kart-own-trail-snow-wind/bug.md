# Bug 2061: OMNI KART: the player's own BOOST trail, snow, wind and smoke are born behind the chase camera's view

## Triage

- **Domain:** OMNI KART › the race's drawing: the particles (`apps/galaxy/src/arcade/kart/fx.ts`, `art.ts`; PRD 1963, PRD 1427 slice 7)
- **Risk:** low — cosmetic: BOOST, powder and the slipstream work and are still felt and heard, but the player never sees their own trail, snow and wind on the tall grid, and only a sliver of them under the kart on the wide one (Jev, 1.00)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/art.sparks.test.ts`
- **Red:** AssertionError: expected 5 to be greater than or equal to 33.75 (trail, wide grid); AssertionError: expected 747 to be greater than or equal to 3072 (snow, wide grid); AssertionError: expected 286 to be greater than or equal to 3328 (wind, wide grid); AssertionError: expected 0 to be greater than or equal to 33.75, 9 and 9.75 (trail, snow and wind, tall grid)

## Fix

Every racer's trail, snow and wind were born 8 world pixels behind its middle. The camera sits
about 66 pixels behind the player's kart on the wide grid and 42 on the tall one, so for the
player that point lands below the kart's wheels (wide) or below the screen (tall), and it only
gets further behind as the kart drives on. Now the player's own trail, snow and wind are born at
its middle, where its sprite draws its rear. Issue 2057's draw order then puts them over the
kart while they are nearer the camera. A rival's are still born 8 pixels behind it, where they
show under its sprite. The smoke of a stall was measured visible on both grids, because a
stalled kart stands still and the smoke rises, so it is unchanged. The particle cap is unchanged.

The player's own skid marks are hidden too: through a whole drift they show 0 pixels on both
grids. They are left alone. Born under the wheels, they would show in only 5 of 60 frames on the
wide grid: the camera sees about 1.5 world pixels of floor behind the kart, and the kart's
shadow and sprite cover the rest. How the player sees its own marks needs a decision.

## Guard

The reproduction runs one scripted drive per effect on both grids: a rocket start's BOOST, full
speed onto FROST EIGHT's powder, the slipstream behind the rival in front on the grid, and a
stall. A race stepped beside the game says in which frames the kart throws the effect. The test
checks that, over the kart's sprite and down to its wheels, some of the effect shows in three
frames out of four, and on average at least a 4×4 block of the sprite's pixels. A unit test in
`fx.test.ts` pins where they are born: at the player's middle, 8 behind a rival's. Trail, snow
and wind fail on the base's code, on both grids; smoke passes on both.

## Mutation

<filled after the mutation run>
