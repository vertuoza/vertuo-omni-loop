# `kit/plugin/skills/wave/SKILL.md` (`/omni:wave`)

Source: `.claude/skills/vertuo-parallel-wave/SKILL.md` @ `vertuo-ai-domain@c4a210122`, plus the
board (§2), the per-wave loop body (§3 steps 2–4) and the "never merge into main" guardrail of
`.claude/skills/vertuo-deliver/SKILL.md` at the same commit. The rest of `vertuo-deliver` (every
wave, finishing the feature PR) belongs to `/omni:yolo`.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| no Step 0 | `omni config`, stop in one line when it fails (spec §2.1 rule 1) |
| inputs: feature branch, plan path, PRD, slice ids | the PRD only; the feature branch is `branches.feature` with the board's `prd.topic`, the slices are the board's frontier |
| `feat/<topic>`, `feat/<topic>--<id>`, `origin` | `branches.feature`, `branches.slice` (through `/omni:pr` Claim), `repo.remote` |
| `main` | `repo.defaultBranch` |
| `pr:sub`, `pr:in-progress`, `pr:needs-fix` | `labels.sub`, `labels.inProgress`, `labels.needsFix` |
| `pnpm quality:preflight --full` | `commands.preflightFull`, falling back to `commands.preflight`; then `commands.checks` and `omni check all` |
| "three attempts" | `limits.attempts` |
| `gh pr list --base feat/<topic> --label pr:sub` + a prose state table (deliver §2) | `omni board <prd> --json` |
| §1 "Guard the wave" (blockers merged, same-wave blockers, territory collisions) | the board's `frontier.takeable`; collisions arrive already deferred (`frontier.excluded`), keeping the earlier slice rather than refusing the pair |
| `node scripts/check-territory.mjs <plan> <slice> origin/feat/<topic>` | `gh pr diff <n> --name-only` against the board row's `territory`, plus the outbox dir `omni prd` prints; `omni plan check <prd>` once before merging (item s8-01: no CLI grades one slice's diff yet) |
| the Slices checklist and status comment (deliver §3 step 3) | the body shape and marker recipe `/omni:pr` owns |

## Dropped

- **The consultation policy** (`CONSULTATION_POLICIES`, asking about `high` / `human-action` items
  in the prompt, settling answers with `scripts/outbox-settle.mjs`): `/omni:deliver` is out of
  scope (spec §4) and `/omni:yolo` asks nothing. The wave records and reports; a person answers on
  the feature PR (item s8-02).
- **"Exclude a slice with no acceptance at all":** the board has no such state, and do-work records
  an ambiguity as an item and builds on.
- **"Each on the tier the plan names for its slice":** the plan's slice table has no model column.
- **The long dispatch contract** (read the `.feature` files, `CLAUDE.md`, `gh issue view`, cut the
  branch, labels, body, title, territory paragraph, stop rules, return shape): all of it now lives
  in `/omni:do-work` and `/omni:pr`; the prompt names the slice, the PRD, the feature branch and
  `--in-wave`.
- **The `skipped` result field:** do-work's result shape has none; skipped checks go in `summary`.
- **ADR 0069 and PRD #985 references:** upstream history.

## Changed

- **Claim first** (spec §2.1 rule 6): the orchestrator claims every takeable slice through
  `/omni:pr` Claim mode before dispatching, and takes over a `claimed-stale` one by rewriting its
  status comment. Upstream let each subagent cut its own branch and open its own PR.
- **Merge order** is the board's (the plan's) order, not slice-id order; the two agree for a plan
  numbered in order.
- **Ready before merge:** a sub-PR is merged only once `/omni:pr` has marked it ready; the wave
  never runs `gh pr ready` itself.
- **`red` status** (do-work's): treated like upstream's `preflight: "red"` — not merged, stuck,
  `labels.needsFix`. A subagent that returns nothing usable is `red` too.
- **Medium items** are adopted here, after the merges, with `omni adopt`, in one commit on the
  feature branch (do-work leaves them open under `--in-wave`). Upstream adopted at raise time.
  The wave's check runs after the adoption, so one pass of `omni check all` covers the ledger.
- **Stuck wave check:** after `limits.attempts` red runs on the feature branch the status comment
  says `stuck`; labelling the feature PR is left to `/omni:yolo`.

## Added

- The takeover of a `claimed-stale` slice, and "Slices `in-flight` are someone else's".
- The nesting line: at most three levels, so do-work never dispatches.
- A stop when the feature branch or feature PR is missing: follow `/omni:plan` first.
- The Report's tail: the wave's check, the high items left open, what the board still holds.
