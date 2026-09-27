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
- **The `approve all` reply and "label the PR `outbox:go`" in the report:** the report points to the posted
  comment and `/omni:yolo-fix`; the override label is a person's, never suggested.
- **Deliver's "Loop Behaviour" section** (background waits, resume after a session ends): the
  background watch is `/omni:pr`'s, and resuming is the Input line plus the board and
  `labels.inProgress`; no separate section.
- **The reply grammar in the report** (`1: ok`, `2: no, because …`): the posted comment explains how
  to answer, in the kit's own numbering; the skill points to it rather than restating it.
- **PRD #1166, #1071, ADR 0069 references:** upstream history.

## Changed

- **Gate red → the feature PR stays draft** (item s9-01). Upstream marked it ready and stopped with
  `ci/outbox` red, as expected. Here ready happens only after a green gate, `omni ship`, commit and
  push (spec §2.1 rule 7, "ship before ready"; PR #4 was merged unshipped). Spec §2's table row for
  yolo was aligned with rule 7 in `ee15122` (draft with the questions posted while items are open).
- **Finish preflight:** after merging the default branch, a changed lockfile or package manifest
  means an install in the worktree first (not an attempt); a red step caused by the environment is
  fixed as environment, and code outside the PRD's slices is never edited to turn the finish green.
  Upstream fixed any red "on the feature branch" with no such bound.
- **Ship step added** on the green path: `omni ship`, commit `chore(delivery): ship PRD <n>`, push,
  then `gh pr ready`, then `/omni:pr`'s lifecycle for CI. Upstream had no ship step.
- **Default branch conflict at finish** (item s9-02): upstream resolved `git merge origin/main`
  inline. Here it merges only when behind, and a conflict it cannot resolve with confidence is
  aborted and handed to a person through `/omni:pr`'s Stuck path.
- **The gate is `omni status <prd>` without `--changes`** (item s9-03): open items and unreworked
  drift only, as spec §2.1 rule 7 words it; unaccounted changes are graded per slice by do-work's
  `omni check coverage`.
- **The gate's check on the PR** (PRD 28, ADR-0001): one line before "Gate red" says the omni-loop
  GitHub App posts the same gate as the `ci.outboxContext` check, and that this skill neither posts it
  nor waits on it. Upstream's `ci/outbox` status came from a per-repository workflow.
- **`omni comment` runs before `omni ship`,** on both paths, so it reads the outbox while it is
  still in the inbox folder. Upstream ran it last.
- **The loop's end states** are named: complete, held (stuck, stopped, blocked, in flight
  elsewhere), or a wave that moved nothing. Upstream's "nothing runnable" did not cover a wave whose
  own check stayed red.

## Added

- **Read the feature branch's tip:** `git switch --detach <remote>/<feature branch>` before every
  board read, because the plan and the adopted items live on the feature branch, and `omni prd`,
  `omni board` and `omni status` read the local checkout. A checkout with tracked changes stops the
  run in one line (never stash, clean or reset), and the run leaves the checkout detached.
- **A red wave check ends the loop** (held, stuck): no next wave is built on a red feature branch.
- **Resume after ship:** `omni prd` saying `shipped` with the feature PR still draft goes straight
  to `gh pr ready`.
- **`omni ship` exit 2** (uncommitted delivery changes): commit this run's own, rerun once, else stop.
- **Release:** `labels.inProgress` comes off the feature PR at the end, and the final status comment
  is written through `/omni:pr`'s marker recipe with one of its own states: `done` (ready, or the
  gate red with "answer the outbox" as the human step) or `stuck` (held or a stuck finish). A stuck
  finish still posts the outbox comment.
- The finish work runs in a detached worktree pushed with `HEAD:<feature branch>`, as `/omni:wave`'s
  does, because git refuses a branch another worktree holds.
- **The playbook forms** (PRD 45, the spec's wiring table): step 0 prints the `briefing` through
  `omni kb show` before any other step (acceptance criterion 9), and says how to read a form: a
  blank section is the kit default, a `[hole]` never stops the run (decision 7), and a form adds to
  its steps without overriding its rules (item s6-02). Then it runs `omni kb status` once, at the
  start, and prints the open questions it lists; every slice carries on with the kit defaults, and
  the map is not read again that run (decision 7). The questions are not posted on the feature PR:
  the spec asks only that they be printed once.

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
- **The ship commit** (§5, `chore(delivery): ship PRD <prd>`) carries the trailer line.
- **The feature PR's body,** rewritten at the finish (§4), still ends with the footer line.
- **Unsigned:** the outbox comment `omni comment` writes and the status comments are comments.

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

- **Step 5, gate green, a new item 1: the release note,** only when
  `omni config releaseNotes.enabled` prints `true`; with the switch off the green path runs as
  before. Before `omni ship`, the skill writes the note in the folder `omni prd` prints, from the
  spec and from what the feature branch built (its diff against the default branch), never from the
  plan (the spec's decision 5).
- **The voice is not restated.** What the note holds and how it reads are the `notes` slot of the
  `releasing` form: the step points to `omni kb show releasing` and names none of its rules, so a
  repository that writes its own voice there changes what the loop writes without touching the
  skill.
- **`omni check releases` until green,** then the note is committed alone as
  `docs(release): PRD <prd> release note`, with the session's co-author trailer and the
  `omni sign trailer` line, and pushed with the move. Still red after `limits.attempts` rewrites,
  the run does not ship and names the rule as `stuck`, like any other red step of the finish (the
  briefing's attempts rule).
- **A note already there is kept** (a person wrote or edited it on the branch, or an earlier run
  committed it and stopped before the ship): only what the check refuses changes, and an unchanged
  note needs no commit (item s2-02). `/omni:yolo-fix` is the one that rewrites a note, when a rework
  changed what the PRD does.
- **Ship, its commit and ready move to items 2 to 4.** Ship's exit 1 names a missing or failing
  note among its reasons, and the resume path in step 1 (shipped, still a draft) now points to
  item 4, the one that marks the feature PR ready.
- **Unchanged:** the red gate ships nothing, so it writes no note. The skill's description is left
  as it was.

### Tests

`kit/test/plugin.test.mjs` gained a block at its end, `the release note in the skills that ship`
(item s2-01: the file sits outside the slice's ground). On the live skills: step 5's green path
names the switch, `omni kb show releasing`, `omni check releases` and the `docs(release)` commit in
that order, before `omni ship` and `gh pr ready`, and its red gate names none of them; the resume
pointer lands on the item that marks the PR ready; neither skill restates the voice's limits; and
this repository's shim prints `releaseNotes.enabled` as `true`.

### Gate (this update)

`pnpm vitest run kit/test/plugin.test.mjs kit/test/no-literals.test.mjs` and `pnpm test`, green.
