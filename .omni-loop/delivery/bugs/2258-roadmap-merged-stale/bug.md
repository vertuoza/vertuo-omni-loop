# Bug 2258: a merged PRD still reads as waiting for merge on its roadmap's page

## Triage

- **Domain:** Roadmaps — the roadmap page in the Omni app (`apps/galaxy/src/roadmap/page/`)
- **Risk:** medium — people following a roadmap see a merged PRD as waiting for their merge and the roadmap as unfinished, until someone reruns `omni roadmap push` by hand (Jev, 0.87)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/roadmap/page/load.test.ts`
- **Red:** AssertionError: expected [ [ 'ready', null ] ] to deeply equal [ [ 'merged', null ] ]

## Fix

A roadmap's rows only changed on `omni roadmap push`, which `/omni:drive` runs while it drives; a
person's merge after the drive stopped was never pushed, so the page kept the PRD waiting for merge
(roadmap 1799, PRD 1798, PR #2172). The page now also reads each pending PRD's shipped stage, which the
app records from the merge itself, and shows that PRD as merged, ended at its merge; a PRD closed
unmerged stays closed, and stages that cannot be read leave the rows as pushed.

## Guard

none — the gap was a read the page never made, not a pattern a check script or a lint rule can spot;
the reproduction's tests pin it

## Mutation

mutation: no changed core file against origin/main (0adfa87e): nothing to mutate
