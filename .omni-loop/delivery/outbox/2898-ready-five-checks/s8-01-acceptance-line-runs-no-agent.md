---
id: s8-01-acceptance-line-runs-no-agent
prd: 2898
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

When the screen tests cannot run in the continuous checks, a runner of the team runs them instead. Should that be a skill a person can also send from the Omni page, or a line only the Omni App sends?

## The decision, in plain words

A line only the Omni App sends. The runner runs the screen tests itself, with no assistant session, and the Send box refuses it, so the list of skills a person sends stays as it is.

## The intro, for fun

Some jobs need a thinker; this one only needs someone to press play.

## The punchline, for fun

So the runner presses play itself and lets the assistant sleep.

## The options, in plain words

A. A. A line only the App sends, run by the runner with no assistant: what was built.
B. B. A skill a person can send too, listed with the others, with its own folder and a database change.

## What I had to decide

Pick A to keep the line the App's own, or B to make it a skill a person sends too.

## What I did meanwhile

Built A. The kit's `APP_SKILLS` and the page's `APP_RUNNER_SKILLS` (`['acceptance']`) hold `/omni:acceptance <prd> --pr <n> --sha <sha>`; `checkRunnerLine` takes it, the claim's `RunnerJobSchema` takes it (`isAppLine`), and Send's `checkLine` refuses it. `kit/lib/runner/job.ts` runs it through `runAcceptance` (`kit/lib/runner/acceptance.ts`): fetch and detach on the commit, install, find the target, `e2e run --tag prd-<n>` with `E2E_TELEMETRY_DISABLED=1` and every key, token, secret and the preview's bypass masked, then one `omni-acceptance:` result line. `RUNNABLE_SKILLS`, the database's fixed skill list and the Runners guide are unchanged, so the plan's runner-skill migration was not needed and none was written.

## What it costs to change later

Making it a skill later is a plugin skill folder, its help entry, the name in `RUNNABLE_SKILLS` and `RUNNER_SKILLS`, the Runners guide's list and a migration of the fixed list; the runner's code stays.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) an account whose `takes` lists skills never takes the line, since `takes` names only the skills a person sends: a runner whose every account is limited that way fails the job
- (author) `e2eResultsOf` in `kit/lib/runner/acceptance.ts` reads the e2e run's report as `scripts/acceptance-report.ts` does; the two readers live apart because the kit cannot import the repository's scripts
