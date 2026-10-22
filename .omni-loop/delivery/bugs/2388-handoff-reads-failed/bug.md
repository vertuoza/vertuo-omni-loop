# Bug 2388: a runner job that printed its hand-off reads Failed when its session ends without an exit code

## Triage

- **Domain:** runner (`kit/lib/runner`): how a job's end status and outcome are read from its log
- **Risk:** medium — a person sees a red Failed (and a released claim) for a PRD that only waits on them; the log's hand-off says the truth, so there is a workaround
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/commands/runner.test.ts`, `kit/lib/runner/log.test.ts` (the cases named #2388)
- **Level:** unit
- **Red:** AssertionError: expected { status: 'failed', …(6) } to match object { status: 'done', …(3) }

## Fix

The runner marked any job whose session ended before writing its exit code as failed, even when the agent had already printed its hand-off, and the outcome reader only looked at the log's very last line, which a failed `SessionEnd` hook's message could take. Now a session that ends without an exit code but after a yolo hand-off reports done with that outcome (Held, Waiting on answers or Ready), keeping the reason, and the outcome reader skips failed hook lines.

## Guard

The two #2388 tests: a session that dies after printing its hand-off, and a hand-off followed by a failed hook's line. Both fail on main and pass here.

## Mutation

mutation: no changed core file against origin/main (7e070540): nothing to mutate
