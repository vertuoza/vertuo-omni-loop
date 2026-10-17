# Bug 2156: OMNI DUET's gate beside a centre block leaves too little time to change pose

## Triage

- **Domain:** arcade · OMNI DUET's waves (`apps/galaxy/src/arcade/duet/waves.ts`)
- **Risk:** medium — players of OMNI DUET meet a near-exact pose change in chapter I's fourth wave (and waves 7, 10, chapter IV's 9th, some endless waves) and lose lives; each wave stays passable with exact timing, so play is not blocked.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/waves.test.ts`
- **Red:** "DRIFT wave 4, line 3: gate → centre, 0.28 s"

## Fix

The spacing rule asked every change of pose for a quarter turn's time plus a reaction, as if each still obstacle asked its pose at one height; a gate holds the pair upright while it crosses the whole circle, so beside a gate the moment to start the turn shrank to 0.20–0.28 s, against 0.6 s or more beside a half bar. The rule now asks a change of pose beside a gate `SHAPE.gate.hold` (1.75 R) more (`holdSpace`), chapter I's waves 4, 7 and 10 and chapter IV's wave 9 stand their gates 3 to 3.45 R from the change, and endless mode spaces its gates by the same rule.

## Guard

The spacing rule itself (`spacingProblems`, and endless mode's `gapOf`) now counts a gate's hold, with a unit test of `holdSpace`; the reproduction measures, for every change of pose between two still obstacles in the chapters and the first 200 endless waves, how long the moment to start the turn is, and refuses one under 0.55 s.

## Mutation

mutation: no changed core file against origin/main (4d85fa29): nothing to mutate
