# Bug 2590: a planned handoff's note says a person rejected the command the runner stopped

## Triage

- **Domain:** kit runner, turnover (`kit/lib/runner/turnover.ts`, `notePrompt`)
- **Risk:** medium — the next account starts from a note telling it to ask why a person refused a command, so it may hold the job or ask a person instead of carrying on; the job itself still turns over
- **Regression:** new bug — no evidence this ever worked (the planned handoff came with #2570, PRD 2537 s8)

## Reproduction

- **File:** `kit/lib/runner/turnover.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 'Write the handoff note for whoever co…' to contain 'The runner stopped your run, not a pe…'

## Fix

The runner stops an agent mid-run for a planned handoff, then resumes its session to ask for its note. The
prompt only asked for the note, so the agent read the stop as a person refusing its command, and said so.
The prompt now opens with who stopped the run and why (the handoff's own reason, passed in by both
planned handoffs), and says a command cut short is unfinished, not refused.

## Guard

The reproduction: a unit test on `notePrompt` that fails when the prompt stops saying the runner, not a
person, stopped the run, and the two acceptance tests that check the resumed session's prompt carries the
handoff's reason.

## Mutation

mutation: no changed core file against origin/main (87557a72): nothing to mutate
