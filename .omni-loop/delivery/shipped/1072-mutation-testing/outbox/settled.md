# Settled outbox items — PRD 1072

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-mutation-timeout -->

## s1-01-mutation-timeout — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-04
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-mutation-timeout
prd: 1072
slice: s1
rank: medium
bears-on: none
raised: 2026-10-04
wave: 1
---

## The question, in plain words

How long may a changed copy of the code run its tests before we call it stuck and count it as caught?

## The decision, in plain words

Five seconds beyond the time its tests normally take. A stuck copy counts as caught, so a longer wait makes the run slower but the score a little more honest.

## The intro, for fun

Some changes to the code do not fail the tests, they just make them wait forever.

## The punchline, for fun

We gave them five polite seconds before calling it a win.

## The options, in plain words

A. Five seconds beyond the tests' measured time, Stryker's default, the option built.
B. Ten seconds, for fewer slow healthy runs counted as caught, at the price of a longer run.
C. Sixty seconds, for the most honest timeouts at the price of a much longer run.

## What I had to decide

How long a mutant may run beyond its tests' measured time before Stryker counts it as timed out, which counts as detected in the score.

## What I did meanwhile

timeoutMS is 5 000 in stryker.config.ts (10 000 at first; the person asked for a faster run after the first full run crawled): one constant, no migration.

## What it costs to change later

One constant. A higher value makes each run longer (the first try with 60 s spent most of the ids.ts proof waiting on 23 timed-out mutants); a lower one can count a slow but healthy run as caught.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether 5 s is enough on CI's runner, where the tests' time varies differently than on a laptop; the nightly in s3 will show it

```

<!-- /omni-outbox-settled: s1-01-mutation-timeout -->

<!-- omni-outbox-settled: s1-02-mutation-test-set -->

## s1-02-mutation-test-set — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-mutation-test-set
prd: 1072
slice: s1
rank: medium
bears-on: none
raised: 2026-10-05
wave: 1
---

## The question, in plain words

When a changed copy of the core is tested, which tests should try to catch it: the kit library's own, or every test in the repository?

## The decision, in plain words

The kit library's own tests only. They run in half a minute; the whole repository's take three, and its command tests start git and node, which kept stalling and timing out the run.

## The intro, for fun

The first full run was on course to take about ten hours.

## The punchline, for fun

Now the library's own tests catch the changes, and they finish before the coffee does.

## The options, in plain words

A. The kit library's own tests (`kit/lib/**/*.test.ts`), the option built.
B. Every test in the repository, as the spec first said, those under `kit/bin` and `scripts/` included: a full run takes about ten hours on a laptop, and many changes count as caught only because a busy machine was slow.
C. The library's tests plus a chosen few command tests, which needs a list to keep up to date.

## What I had to decide

The spec's design said a mutant runs the tests that reach it, "those under `kit/bin` and `scripts/` included". With them, a change to code that runs when its module loads (a zod schema, most of the core) reran the full 3-minute suite, and the first full run passed 3,700 of 6,081 mutants in 2 h 36 min before the person stopped it. A mutant that only a command test catches now counts as survived.

## What I did meanwhile

`stryker.config.vitest.ts` runs the repository's vitest settings on `kit/lib/**/*.test.ts` only; `stryker.config.ts` points the runner at it. On `kit/lib/ids.ts` the run went from over 5 minutes to 135 s.

## What it costs to change later

One line: the `include` of `stryker.config.vitest.ts`. Adding the command tests back makes every run several times longer, and the floors would have to be measured again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how many mutants only a command test would catch; a later PRD can measure it on one module

```

<!-- /omni-outbox-settled: s1-02-mutation-test-set -->

<!-- omni-outbox-settled: s2-01-mutation-changed-summary -->

## s2-01-mutation-changed-summary — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-mutation-changed-summary
prd: 1072
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The last line of a mutation run on changed code says how many changes were caught and how many slipped through. Do changes that made the tests hang, or that no test ran at all, belong in those numbers?

## The decision, in plain words

A change that made the tests hang counts as caught, and one no test ran counts as slipped through, the same way the module score counts them, so the line and the score always agree.

## The intro, for fun

Some changes get caught red-handed, some make the tests freeze, and some nobody even looks at.

## The punchline, for fun

The summary line sorts them into two piles, the same two the score uses.

## The options, in plain words

A. A. Two numbers, timeouts in killed and no coverage in survived, as the score counts them, the option built.
B. B. Four numbers: killed, timed out, survived, no coverage.
C. C. Killed and survived as Stryker names them, timeouts and no coverage left out of the line.

## What I had to decide

Whether the summary's two numbers should split out timeouts and uncovered mutants instead of folding them in.

## What I did meanwhile

`pnpm mutation:changed` ends with `mutation: <k> killed, <s> survived in <files>`, where k is killed plus timed out, s is survived plus no coverage, and the files are the mutated files, comma-separated. Mutants that do not compile are left out. Before that line it lists each survivor and uncovered mutant with its file, line, mutator and replacement.

## What it costs to change later

One function, `changedSummary` in `scripts/mutation-changed-plan.ts`, and its test; bug records written before a change keep the old shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the bug-fix skill parses the two numbers or only records the line

```

<!-- /omni-outbox-settled: s2-01-mutation-changed-summary -->

<!-- omni-outbox-settled: s2-02-floor-guard-shallow-clone -->

## s2-02-floor-guard-shallow-clone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-floor-guard-shallow-clone
prd: 1072
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The check that refuses lowering a quality floor compares with the main branch. Where the main branch is not downloaded, as in the pull request test job, what should it do?

## The decision, in plain words

It skips there and holds everywhere the main branch is present: on every agent's copy and in the preflight. A lowered floor can only reach main if nobody ran the tests locally.

## The intro, for fun

A guard that compares with the main branch needs the main branch in the room.

## The punchline, for fun

In the test job it is not invited, so the guard waits by the door.

## The options, in plain words

A. A. Skip the check where the main branch is not downloaded, the option built: it holds on every copy and in the preflight, not in the pull request tests.
B. B. Download the main branch in the pull request test job with one more step, so the check runs on every pull request too.
C. C. Fail the check where the main branch is not downloaded, which turns the pull request tests red until B is done.

## What I had to decide

Whether the pull request test job should also fetch the main branch so the floor guard runs there too.

## What I did meanwhile

`scripts/mutation-floor.test.ts` reads `origin/main:mutation/floor.json` and compares; when `origin/main` is not a known ref (the `checks` workflow's test shards use a depth-1 checkout), that one test is skipped, visibly, by `it.skipIf`. When main has no floor file yet (this feature branch), it passes: the first floors. A second test, always run, holds that the floor file names exactly the core's modules.

## What it costs to change later

One step in `.github/workflows/checks.yml` (outside this slice's territory): `git fetch --depth=1 origin main` before the tests, or `fetch-depth: 0` on the test job's checkout. No change in the guard.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the test job's checkout depth is a deliberate speed choice; the fallow job already uses `fetch-depth: 0`

```

<!-- /omni-outbox-settled: s2-02-floor-guard-shallow-clone -->

<!-- omni-outbox-settled: s3-01-mutation-nightly-shape -->

## s3-01-mutation-nightly-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-mutation-nightly-shape
prd: 1072
slice: s3
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The nightly check of the tests takes over an hour on a laptop and longer on the shared build machines. Should it run as one long job, or as several smaller jobs side by side?

## The decision, in plain words

Ten smaller jobs side by side, one per part of the code with the largest part split in three, then one short job that adds up the results and gives the verdict. Each job stops on its own after three hours.

## The intro, for fun

One job doing seventy minutes of work on a slower machine could still be at it at breakfast.

## The punchline, for fun

So ten jobs share the work, and one more counts the score.

## The options, in plain words

A. Ten shards side by side, outbox split in three, then a merging score job, three hours per shard, the option built.
B. One shard per module (eight), outbox whole, simpler but its job takes the longest.
C. One job running the whole core, the simplest file, likely several hours and close to GitHub's six-hour limit.

## What I had to decide

How to size the nightly mutation workflow for a GitHub-hosted runner: one job, or a matrix of shards with a merging job, and what timeout each gets.

## What I did meanwhile

`.github/workflows/mutation.yml` has a `mutate` matrix of 10 shards (ids, layout, board, config, env, inbox, policy, and outbox as `comment.ts`, `settle.ts` with `outbox.ts`, and the rest of the folder by exclusion, so a new outbox file is never missed), each `stryker run stryker.config.ts --mutate '<glob>,!kit/lib/**/*.test.ts'` with `timeout-minutes: 180` and `fail-fast: false`. A `score` job (`if: always()`, 10 minutes) merges the shards' JSON reports with `jq` (their `files` never overlap), runs `pnpm mutation:score` into the job summary, uploads the merged JSON and each shard's HTML report as `mutation-report`, and fails when a module is below its floor or a shard did not finish. The HTML report is one file per shard, not one merged page.

## What it costs to change later

One file: the matrix rows and the timeouts are constants. A new core module needs a matrix row (or falls in no shard and shows as a floor with no mutant in the score); merging into one job is deleting the matrix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how long each shard takes on a hosted runner: the proving run will say, and the timeouts can follow
- (author) whether one merged HTML page is worth building over one page per shard

```

<!-- /omni-outbox-settled: s3-01-mutation-nightly-shape -->

<!-- omni-outbox-settled: s3-02-mutation-nightly-proving-run -->

## s3-02-mutation-nightly-proving-run — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-mutation-nightly-proving-run
prd: 1072
slice: s3
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The plan asked for one hand-started run of the new nightly check before the feature is ready, but GitHub only offers that button once the check is on the main branch. How do we prove it beforehand?

## The decision, in plain words

A throwaway copy of this work, with one extra line that starts the check when that copy is uploaded, ran it once. The real file is unchanged, and the copy is deleted afterwards.

## The intro, for fun

The start button only appears once the check lives on the main branch.

## The punchline, for fun

So we built a spare copy with its own button and pressed that one.

## The options, in plain words

A. A throwaway branch with a temporary push trigger, the shipped file untouched, the option built.
B. A permanent push trigger for a proving branch name in the shipped workflow, which stays as a back door to run it.
C. Wait for the first on-demand or nightly run after the feature PR merges, so nothing is proved before merging.

## What I had to decide

How to run `.github/workflows/mutation.yml` once before the feature PR is ready, when `workflow_dispatch` only works for a workflow on the default branch and nothing may be pushed to `main`.

## What I did meanwhile

Pushed a throwaway branch, `prove/mutation-nightly`, holding the slice branch plus one commit that adds `push: branches: [prove/mutation-nightly]` to the workflow's triggers. The run on that branch is linked from the sub-PR. The committed workflow has only `schedule` and `workflow_dispatch`; the throwaway branch is deleted once the run ends.

## What it costs to change later

Nothing to undo in the shipped file. Proving again after a change means pushing the same throwaway branch again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the first on-demand run from the Actions tab, once the feature is on main, is still the spec's proof as written

```

<!-- /omni-outbox-settled: s3-02-mutation-nightly-proving-run -->

<!-- omni-outbox-settled: s3-03-mutation-floors-red-on-ci -->

## s3-03-mutation-floors-red-on-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-mutation-floors-red-on-ci
prd: 1072
slice: s3
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The first run on GitHub's machines scored two parts of the code just under the bars set from the laptop run. Should the bars stay where they are, so the nightly stays red until the tests improve?

## The decision, in plain words

The bars stay. On the busy laptop some changes made the tests too slow and counted as caught; on GitHub's quieter machines the same changes ran to the end and slipped through, so the laptop bars were a little generous.

## The intro, for fun

The laptop was so busy that some bugs got caught just for being slow.

## The punchline, for fun

On a calmer machine they strolled right past, and the scoreboard noticed.

## The options, in plain words

A. Keep the floors, the nightly red for env and outbox until tests are added there, the option built.
B. Measure the floors again from CI's run, rounded down (env 82, outbox 74), a one-time correction a person approves.
C. Add tests to env and outbox now until both hold their laptop floors, a slice of its own.

## What I had to decide

What to do when the proving run's scores fall below s1's floors for two modules: env 82.89 against 88, outbox 74.33 against 75. Every other module holds its floor.

## What I did meanwhile

Left `mutation/floor.json` unchanged (it is s2's territory, and the briefing says never to lower a floor to turn a check green). The proving run's `score` job is red for env and outbox only; the workflow itself ran end to end. The gap is timeouts: env had 20 timed-out mutants on the laptop and 0 on CI (24 survived instead of 15), outbox 152 against 60.

## What it costs to change later

Two numbers in `mutation/floor.json`. Until one of the options lands, every night is red for env and outbox, which hides a real fall in another module behind a known red.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether CI's scores are steady from night to night: one run does not show it
- (author) whether the floors are meant to be measured where the nightly runs, which the spec does not say

```

<!-- /omni-outbox-settled: s3-03-mutation-floors-red-on-ci -->
