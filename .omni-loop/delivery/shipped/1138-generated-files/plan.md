# Plan: Generated files

PRD #1138, spec beside this plan (`spec.md`). The feature branch `feat/generated-files` goes into
`main` with `Closes #1138`. Each slice is a sub-PR from `feat/generated-files--<slice>` into the
feature branch, marked `Part of #1138`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The config reads a `generated` section (this repository's `kit/dist/` and `apps/omni-app/api/` entries), `omni check config` refuses an entry whose path, a `from` prefix or the build does not exist, and `omni generated <range> [--json]` lists each output stale or fresh with its build | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/generated/` `kit/bin/commands/generated.ts` `kit/bin/generated.test.ts` `kit/bin/commands/check.ts` `kit/bin/check-config.test.ts` `kit/bin/commands/index.ts` `kit/bin/omni.test.ts` `kit/bin/help.test.ts` `kit/lib/help/` `.omni-loop/config.yml` `kit/dist/` `apps/omni-app/api/` | — | 1 |
| s2 | `breaches` and `collisions` leave generated paths out, so `omni plan check` puts slices sharing only a generated path in one wave, and neither the merge gate nor the App's retro reports a rebuilt generated file as a breach | `kit/lib/inbox/territory.ts` `kit/lib/inbox/territory.test.ts` `kit/lib/inbox/collisions.ts` `kit/lib/inbox/plan-grade.ts` `kit/bin/commands/plan.ts` `kit/bin/plan.test.ts` `kit/lib/flow/merge-gate.ts` `kit/lib/flow/merge-gate.test.ts` `apps/omni-app/src/retro/kinds/delivery` `kit/dist/` `apps/omni-app/api/` | s1 | 2 |
| s3 | `/omni:do-work` rebuilds generated outputs only to test and pushes none, `/omni:wave`'s check and `/omni:yolo`'s finish rebuild the stale ones with `omni generated` and commit them alone, `/omni:plan` stops listing generated paths, and ADR-0071 is marked superseded | `kit/plugin/skills/do-work/` `kit/plugin/skills/wave/` `kit/plugin/skills/yolo/` `kit/plugin/skills/plan/` `kit/test/plugin.test.ts` `.omni-loop/knowledge/adr/0071-` | s1 | 2 |

**Shared ground.**
- `kit/dist/` and `apps/omni-app/api/` belong to s1 and s2: both change code those bundles carry, and
  this PRD's own `generated` handling does not exist yet while it is being built. They sit in waves 1
  and 2.
- s3 changes skills, a test and one ADR only; it shares no path with s2, so the two run side by side
  in wave 2.

## Per slice: done when

**s1**
- The `generated` section parses (`path`, `from`, `build`); a config without it reads as today; a
  malformed entry fails naming the field (`kit/lib/config.test.ts`).
- This repository's `.omni-loop/config.yml` lists `kit/dist/` (from `kit/lib/`, `kit/bin/`, built by
  `pnpm kit:build`) and `apps/omni-app/api/` (from `apps/omni-app/src/`, `kit/lib/`, built by
  `node apps/omni-app/build.ts`), and `omni check config` passes on it.
- `omni check config` fails, one line each naming the entry, on a path or a `from` prefix that matches
  nothing tracked, and on a build whose first word is neither a root `package.json` script (behind
  `pnpm`, `npm run` and the like) nor a tracked file (behind `node`).
- `omni generated <range>` lists `kit/dist/` stale for a range that changed `kit/lib/`, fresh for one
  that changed only docs, with each build; `--json` prints the same; without the section it prints
  `no generated files` and exits 0.
- `/omni:help` lists `omni generated`; `pnpm test` is green with both bundles rebuilt.

**s2**
- `breaches(paths, territory, generated)` drops every path a `generated` entry covers and keeps every
  other breach; `collisions(slices, generated)` ignores a generated path two slices share and keeps
  every other shared path (`kit/lib/inbox/territory.test.ts`).
- `omni plan check` places two slices whose territories share only `kit/dist/` in the same wave, read
  from the repository's config (`kit/bin/plan.test.ts`).
- The merge gate does not grade a sub-PR that changed a generated path outside its territory as a
  breach.
- The App's retro, reading the config at the merge commit, raises no territory finding for a rebuilt
  generated path and still raises one for any other path; existing territory goldens are unchanged.
- A repository without the section gets exactly today's breaches and collisions.

**s3**
- `/omni:do-work` runs the build of every output its diff made stale (`omni generated`), runs its
  preflight, then drops the generated paths before it commits and pushes.
- `/omni:wave`'s check (step 5) runs `omni generated <feature branch before the wave>..HEAD`, runs each
  stale build and the preflight, and commits the rebuilt paths alone as
  `chore(build): rebuild generated files — wave <n> of PRD <prd>`; nothing stale, no commit.
- `/omni:yolo`'s finish (step 4) does the same after merging the default branch.
- `/omni:plan` says generated paths are never listed in a territory or the shared-ground note.
- ADR-0071 is marked superseded by PRD 1138.
- `kit/test/plugin.test.ts` pins each of these lines.
