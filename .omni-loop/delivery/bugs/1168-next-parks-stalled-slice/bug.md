# Bug 1168: omni next waits forever on a slice abandoned in a draft sub-PR instead of parking it

## Triage

- **Domain:** loop drive — the `omni next` verdict (`kit/lib/next/decide.ts`, `kit/bin/commands/next.ts`, PRD 1139)
- **Risk:** high — anyone driving a PRD with `/loop /omni:drive`: a slice abandoned in a draft sub-PR makes the loop tick every 20 minutes forever, spending tokens and never telling a person; the only workaround is to notice it and close or take over the sub-PR by hand (Jev, 0.44)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/next.test.ts`
- **Red:** `expected "wait" to be "park"`: `omni next 7 --json` on a draft sub-PR whose last commit is 5.5 days old printed `{ "verdict": "wait", "why": "another session holds the claim on s1", "wakeHint": 1200, "link": "https://github.com/acme/widgets/pull/9" }`

## Fix

`decideNext` read every `in-flight` slice as a claim another session holds, so a draft sub-PR with commits beyond its claim and nobody behind it was waited on forever. `omni next` now marks an in-flight slice whose sub-PR's head commit is `limits.stallDays` old or older as stalled (the kit's own meaning of a stall, as `deriveStatus` reads it), and the verdict parks on a person, naming the sub-PR, the day of its last commit, that it must be taken over or closed, and its link. A recent claim still waits; takeable slices still act first.

## Guard

The `stalledSlices` and stalled-verdict rows of `kit/lib/next/decide.test.ts`: 7 failed on the default branch's `decide.ts`, all pass on the fix. They catch any in-flight slice past `stallDays` read as a held claim again.

## Mutation

mutation: no changed core file against origin/main (1c139ef7): nothing to mutate
