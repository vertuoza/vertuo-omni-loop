# Bug 3371: a product PRD merged into main through its mission's PR never reads shipped, so a mission holds a PRD that blocks on it

## Triage

- **Domain:** missions (`apps/omni-app/src/missions`: a product build held on another PRD) and `/omni:ultra-yolo`'s `blocked-by` check
- **Risk:** medium — a mission at Works alone stops and waits on a person for a PRD that is already on its branch; the workaround is a person adding the PRD to the scope or taking the build by hand.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/job.product-landed.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [] to include 'omni-loop-27 on mission/19-settings'` (the mission never asked whether omni-loop-27 was on its branch, and waited on a person)

## Fix

omni-loop-27's target pull request merged into mission #3270's branch, and that mission's pull request squash-merged into `main`, so its own merge commit is on no branch mission #3319 holds, and its page state reads `inbox` whatever merged. `/omni:ultra-yolo` had no defined check for a `blocked-by` PRD, guessed a folder and held; the mission then read omni-loop-27 as outside its scope and off its branch, and waited on a person. Now `omni prd <key>-<n> --landed-in <ref>` (`kit/lib/ultra/landed.ts`) says whether a PRD's merged work is in a base, through its own merged pull requests or the mission pull request that merged their base onward, and the skill checks each blocker with it; the mission asks GitHub the same (`missionJoins.landed`) for a PRD outside its scope that a build held on, and sends such a build again as its next run, once.

## Guard

`kit/lib/ultra/landed.test.ts`, `kit/bin/prd-landed.test.ts` and `apps/omni-app/src/missions/join.landed.test.ts` on omni-loop-27's shape (target pull request into a mission branch, mission pull request squash-merged into main); `apps/omni-app/src/missions/supervisor.product-landed.test.ts` (sent again once, a second hold read as held twice); `kit/test/ultra-yolo-landed.test.ts` (the skill asks the kit, never a guessed path or the page state alone).

## Mutation

mutation: no changed core file against origin/main (e9e8e3cc): nothing to mutate

## Still open

- A product PRD never reads shipped: omni prd <key>-<n> derives its state from its approval alone, so omni-loop-27 and omni-loop-35, both merged into main, still read inbox; recording a product PRD's shipped stage needs a stored stage the server does not keep yet.
