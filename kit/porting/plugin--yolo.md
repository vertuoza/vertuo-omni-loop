# `kit/plugin/skills/yolo/SKILL.md` (`/omni:yolo`)

Source: `.claude/skills/vertuo-yolo/SKILL.md` @ `vertuo-ai-domain@c4a210122`, plus §1–3 of
`.claude/skills/vertuo-deliver/SKILL.md` at the same commit (find the plan, the board, the wave
loop), which upstream yolo reused with the ask-nothing policy. The per-wave body (the board, claim,
dispatch, merge, the Slices checklist) went to `/omni:wave` (see `plugin--wave.md`).

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| no Step 0 | `omni config`, stop in one line when it fails (spec §2.1 rule 1) |
| `#<prd>`, an issue labelled `prd`; the branch from the PRD's Handoff | the PRD number; `omni prd <n>` must say `inbox`; the feature branch is `branches.feature` with the folder's topic |
| `feat/<topic>`, `origin`, `main` | `branches.feature`, `repo.remote`, `repo.defaultBranch` |
| `git ls-tree … docs/superpowers/plans` | `plan.md` in the files `omni prd <n>` lists, read on the feature branch's tip |
| `pr:in-progress`, `pr:needs-fix`, `outbox:go` | `labels.inProgress`, `labels.needsFix`, `labels.outboxGo` |
| `pnpm quality:preflight --full`, then browser scenarios twice | `commands.preflightFull` (or `commands.preflight`), `commands.checks`, `omni check all`; `acceptance.run` twice only when `acceptance.enabled` |
| "three attempts" | `limits.attempts` |
| `node scripts/outbox-status.mjs <prd>` | `omni status <prd>` |
| `node scripts/outbox-comment.mjs --prd <prd> --pr <pr>` | `omni comment --prd <prd> --pr <pr>` (flags confirmed in `kit/bin/commands/comment.mjs`) |
| the board table and `gh pr list --label pr:sub` (deliver §2) | `omni board <prd> --json`, through `/omni:wave` |

## Dropped

- **The consultation policy** (`CONSULTATION_POLICIES['/vertuo-yolo']`, `asksAbout: []`) and
  deliver §3.1 (ask in the prompt, settle with `outbox-settle.mjs`): `/omni:deliver` is out of scope
  (spec §4), so there is nothing to contrast with. "It asks nothing" is one line of prose; recording
  is `/omni:do-work`'s.
- **"A medium item is adopted the moment it is raised":** under `--in-wave` medium items are adopted
  by `/omni:wave` after its merges.
- **Reading `ci/outbox` by commit status** (upstream §4 step 7, because it was not a required check):
  the gate is `omni status <prd>`, run locally before ready, and `/omni:pr`'s lifecycle already reads
  `ci.outboxContext` by name.
- **The `approve all` reply and "label the PR `outbox:go`" in the report:** the report names only the
  numbered replies and `/omni:yolo-fix`; the override label is a person's, never suggested.
- **PRD #1166, #1071, ADR 0069 references:** upstream history.

## Changed

- **Gate red → the feature PR stays draft** (item s9-01). Upstream marked it ready and stopped with
  `ci/outbox` red, as expected. Here ready happens only after a green gate, `omni ship`, commit and
  push (spec §2.1 rule 7, "ship before ready"; PR #4 was merged unshipped). Note spec §1's table row
  still says "ends with the feature PR ready and the gate red"; the item carries the choice.
- **Ship step added** on the green path: `omni ship`, commit `chore(delivery): ship PRD <n>`, push,
  then `gh pr ready`, then `/omni:pr`'s lifecycle for CI. Upstream had no ship step.
- **Default branch conflict at finish** (item s9-02): upstream resolved `git merge origin/main`
  inline. Here it merges only when behind, and a conflict it cannot resolve with confidence is
  aborted and handed to a person through `/omni:pr`'s Stuck path.
- **The gate is `omni status <prd>` without `--changes`** (item s9-03): open items and unreworked
  drift only, as spec §2.1 rule 7 words it; unaccounted changes are graded per slice by do-work's
  `omni check coverage`.
- **`omni comment` runs before `omni ship`,** on both paths, so it reads the outbox while it is
  still in the inbox folder. Upstream ran it last.
- **The loop's end states** are named: complete, held (stuck, stopped, blocked, in flight
  elsewhere), or a wave that moved nothing. Upstream's "nothing runnable" did not cover a wave whose
  own check stayed red.

## Added

- **Read the feature branch's tip:** `git switch --detach <remote>/<feature branch>` before every
  board read, because the plan and the adopted items live on the feature branch, and `omni prd`,
  `omni board` and `omni status` read the local checkout.
- **Resume after ship:** `omni prd` saying `shipped` with the feature PR still draft goes straight
  to `gh pr ready`.
- **Release:** `labels.inProgress` comes off the feature PR at the end, and the final status comment
  (`done`, `waiting for the outbox`, or `stuck`) is written through `/omni:pr`'s marker recipe.
- The finish work runs in a detached worktree pushed with `HEAD:<feature branch>`, as `/omni:wave`'s
  does, because git refuses a branch another worktree holds.
