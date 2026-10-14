---
id: s1-01-runner-runs-its-own-omni
prd: 1883
slice: s1
rank: high
bears-on: N-PRODUCT-12
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The test file that proves omni answers quietly where the loop is not installed now also checks a new exception: a runner, and every job it starts, runs as the runner's own copy of omni, never the copy pinned in the job's folder. The rule about folders without the loop is untouched. Is that fine?

## The decision, in plain words

A runner and its jobs always run the runner's own copy of omni, because a job's fresh folder cannot run its own copy before it is installed. Every other command still runs the copy the folder pins.

## The intro, for fun

The runner tried to borrow a fresh worktree's omni, and it had not even unpacked.

## The punchline, for fun

So the runner now packs its own lunch.

## The options, in plain words

A. A runner and its jobs run the runner's own copy, and that file checks it (built).
B. Keep that file as it was, and check the runner's exception in a file of its own.

## What I had to decide

N-PRODUCT-12 (run where the loop is not installed, omni reads nothing and exits 0; other commands still refuse) is enforced by `kit/lib/launch/launch.test.ts`, among others. The range adds one test to that file, for the launcher's new exception (`runner` never hands over), and changes none of the checks that prove the law.

## What I did meanwhile

The branch's launcher runs `omni runner` and `omni runner job` itself, and `launch.test.ts` checks that, beside its unchanged checks of N-PRODUCT-12.

## What it costs to change later

Moving one test into a file of its own, or removing one condition in the launcher.

## What I could not know

- Whether a runner's job should rather run the job repository's pinned kit once it is installed; the fix picks the runner's copy because the wrapper only installs and starts the agent, and the job's own skills then use the repository's own omni (author).
