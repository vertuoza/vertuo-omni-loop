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
  `labels.needsFix`. A subagent that returns nothing usable is `red` too. Since PRD 45 (item
  s6-01), a red slice gets one look first: when its failing step matches a known red in the `ci`
  form, its diff changes nothing that red names, and the form allows a re-run, it goes through the
  merge steps like a `done` slice, the preflight of `/omni:pr`'s sub-PR lifecycle being its one
  re-run, counted as an attempt.
- **Medium items** are adopted here, after the merges, with `omni adopt`, in one commit on the
  feature branch (do-work leaves them open under `--in-wave`). Upstream adopted at raise time.
  The wave's check runs after the adoption, so one pass of `omni check all` covers the ledger.
- **Stuck wave check:** after `limits.attempts` red runs on the feature branch the status comment
  says `stuck`; labelling the feature PR is left to `/omni:yolo`.

## Added

- The takeover of a `claimed-stale` slice, and "Slices `in-flight` are someone else's".
- **Awaiting merge** (resume): an `in-flight`, non-draft sub-PR without `labels.inProgress` is
  finished work a previous run never merged; it joins the merge step, and its medium items are
  read from the open files `omni prd` lists.
- **Branch lock:** after the claims the orchestrator runs `git switch --detach`, and conflict and
  wave-check work happens in a `git worktree add --detach` worktree pushed with `HEAD:<branch>`,
  because git refuses a branch another worktree holds.
- The orchestrator removes `labels.inProgress` from every slice it does not merge, and sets its
  status comment to `stuck` with the reason.
- The nesting line: at most three levels, so do-work never dispatches.
- A stop when the feature branch or feature PR is missing: follow `/omni:plan` first.
- The Report's tail: the wave's check, the high items left open, what the board still holds.
- **The playbook forms** (PRD 45, the spec's wiring table), each read through `omni kb show`:
  step 0 prints the `briefing` before any other step (acceptance criterion 9), and says how to read
  a form: a blank section is the kit default, a `[hole]` never stops the wave (decision 7), and a
  form adds to its steps without overriding its rules (item s6-02). A red slice reads `ci` once
  (above). The dispatch prompt is unchanged: each subagent's `/omni:do-work` prints its own
  briefing.

## PRD #99, slice s2 — the skill signs the loop's work

Not a re-port: upstream's skill signs nothing. A kit-local change to the prose, which the bundle
does not carry. PRD #99 makes OmniMan (the `signature` config section, slice s1) a co-author of every
commit the loop makes and the signer of every pull request and issue it opens.

- **Signing,** a paragraph under the `omni` line: every commit the skill makes ends with the
  session's co-author trailer, then the line `omni sign trailer` prints, as the message's last line
  with no blank line between them, so both stay in the trailer block. Every pull request or issue it
  opens ends its body with the line `omni sign footer` prints, as a paragraph of its own just above
  the session's own attribution lines, and a body it rewrites keeps that line. Comments are never
  signed. A command that prints nothing (`signature: null`) means signing is off: the skill adds
  nothing and runs unchanged. No skill spells the signer's name or address.
- **The adopt commit** (§5, `chore(delivery): wave <n> of PRD <prd> — adopt …`) carries the
  trailer line.
- **The feature PR's body,** rewritten to tick the merged slices (§5), keeps its footer line.
- **Claims** are signed where they are made, in `/omni:pr`'s Claim mode (the claim commit and the
  sub-PR's body). The status comments this skill rewrites stay unsigned.

### Tests

`kit/test/plugin.test.mjs` gained one rule, run on the live skills and on fixtures built to break
it: a SKILL.md that asks for the co-author trailer names `omni sign trailer`, and one that opens a
pull request or an issue (`gh pr create`, `gh issue create`, or "open(s) the/a … PR, pull request
or issue" in prose), or rewrites its body (`gh pr edit … --body-file`), names `omni sign footer`.
A skill that only comments is held to nothing. The existing rule that every `omni` command a
SKILL.md names exists now covers `sign`.

### Gate (this update)

`pnpm vitest run kit/test/plugin.test.mjs kit/test/no-literals.test.mjs` and `pnpm test`, green.

## Issue 1178 — the wave judges a sub-PR's review threads before it merges it

Not a re-port: a kit-local bug fix. Upstream, and the kit until now, assumed a sub-PR is never
reviewed, so a reviewer bot's threads on one (seven on vertuoza/vertuo-backend-php#6486, a real
migration bug among them) were merged past into the feature branch. Step 4 gains item 5, **Review
threads**, before the gate (which becomes item 6): `omni care state <prd> --pr <n>` names the
sub-PR's `slice` and gives it a sub-PR's round (`decideSubPrRound`, `kit/lib/care/decide.ts`):
`act` lists `judge` and `mark-asked`, carried out exactly as `/omni:pr-care` §3 says (the `review`
form, `omni care reply`, one commit per fix, the preflight green), in a detached worktree pushed
with `HEAD:<slice branch>` as a conflict is; `hold` (a thread left asked) leaves the sub-PR open
and unmerged, a new **Not merged** row, while its siblings merge; `clear` goes on to the gate. The
wave's own claims, CI and the conflict never change that round. `/omni:ultra-wave`'s pointer to the
gate now names item 6.

**Decided:** the wave waits for no review not yet posted. A reviewer bot may post minutes after
`gh pr ready`, but no config names a reviewer or a delay, and every other step reads GitHub as it
stands when it gets there (the board is rebuilt each run, "read every sub-PR afresh"). The slices
that finish first have had that time by step 4; a review posted after a merge lands on the merged
sub-PR, and the feature PR, which `/omni:pr-care` looks after, still carries the review. Waiting
would be a new config key, a product decision for a later PRD.

### Tests

`kit/lib/care/decide.test.ts` (the sub-PR round's four modes), `kit/bin/care.test.ts` (`care state
--pr` on a sub-PR while the wave holds claims) and `kit/test/plugin.test.ts` (the wave reads its
sub-PR's threads before the gate and holds an asked one).
