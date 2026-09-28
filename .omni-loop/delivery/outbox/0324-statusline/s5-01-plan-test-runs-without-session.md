---
id: s5-01-plan-test-runs-without-session
prd: 324
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 4
---

## The question, in plain words

One existing test checks a plan in this repository itself, and such a check now leaves a note of the PRD for the Claude session running it, so running the tests from a Claude session would leave that note in the real repository. Should that test change, though it sits outside this slice's ground?

## The decision, in plain words

Yes: that one test now runs without the session's id, so it leaves nothing behind in the repository. It checks the same plan as before, and nothing else in it changed.

## The intro, for fun

A test checked the real plan, and quietly left a sticky note on the desk.

## The punchline, for fun

Now it checks the plan and leaves the desk exactly as it found it.

## The options, in plain words

A. A. Change that one test so it runs without the session's id: the option built.
B. B. Leave the test as it was: a test run from a Claude session leaves a note naming PRD 7 for that session in the repository's own ignored folder, and its status line may then show PRD 7.
C. C. Leave the test, and have the command skip the note while tests run, which puts a rule for tests into the product.

## What I had to decide

Whether to change `kit/bin/plan.test.mjs`, outside s5's territory, so that its case "passes on this repository's own PRD 7 plan" passes `env: {}` to `main()`. That case runs `omni plan check 7` with this repository as its folder and the process's own environment. Once `omni` records the PRD a command names, a `pnpm test` run from a Claude session (which sets `CLAUDE_CODE_SESSION_ID`) wrote `{ "prd": 7 }` into the main checkout's `.omni-loop/local/sessions/`, and that session's status line would then read PRD 7 on `main`.

## What I did meanwhile

One line changed in that case, `main(['plan', 'check', '7'], { cwd: repoRoot, ...s, env: {} })`, with a two-line comment saying why; it still checks the same plan and passes. A full `pnpm test` run from this session now leaves no `.omni-loop/local/` in the main checkout (the record the first run left there was removed). No other test runs a command naming a PRD in this repository itself.

## What it costs to change later

One line in `kit/bin/plan.test.mjs` to revert. No stored data: records live only in the ignored `.omni-loop/local/` folder.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan puts `kit/bin/plan.test.mjs` in no slice's territory, and the spec's test seams do not say whether existing tests may record; the brief for this slice asks that tests never write into this repository's own local folder.
