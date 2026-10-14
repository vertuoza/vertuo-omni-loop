# Settled outbox items — PRD 1883

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-runner-runs-its-own-omni -->

## s1-01-runner-runs-its-own-omni — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-14T07:27:41Z
- Channel: feature pull request #1884
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1884#issuecomment-6163208662
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-12
- Raised: 2026-10-14
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built and states nothing new about the product; N-PRODUCT-12 reads as before.

### The answer, as it was given

```text
1: A
```

### The item, as it was raised

```text
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
```

<!-- /omni-outbox-settled: s1-01-runner-runs-its-own-omni -->
