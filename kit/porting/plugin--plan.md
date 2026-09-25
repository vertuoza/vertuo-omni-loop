# `kit/plugin/skills/plan/SKILL.md` (`/omni:plan`)

Source: `vertuo-ai-domain@c4a210122:.claude/skills/vertuo-plan/SKILL.md`. The skill keeps upstream's
shape: read the PRD, stop on unclear acceptance, the feature branch, thin vertical slices with a
territory and a computed wave, the plan file, the draft feature PR, the hand-off, the guardrails.

## Read from config instead of hard-coded

| Upstream literal | Now |
|---|---|
| no Step 0 | `omni config`, stop in one line when it fails (spec §2.1 rule 1) |
| `gh issue view <prd>` as the PRD | `omni prd <n>`: must be `inbox` with a `spec.md`; the spec file is the PRD's text. The issue is still read (`gh issue view <n> --json body,comments`) for answers already given |
| `docs/glossary.md`, the ADRs cited | every file in `paths.context`, `paths.glossary` when set, cited ADRs under `paths.adr` |
| `origin`, `main` | `repo.remote`, `repo.defaultBranch` |
| `feat/<topic>` | `branches.feature` with `{topic}` from the PRD folder name `omni prd` prints |
| `.claude/worktrees/<topic>` | `worktrees` |
| `docs/superpowers/plans/<date>-<topic>.md` | the plan path `omni prd` prints, beside `spec.md` |
| `node -e "import('./scripts/check-territory.mjs')…"` (`collisionRows`, `sameWaveCollisions`) | `omni plan check <n>`, rerun until it exits 0; it also catches duplicate ids and bad blockers |
| `--label pr:feature --label pr:in-progress`, `Closes #<prd>` | `/omni:pr`'s feature kind: `labels.feature`, `labels.inProgress` under its **Labels** rules, `prLinks.feature` |
| `vertuo-pull-request`'s feature shape | "follow `/omni:pr`'s feature kind" |
| scenarios as `.pending.feature` files | only when `acceptance.enabled`; named in each slice's "done when" |
| `vertuo-deliver` (caller and hand-off line) | `/omni:yolo`; the last line run alone is `/omni:yolo <n>` |
| `vertuo-parallel-wave` grades territory | `/omni:wave` |

## Dropped

- **The `tier` column** (small / mid / top, from `vertuo-do-work`'s "Right-Size The Model").
  `/omni:do-work` has no right-sizing section, and the kit's table is
  `| id | slice | territory | blocked by | wave |`.
- **The `scenarios` column.** Scenarios exist only when `acceptance.enabled`; they go in "done when".
- **`## Durable decisions`** and the per-slice `### s1 — <title>` sections. The worked example (PRD 7's
  own plan) uses one `## Per slice: done when` list instead.
- **The printed collision matrix table** in the plan. `omni plan check` prints it on every run; the
  plan carries the worked example's shorter shared-ground note.
- **"A guard that lands in `pnpm check` owns `package.json`."** Generalised to "a file several slices
  each add one line to is shared ground".
- **The plan's `Feature PR: #<pr>` header line**, which needed a second commit after the PR opened.
  The PR link goes on the PRD issue comment and the feature PR names the PRD.
- **"One slice only means no sub-PR"**: upstream built a lone slice on the feature branch. Here every
  slice is a sub-PR, since `/omni:do-work` and `/omni:wave` only know that path (item s7-02).
- **`vertuo-brainstorming` created the branch with the `.pending.feature` files.** Here a phase-0 PR
  lands the spec on the default branch, so the feature branch is reused when it exists on the
  remote (`git ls-remote`) and cut from `<remote>/<defaultBranch>` otherwise.

## Changed

- **Acceptance criteria.** Upstream read an "Acceptance criteria" section of the PRD issue. The
  spec file may have none (PRD 7's does not), so the criteria are its acceptance section, or else
  its scope and test seams; the test is whether every slice's "done when" can be written as an
  observable condition (item s7-01). The stop comment asks one numbered question per gap.
- **An existing plan.** A phase-0 PR may already have landed `plan.md`; it is kept and changed only
  as far as the slice rules and `omni plan check` require (item s7-04).
- **An existing feature PR** for the branch (`gh pr list --head … --base …`) is updated rather than
  duplicated.
- **Collision resolution** is spelled out: move a slice (and what it blocks) to a later wave, narrow
  a territory, or merge the two. Never leave the check red.
- **Status comment state** at plan time is `claimed` with `slices: 0 / <total> merged`; the skill does
  not enter `/omni:pr`'s check loop and never marks the PR ready (item s7-03).

## Verified against real GitHub (read-only, 2026-09-25)

- `gh issue view 7 --comments`, piped: prints nothing when the issue has no comments, so the skill
  reads `--json body,comments` instead.
- `gh pr list --head feat/omni-loop-skills --base main --state open --json number,url,isDraft` →
  `[{"isDraft":true,"number":9,…}]`.
- `git ls-remote --heads origin feat/omni-loop-skills` prints the ref; a missing branch prints
  nothing, exit 0.
