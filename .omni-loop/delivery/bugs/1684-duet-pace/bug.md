# Bug 1684: OMNI DUET — waves are long and chapter I barely asks anything; the upright bars are not Duet's

## Triage

- **Domain:** OMNI DUET's waves (`apps/galaxy/src/arcade/duet/waves.ts`, PRD 1633)
- **Risk:** low — the game plays, but chapter I is slow and long enough to bore a player before it asks anything.
- **Regression:** new bug — found playing after #1681

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/waves.test.ts`
- **Red:** `× keeps every wave short: 8 seconds at most from its first obstacle entering to its last passing the orbs` — `AssertionError: expected [ 'DRIFT wave 1: 16.32 s', …(39) ] to deeply equal []`: on main every one of the 40 chapter waves lasts more than 8 s, and chapter I's first wave is passed holding still.

## Fix

The upright bar is gone: the vocabulary is the half bar (left or right) and the centre block, each still,
sliding or turning. Waves fall about twice as fast, about 2 R a second as Duet's clones do: chapter I at
95–113 px/s, II 105–123, III 115–133, IV 125–143, endless from 145 rising by 1 every 5 waves to 155. The
turn stays at 0.6 turns a second. Every wave is short (3–5 obstacles in chapter I, up to 6 after, at most
8 s) and asks a move from the first: chapter I's ten waves take 72.8 s in all, each with at least two
changes of pose.

## Guard

`waves.test.ts` checks every wave lasts 8 s at most, chapter I 75 s at most, every wave (each chapter's
first included) fails if the orbs are held still, the vocabulary holds no upright bar, and the speed
ranges per chapter; the per-kind pose test, the spacing rule and the human passability check (with its
room to spare) gate every chapter wave and the first 200 endless waves at the new speeds.

## Mutation

mutation: not run (arcade only, no delivery-core file changed)
