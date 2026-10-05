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
