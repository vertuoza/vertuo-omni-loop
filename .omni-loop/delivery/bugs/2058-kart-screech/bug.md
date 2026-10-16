# Bug 2058: OMNI KART: the tyre screech while drifting sounds like a harsh buzzer and stutters

## Triage

- **Domain:** OMNI KART's sound: the arcade's Web Audio engine (`apps/galaxy/src/arcade/sound.ts`, `screech()`) and the race's skid level (`apps/galaxy/src/arcade/kart/race.ts`, `skidOf()`)
- **Risk:** low — every player who drifts or slides in OMNI KART hears a harsh, clicking buzzer instead of a tyre screech; nothing breaks, and muting the sound is a workaround (Jev, 0.56)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/sound.test.ts`
- **Red:** AssertionError: expected [ Osc{ type: 'square', …(2) } ] to deeply equal []

## Fix

The screech (PRD 1963) was a 1400 to 1820 Hz square wave switched on at full level, and its level
leapt from 0 to 0.44 at the skid gap, so a kart on the edge of a slide stopped and restarted it every
few frames, each start a click. It is now the arcade's noise through a band-pass whose band rises with
the level, fading in from silence; a level of 0 only fades it, `null` stops it; and `skidOf` rises
from silence at the skid gap to its loudest at 0.6 rad, a drift screeching at least 0.25.

## Guard

`apps/galaxy/src/arcade/kart/race.test.ts`: sweeping the gap from 0 to 1 rad in 0.01 steps, the
level never moves by 0.05 or more between neighbours. Red on the default branch ("between 0.15 and
0.16 rad: expected 0.45000000000000007 to be less than 0.05"), green on the fix branch.

## Mutation

mutation: no changed core file against origin/main (4219a898): nothing to mutate
