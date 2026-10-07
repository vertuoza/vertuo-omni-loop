# Bug 1178: /omni:wave merges a sub-PR past its unresolved review threads

## Triage

- **Domain:** delivery loop — `/omni:wave` step 4 (merge) and `omni care state` (`kit/plugin/skills/wave/SKILL.md`, `kit/lib/care/decide.ts`, `kit/bin/commands/care.ts`)
- **Risk:** medium — teams whose repository has an automated reviewer get its findings on sub-PRs merged past silently into the feature branch (a real migration bug on vertuoza/vertuo-backend-php#6486); the workaround is a person triaging every sub-PR's threads by hand before the wave merges
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/care.test.ts`
- **Red:** `AssertionError: expected { mode: 'report-only', …(1) } to deeply equal { mode: 'act', actions: [ { …(2) } ] }`: `omni care state 7 --pr 22` on an open sub-PR with an unhandled review thread, while the wave holds its claim, printed the feature PR's `report-only` round (a `status` action alone), so nothing judged the thread; and `expected { mode: 'report-only', …(1) } to deeply equal { mode: 'hold', actions: [], …(1) }` for a thread left asked

## Fix

The kit assumed a sub-PR is never reviewed: the wave merged a ready sub-PR through its gate whatever its threads, and `care state --pr` on a sub-PR only ever drew the feature PR's round, which reports only while a wave holds claims. `care state --pr <n>` now recognises a sub-PR (one of the board's slice PRs), names its `slice`, and draws a sub-PR's round (`decideSubPrRound`): `act` with its `judge` and `mark-asked` actions, `hold` with the threads left asked, `clear`, or `stop`, whatever the wave's claims, CI and conflict say. `/omni:wave` step 4 gains item 5, **Review threads**, before the gate: it carries out that round exactly as `/omni:pr-care` §3 judges a feature PR's threads, and a held sub-PR is not merged and is reported while its siblings merge. `/omni:pr`, `/omni:pr-care`, `/omni:ultra-wave`'s item pointer, the guide (`loop.md`, `flow.md`) and the porting notes say so. The wave waits for no review not yet posted (recorded in `kit/porting/plugin--wave.md`).

## Guard

A rule in `kit/test/plugin.test.ts`: `/omni:wave` step 4 reads `care state <prd> --pr <n>` after **Ready** and before **Merge, through the gate**, judges through `/omni:pr-care`'s **3. Review threads** and `omni care reply`, holds an asked thread in **Not merged**, and its guardrails forbid merging a sub-PR before its threads are read. It fails on the default branch's wave skill and passes on the fix.

## Mutation

mutation: no changed core file against origin/main (611c1c17): nothing to mutate
