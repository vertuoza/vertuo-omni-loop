---
prd: 1273
title: The e2e beta works in a real repository
blocked-by: none
spec: file
---

## Problem

The trial of `/omni:validate-e2e` on test PRD 1262 showed that the beta cannot run in a repository as it is. Nothing creates the e2e project: the repository's own dependency gate (fallow) refuses an `e2e/` folder with its own `package.json` unless it is a declared workspace, and installing it with a newer package manager than CI uses rewrites the whole lockfile. A Vercel preview without a database draws nothing, so a criterion cannot be filmed there. `omni e2e heals` compares with the feature branch, so on a first pass it reports nothing new. And recordings made before the dependencies were settled turn `REPLAY_STALE`.

## Solution

The skill sets the e2e project up once and says how: `e2e/` declared as a workspace of the repository's package manager, at the version its CI uses, with the framework's dependencies, committed in the sub-PR. It records last, after the install is settled. When the preview has no data, `e2e.url` may be a fixed address (a local or hosted demo), and the sub-PR says why. `omni e2e heals` takes the sub-PR's branch as its head, so a first pass lists every step as new.

## Decisions

- **The skill creates the e2e project on its first run,** and commits it in the sub-PR. A repository that wants another layout declares it first.
- **`omni e2e heals` gains an explicit head** (`--head <ref>`), the feature branch by default, so existing use does not change.
- **Record last.** The two runs happen after every install; changing a dependency afterwards means recording again.

## User stories

1. As a person running the skill in a repository with a dependency gate, I get an e2e project the gate accepts, without hand-editing workspace files.
2. As a person whose preview has no data, I can point the run at a demo address and the sub-PR says so.
3. As a reviewer of a first sub-PR, I see every step listed as new.

## Scope

In: the project scaffold step, the package-manager version check, the fixed-URL path with its stated reason, `omni e2e heals --head`, record-last ordering, and the guide page. Out: screenshots and held-back recordings (PRD P2), the `/omni:yolo` wiring (P3), anything on QA.

## Test seams

Kit command tests for `omni e2e heals --head` on a fixture repository; a guard that the skill names each step in order; the scaffold is exercised by running the skill on a PRD of this repository.

## Risks

Merging publishes a skill and a command option. A repository that runs the skill gains a workspace entry and lockfile lines in its sub-PR, rolled back by reverting that PR. Reverting this PRD returns the beta of PRD 1233.

## Acceptance criteria

1. Run in a repository with a dependency gate and no e2e project, the skill creates `e2e/` as a declared workspace and the gate passes on its commit.
2. Run with a package manager newer than the one CI declares, the skill stops with one line naming both versions before it installs.
3. With `e2e.url` a fixed address, the sub-PR body says the target was not the preview, and why.
4. `omni e2e heals <n> --head <ref>` pairs the steps at the merge-base with those at `<ref>`; on a first pass every step is listed as new.
5. Changing an installed dependency after recording makes the skill record again before the strict replay.
