# Bug 1754: OMNI DUET waves leave no room to time a move, even played perfectly

## Triage

- **Domain:** arcade · OMNI DUET (`apps/galaxy/src/arcade/duet`, PRD 1633)
- **Risk:** medium — players of OMNI DUET lose lives on waves they play right: the gate and the half bar ask a release of ◀ or ▶ within about ±50 ms, and the passability check never measured timing; the waves stay passable, the rest of the arcade is untouched. (Jev, 0.66)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/waves.test.ts`
- **Red:** on the old gate (0.8 R gap) and half bar (R/3 short): `× leaves room to time each move: every chapter wave passes with each change of what is held landing up to 0.15 s late` — `AssertionError: expected [ …(12) ] to deeply equal []`, first `"chapter I · DRIFT, wave 4: no human way through"`.

## Fix

The passability check proved each wave passable only for a person changing ◀, ▶ or nothing at the
exact sub-step, so a gate or a half bar could ask a stop at upright within about ±50 ms. It now also
plays a person whose every change lands up to `RULES.lateSeconds` (0.15 s) late, the worst for them;
the gate's gap widens from 0.8 to 1 R and the half bar stops 0.45 R short of the centre line instead of
R/3, which gives every chapter wave that room. Endless mode keeps its 170 px/s ceiling and gets
`RULES.endlessLateSeconds` (0.12 s): its group gaps count that time, a change inside a group keeps
chapter IV's time past its top speed, and the longest wave goes from 8 to 8.5 s.

## Guard

The late check itself, with its own test (a fast chain of rods passes on time and is named late), run
on every chapter wave at 0.15 s and on the first 200 endless waves at 0.12 s.

## Mutation

not set here
