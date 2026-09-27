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
- **The hand-off** (PRD 301): step 8 is headed `## 8. Hand off`, keeps its report, drops the line
  "A person merges #<feature PR> into `repo.defaultBranch`.", and ends with `/omni:yolo` §7's
  hand-off as written (the PRD's folder, where it is, **What is next?**). Its held ending runs
  `/omni:yolo-fix <n>`, since a held rework resumes with this skill. A block in
  `kit/test/plugin.test.mjs` asserts it on the live skill.

## Added

- Step 0, and `labels.inProgress` plus a status comment on the feature PR while it runs, released at
  the end through `/omni:yolo` §6.
- The after-merge path opens the new feature PR as a draft through `/omni:pr` (upstream: "open one
  new feature pull request").
- The rework subagent's prompt, spelled out, in `/omni:wave`'s dispatch shape.
- **The playbook forms** (PRD 45, the spec's wiring table): step 0 prints the `briefing` through
  `omni kb show` before any other step (acceptance criterion 9), and says how to read a form: a
  blank section is the kit default, a `[hole]` never stops the run (decision 7), and a form adds to
  its steps without overriding its rules (item s6-02).
- **The write-back** (§3) gains two targets (PRD 45):
  - an ADR under `paths.adr` is written as `omni kb show decisions` says: where records live, their
    format, and the next free number it reads live from the folder;
  - a process lesson (how to work here) goes into the playbook section it answers, with `by: human`
    in the slot's marker, and the settled entry records `Became: playbook/<form>#<slot>`, which
    `omni check outbox` resolves (decision 10). `omni kb init` first writes a missing form. Unlike
    the knowledge and ADR targets, it does not wait on `laws.source`: the playbook is not law, and
    `omni kb init` gives any installed repository one.
  - A section that points elsewhere takes the lesson in the page it names, and still records its
    `Became:`; a form that points elsewhere as a whole takes it in its target and records
    `Stays here:` with where it went, since there is no slot to name (item s6-03).

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
- **The commits:** the settle commit (§3) and the close commit (§6) carry the trailer line.
- **The settle sub-PR:** `gh pr create` gains `--body-file <file>`, and its body ends with the
  footer line.
- **The rework sub-PRs** (§5) are signed in `/omni:pr`'s Claim mode; the step says so.
- **The after-merge path** opens its new feature PR with a body ending with the footer line.
- **Unsigned:** the outbox round `omni replies --post` posts and the status comments are comments.

### Tests

`kit/test/plugin.test.mjs` gained one rule, run on the live skills and on fixtures built to break
it: a SKILL.md that asks for the co-author trailer names `omni sign trailer`, and one that opens a
pull request or an issue (`gh pr create`, `gh issue create`, or "open(s) the/a … PR, pull request
or issue" in prose), or rewrites its body (`gh pr edit … --body-file`), names `omni sign footer`.
A skill that only comments is held to nothing. The existing rule that every `omni` command a
SKILL.md names exists now covers `sign`.

### Gate (this update)

`pnpm vitest run kit/test/plugin.test.mjs kit/test/no-literals.test.mjs` and `pnpm test`, green.

## PRD 262, slice s2 — the loop writes the release note

Not a re-port: upstream's skill writes no release note. A kit-local change to the prose, which the
bundle does not carry. PRD 262 gives every shipped PRD a release note, `release.md` in its folder;
with `releaseNotes.enabled` on, `omni ship` refuses a PRD without one that passes
`omni check releases` (slice s1).

- **Step 7, gate green: the release note before the ship,** only when
  `omni config releaseNotes.enabled` prints `true`. It is `/omni:yolo` §5's item 1 (write it from
  the spec and the built branch in the voice of `omni kb show releasing`, `omni check releases`
  until green, commit `docs(release): PRD <prd> release note` with the trailers), with one
  addition: a note already in the PRD's folder is read against what the branch builds now, and when
  a merged rework changed what the PRD does for the people who use it, the note is rewritten the
  same way. A rework that changed nothing the note says leaves it as it is.
- **The after-merge path** (`omni prd` already says `shipped`) still has nothing to ship, but the
  note is written or rewritten all the same, in the folder `omni prd` prints (the shipped one),
  and its commit is pushed before ready: a reworked PRD's note would otherwise describe what it no
  longer does.
- **The voice is not restated:** the step points to `omni kb show releasing`, as `/omni:yolo` does.
- **Unchanged:** the red gate ships nothing and writes no note.

### Tests

`kit/test/plugin.test.mjs`'s block `the release note in the skills that ship` (item s2-01, the file
sits outside the slice's ground) reads step 7: it names the switch, `omni kb show releasing`,
`omni check releases` and the `docs(release)` commit in that order, before `gh pr ready`, says it
rewrites the note, and restates none of the voice's limits.

### Gate (this update)

`pnpm vitest run kit/test/plugin.test.mjs kit/test/no-literals.test.mjs` and `pnpm test`, green.
