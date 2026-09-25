# `kit/plugin/skills/yolo-fix/SKILL.md` (`/omni:yolo-fix`)

Source: `.claude/skills/vertuo-yolo-fix/SKILL.md` @ `vertuo-ai-domain@2af3d72f7` (origin/main, as
spec §2 asks: replies, the settle PR, the after-merge path). Its `rework.mjs` was already ported as
`kit/lib/policy/rework.mjs` (see `policy--rework.md`) and is reached through `omni rework`.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| no Step 0 | `omni config`, stop in one line when it fails (spec §2.1 rule 1) |
| `#<prd>`, the branch from the PRD's Handoff | the PRD number; the feature branch is `branches.feature` with the folder's topic |
| `feat/<topic>`, `origin`, `main` | `branches.feature`, `repo.remote`, `repo.defaultBranch` |
| `docs/delivery/outbox/<prd>-<topic>/settled.md`, `docs/delivery/shipped/…/outbox/` | the outbox dir `omni prd <n>` prints, which follows the PRD into `shipped` |
| `node scripts/outbox-adopt-leftovers.mjs <prd>` | `omni prd <n>` lists the open items; `omni adopt <file>` for each `rank: medium` one (the kit has no leftovers command) |
| `node scripts/outbox-replies.mjs --pr --prd --post` | `omni replies --prd <n> --pr <n> --post` |
| `import { planRework, renderReworkPlan, … } from './rework.mjs'` | `omni rework plan <prd> --json` (spec §2.1 rule 2: never import the kit) |
| `closeDriftedEntry(settledText, { id, pullRequest })` | `omni rework close <id> --prd <n> --pr <n>` |
| `docs/knowledge/`, `docs/adr/`, `docs/knowledge/README.md` | `paths.knowledge` and `paths.adr`, only when `laws.source` is `knowledge`; otherwise `Stays here:` |
| `pr:sub`, `pr:in-progress` | `labels.sub`, `labels.inProgress` |
| `pnpm quality:preflight --full` | `/omni:yolo` §4: `commands.preflightFull` (or `commands.preflight`), `commands.checks`, `omni check all` |
| `node scripts/outbox-status.mjs <prd>`, `pnpm delivery:ship <prd>` | `omni status <prd>`, `omni ship <prd>`, through `/omni:yolo` §4–5 |
| `node scripts/outbox-comment.mjs --prd --pr` | `omni comment --prd <n> --pr <n>` |
| `vertuo-pull-request`, `vertuo-parallel-wave` | `/omni:pr`, `/omni:wave`'s steps |

## Dropped

- **The export table of `rework.mjs`** and "never re-parse `settled.md` by hand, use
  `parseSettledEntries`": the skill reaches the derivation only through `omni rework`; the table
  becomes the list of fields `omni rework plan --json` returns.
- **Writing the rework plan to a scratch file** (`renderReworkPlan > $SCRATCH/…`) so
  `check-territory` could grade it: nothing in the kit grades a rework plan file; territory is read
  from each rework's `territory` field at merge time, as `/omni:wave` §4 reads the board's.
- **"A drifted answer with no lesson line holds the feature PR":** the kit's gate
  (`unreworkedDrift` in `kit/lib/outbox/status.mjs`) reads open items and unclosed drift only; it
  does not read `Became:` or `Stays here:`. `omni check outbox` still checks every `Became:` id
  resolves. The write-back stays as upstream wrote it, without the claim that the gate enforces it.
- **The `SETTLING.md` references, "Why one line is amended in an append-only ledger"** and PRD
  #1166, #1229, ADR 0069: upstream history. The rule survives as the guardrail "the ledger grows
  only"; `omni rework close` is what proves the one-line amendment.
- **`/vertuo-yolo`'s consultation policy object:** the rework brief says "record no item and ask
  nothing" in its own words.

## Changed

- **Reworks run by this skill over `/omni:wave`'s steps**, not by invoking `/omni:wave`: that skill
  takes a PRD number and reads the plan's board, which holds no rework rows. Claim, dispatch, merge
  and the wave check are its §2–5, applied to `omni rework plan --json` rows. Recorded as item
  `s10-01`.
- **The settle sub-PR's branch** is `branches.slice` with `{slice}` = `settle` (upstream named no
  branch). Recorded as item `s10-02`.
- **Leftover medium items land in the settle sub-PR** rather than as a separate commit: the feature
  branch is only ever moved by a sub-PR or by the orchestrator's own worktree push.
- **The finish is `/omni:yolo` §4–7**, not a bare preflight plus ship: meet the default branch, the
  whole check, the gate, and on green ship before ready (spec §2.1 rule 7). Upstream never marked the
  feature PR ready, because upstream yolo already had; here a red gate left it draft.
- **`territoryKnown: false`** stops that rework rather than only being reported: a rework with no
  declared ground cannot be graded.
- **Every edit works in a detached worktree,** as `/omni:yolo` and `/omni:wave` do.

## Added

- Step 0, and `labels.inProgress` plus a status comment on the feature PR while it runs, released at
  the end through `/omni:yolo` §6.
- The after-merge path opens the new feature PR as a draft through `/omni:pr` (upstream: "open one
  new feature pull request").
- The rework subagent's prompt, spelled out, in `/omni:wave`'s dispatch shape.
