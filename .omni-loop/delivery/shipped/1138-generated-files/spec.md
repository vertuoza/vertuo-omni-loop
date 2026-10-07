---
prd: 1138
title: Generated files — never a breach, an extra wave or a conflict
blocked-by: none
spec: file
---

# Generated files

**Date:** 2026-10-07 · **PRD:** #1138 · **From the retro of PRD 1089:** #1101, #1102, #1103
**Touches:**
- `kit/lib/config.ts` (a `generated` section), `kit/lib/inbox/territory.ts` (`breaches`, `collisions`)
- `kit/lib/generated/` (new), `kit/bin/commands/generated.ts` (new), `kit/bin/commands/check.ts`
- `kit/lib/flow/merge-gate.ts`
- `apps/omni-app/src/retro/kinds/delivery.facts.ts`
- `kit/plugin/skills/do-work/`, `kit/plugin/skills/wave/`, `kit/plugin/skills/plan/`, `kit/lib/help/`
- `.omni-loop/config.yml` (this repository's two generated outputs)

## Problem

Some files in a repository are built, not written: here `kit/dist/omni.mjs` (built from the kit by
`pnpm kit:build`) and the GitHub App's bundles `apps/omni-app/api/*.mjs` (built from the App and
`kit/lib` by `node apps/omni-app/build.ts`). Every slice that touches their sources must rebuild them,
since a test fails when they are stale (`kit/test/dist.test.ts`, the App's
`vercel-functions.test.ts`). The loop does not know that, and it costs three ways:

- **A breach every time.** A slice that rebuilds a bundle the plan did not give it is reported as a
  territory breach by the wave and by the retro. PRD 1089's retro opened three issues for it (#1101,
  #1102, #1103), and ADR-0071 only says to rebuild anyway, outside the territory.
- **Extra waves.** When the plan does declare a generated path in every slice that rebuilds it,
  `omni plan check` counts it as shared ground and splits those slices into separate waves: PRD 1118
  ran four kit slices in four waves for `kit/dist/` alone.
- **Conflicts.** Two slices of one wave that both rebuild a bundle conflict on it at merge: in
  PRD 1130 the orchestrator resolved `apps/omni-app/api/inngest.mjs` by hand, by rebuilding it.

## Solution

**The config lists the generated outputs.** A new optional section:

```yaml
generated:
  - path: kit/dist/
    from: [kit/lib/, kit/bin/]
    build: pnpm kit:build
  - path: apps/omni-app/api/
    from: [apps/omni-app/src/, kit/lib/]
    build: node apps/omni-app/build.ts
```

`path` is a path prefix, written as a territory entry is; `from` the prefixes whose change makes it
stale; `build` the command that rebuilds it, run from the repository root. This repository's
`.omni-loop/config.yml` gains the two entries above. A repository without the section behaves exactly
as today.

**A slice never commits a generated file.** `/omni:do-work` runs the build of every output whose
sources its diff changed, so its own preflight sees fresh files, then drops those generated changes
before it commits and pushes (`git checkout` of the generated paths). The sub-PR carries sources only.

**The wave rebuilds once.** In `/omni:wave`'s check (step 5), after the slices are merged and the
medium items adopted, it asks the kit what is stale:

```bash
node .omni-loop/bin/omni.mjs generated <remote>/<feature branch before the wave>..HEAD
```

`omni generated <range> [--json]` prints, for each `generated` entry, `stale` or `fresh`: stale when a
path in the range's diff starts with one of its `from` prefixes, with the `build` to run. The wave runs
each stale build, then the preflight, and commits the rebuilt paths alone as
`chore(build): rebuild generated files — wave <n> of PRD <prd>`. Nothing to rebuild, no commit.
`/omni:yolo`'s finish (step 4) does the same after merging the default branch, so the feature PR
always carries fresh outputs. Outside a repository with the section, `omni generated` prints
`no generated files` and exits 0.

**Never a breach, never shared ground.**

- `breaches(paths, territory, generated)` in `kit/lib/inbox/territory.ts` drops every path a
  `generated` entry covers: a slice that rebuilt one anyway is not reported. The wave's territory step,
  the merge gate (`kit/lib/flow/merge-gate.ts`) and the App's retro
  (`apps/omni-app/src/retro/kinds/delivery.facts.ts`, reading the config at the merge commit) all use
  it.
- `collisions(slices, generated)` ignores a generated path: two slices that both list `kit/dist/` no
  longer share ground on it, so `omni plan check` no longer splits them for it.
- `/omni:plan` stops listing generated paths in territories and in the shared-ground note.

**A list that lies is red.** `omni check config` refuses a `generated` entry whose `path` or a `from`
prefix matches nothing tracked in the repository, or whose `build`'s first word is neither a script
of the root `package.json` (for `pnpm <script>`, `npm run <script>` and the like) nor a tracked file
(for `node <file>`), naming the entry and what is missing.

**The retro issues.** #1101, #1102 and #1103 are linked from this PRD's issue and closed; this PRD
answers them.

## Decisions

- **The wave commits generated files, once.** A slice rebuilds only to test; the wave rebuilds after
  merging and commits the result alone (the person's choice). No two sub-PRs can then conflict on a
  generated file, and the outputs on the feature branch always match its merged sources.
- **One list, read everywhere.** The plan check, the wave, the merge gate and the retro read the same
  `generated` section, through `breaches` and `collisions`, so none of them can disagree.
- **The voice objected.** B-E DEv (`persona:B-E DEv`): "One more list to keep in sync. Forget to add a
  new bundle there and you're back to fake breaches and serial waves, now with a config that lies."
  Accepted: `omni check config` refuses an entry whose path, sources or build do not exist. Settled:
  `accepted`.
- **Hand-written registration files stay shared ground.** #1103 also names `kit/bin/commands/plan.ts`
  and `apps/omni-app/src/inbox-check/evaluate-inbox.ts`: those are written, not built, so they stay
  under `/omni:plan`'s existing rule (declare a file several slices add to as shared ground). Only
  built outputs are `generated`.
- **ADR-0071 is superseded:** a slice no longer commits the App's bundles outside its territory; the
  wave rebuilds them.
- **The stale-output tests stay** (`dist.test.ts`, `vercel-functions.test.ts`): a rebuild the wave
  missed still fails the preflight.
- **No proof video:** nothing on screen; the person said no.

## User stories

1. As a PM, a PRD whose slices all touch the kit runs in as few waves as its real dependencies allow,
   not one wave per slice because of `kit/dist/`.
2. As a lead engineer, the retro never opens an issue because a slice rebuilt a bundle.
3. As the wave's orchestrator, I never resolve a merge conflict on a generated file again.
4. As a developer reading a sub-PR, I see source changes only; the rebuilt bundle comes in one
   generated-only commit on the feature branch.
5. As a maintainer, when I add a bundle to the config with a wrong path or build, `omni check config`
   tells me which entry is wrong.

## Scope

In: the `generated` config section and this repository's two entries; `omni generated`;
`breaches` and `collisions` aware of generated paths, in the plan check, the wave, the merge gate and
the retro; `omni check config` validating the section; `/omni:do-work`, `/omni:wave`, `/omni:yolo`'s
finish and `/omni:plan` following it; the help entry for `omni generated`; closing #1101–#1103.

Out: running builds inside `omni` itself (the skills run them, as they run the preflight); hand-written
registration files; detecting generated files without the config; changing the stale-output tests;
generated files in target repositories of a plan repository.

## Test seams

- `kit/lib/config.test.ts`: the `generated` section parses; a repository without it reads as today; a
  malformed entry fails naming the field.
- `kit/lib/generated/stale.test.ts`: a diff touching a `from` prefix makes that entry stale, one
  touching only the output or unrelated paths does not; several entries at once.
- `kit/bin/generated.test.ts`: `omni generated <range>` through `main()` on a fixture repository,
  text and `--json`; `no generated files` without the section.
- `kit/lib/inbox/territory.test.ts`: `breaches` drops generated paths and keeps every other breach;
  `collisions` ignores a generated path two slices share and keeps every other shared path.
- `kit/bin/plan.test.ts`: `omni plan check` puts two slices that share only `kit/dist/` in one wave.
- `kit/lib/flow/merge-gate.test.ts`: a sub-PR that changed a generated path is not graded a breach.
- `kit/bin/check.test.ts`: `omni check config` fails on a missing path, a missing `from` prefix and an
  unknown build, one line each, and passes this repository's config.
- `apps/omni-app/src/retro/kinds/delivery.test.ts`: a merged sub-PR that rebuilt a generated path
  raises no territory finding; the existing territory goldens are unchanged for every other path.
- `kit/test/plugin.test.ts`: `/omni:do-work`, `/omni:wave` and `/omni:plan` say what the spec says
  about generated files.

No test calls GitHub or runs a real build: fixtures and stubbed commands only.

## Risks

- **What merging publishes:** the kit (`kit/dist/omni.mjs`, the plugin's skills) on each repository's
  next `omni update`, and the GitHub App on its next deploy (the retro). No database change.
- **A stale output reaching the feature PR** if a wave forgets to rebuild: the stale-output tests fail
  the preflight and CI, as they do today.
- **A slice that commits a generated file anyway** is no longer reported as a breach; the wave's
  rebuild overwrites it, so the feature branch still ends fresh.
- **Rollback:** revert the feature PR; with the `generated` section gone, every check behaves as
  today.

## Acceptance criteria

- With the `generated` section in this repository's config, `omni check config` passes; with an entry
  whose path, a `from` prefix or the build does not exist, it fails naming the entry and what is
  missing.
- `omni generated <range>` lists `kit/dist/` stale for a range that changed `kit/lib/`, and fresh for a
  range that changed only docs; without the section it prints `no generated files`.
- `omni plan check` places two slices whose territories share only `kit/dist/` in the same wave.
- A sub-PR whose diff includes `apps/omni-app/api/inngest.mjs` outside its territory is not a breach
  for the merge gate or the retro; every other path outside its territory still is.
- `/omni:do-work` pushes no generated file; `/omni:wave`'s check rebuilds the stale outputs and commits
  them alone as `chore(build): rebuild generated files — wave <n> of PRD <prd>`.
- A repository without the `generated` section plans, merges and retros exactly as today.
- #1101, #1102 and #1103 are closed and linked from this PRD's issue.
