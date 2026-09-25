---
prd: 7
title: Omni Loop skills — the omni plugin
blocked-by: [3]
spec: file
---

# Omni Loop skills — the `omni` plugin

**Date:** 2026-09-25 · **PRD:** #7 · **Follows:** #3 (kit phase 1: `kit/lib` and the `omni` CLI)

## 1. Problem

The kit can check, gate, settle and ship, but nothing drives it. The loop's steps are brainstorm → plan
→ build the slices wave by wave → record decisions → answer → rework → ship. Those steps live as
`vertuo-*` skills inside `vertuo-ai-domain`, and they hard-code that repository. This repository cannot
run its own loop, so every Omni Loop PRD so far has been built by hand.

## 2. Solution

A Claude Code plugin named **`omni`**, shipped once from this repository. It has three skills a person
types:

| Command | Does | From upstream |
|---|---|---|
| `/omni:brainstorm` | an idea → the PRD issue, `inbox/<prd>-<topic>/{spec,plan}.md` and `before-after.html`, a docs-only phase-0 PR | `vertuo-brainstorming` (the superpowers steps written in; no `superpowers:` dependency) |
| `/omni:yolo <prd>` | builds every wave and asks nothing. It ends with the feature PR ready and the gate red when there are open items. It runs the ship step when nothing is open | `vertuo-yolo` (deliver with the ask-nothing policy) |
| `/omni:yolo-fix <prd>` | reads the replies on the PR, settles them, reworks each drifted decision as a slice, then ships | `vertuo-yolo-fix` (origin/main: replies, settle PR, post-merge path) |

It also has four internal skills, which the three above follow and a person may also run:
`/omni:plan`, `/omni:wave`, `/omni:do-work`, `/omni:pr`.

### 2.1 Rules every skill follows

1. **Step 0 is always the same:** run `node .omni-loop/bin/omni.mjs config` and stop if it fails. A
   repository that is not terraformed says so in one line.
2. **The kit is reached only through `.omni-loop/bin/omni.mjs`.** A skill never imports `kit/lib`, and
   never names a path, label, branch shape, check name or command that it could read from
   `omni config <key>`.
3. **Policy lives in code, not prose.** Anything the kit can decide (a rank floor, a collision, a
   rework plan, a phase-0 verdict, the board), the skill asks the CLI. The prose says when to ask, and
   what to do with the answer.
4. **Decisions are outbox items, never private notes.** A decision the skill takes without asking
   becomes an item through `omni item new`. Its rank comes from the kit.
5. **Never merge the default branch, never add the override label, never create a label unless
   `labels.autoCreate` is true.** Missing labels are reported as a human step.
6. **Claim first.** A slice's draft sub-PR is opened before the slice is built. A claim is stale when
   its status comment is older than `limits.claimStaleMinutes` and its branch has no new commit.
7. **Ship before ready.** When nothing is open or unreworked, `yolo` or `yolo-fix` runs `omni ship`,
   commits the move, then marks the feature PR ready. That way PR #4's gap (merged unshipped) cannot
   happen again.

### 2.2 The CLI the skills need

In another repository, a skill reaches the kit only through the bundled CLI. These subcommands are new
(each is a thin command over existing `kit/lib` code, except `board`):

| Command | Over | Used by |
|---|---|---|
| `omni item new --prd --slice --file <file> [--adopt] [--json]` (graded like `check outbox` before writing; `--json` prints the outcome) | `decideRecording` + `renderOutboxItem` + `adoptItem` for medium | do-work |
| `omni plan check <prd>` | `parsePlanSlices`, `sameWaveCollisions`, `collisionRows` | plan, wave |
| `omni board <prd>` | new `kit/lib/board.mjs`: the plan's slices × `gh pr list` → merged / in flight / stuck / runnable / blocked / claimed-stale | wave, yolo |
| `omni rework plan <prd>` · `omni rework close <id> --prd <n> --pr <n>` | `planRework`, `closeDriftedEntry` | yolo-fix |
| `omni phase0 <prd> [--base <ref>]` | `phase0Verdict` over the branch's changed paths | brainstorm |

`board` is pure over the plan text and an injected PR list. Only its CLI half calls `gh`.

### 2.3 Where it lives

```text
.claude-plugin/marketplace.json      the marketplace, source ./kit/plugin
kit/plugin/.claude-plugin/plugin.json   { "name": "omni", … }
kit/plugin/skills/<name>/SKILL.md    brainstorm, yolo, yolo-fix, plan, wave, do-work, pr
.claude/settings.json                this repository enables omni@<marketplace> (dogfood)
.omni-loop/bin/omni.mjs              this repository's shim onto kit/bin/omni.mjs (live source, no bundle)
```

A terraformed repository will get the bundle at `.omni-loop/bin/omni.mjs` (phase 4, `omni-loop init`).
This repository gets a shim, so the skills always run today's code.

## 3. Decisions

1. **The plugin is `omni`, and its skills are typed `/omni:<skill>`** (user, 2026-09-25). A plugin
   skill always carries its prefix.
2. **Skills before the outbox workflow** (user, 2026-09-25). The skills are what let the loop build
   itself. The workflow is the first PRD the loop builds.
3. **Gates are loop-faithful** (user, 2026-09-25). The user merges phase-0. The waves then run without
   asking, and the user answers on the feature PR.
4. **The cut-over.** Waves 1–5 are built with the loop run by hand. Wave 6 (`yolo-fix`, `brainstorm`) is
   built by `/omni:yolo 7` itself.

## 4. Scope

**In:**
- The marketplace, the plugin and its seven skills.
- The five CLI commands in §2.2 and `kit/lib/board.mjs`.
- This repository's shim and settings.
- A plugin test: every SKILL.md parses; every `omni <command>` a skill names exists; no repository
  literal in `kit/plugin` (the no-literals guard extended); `claude plugin validate` when `claude` is
  on the path.

**Out:**
- `/omni:deliver` (yolo that asks), the planner, bbq, pr-monitor.
- The outbox workflow (next PRD).
- `omni-loop init/doctor/remove`.
- Evals.

## 5. Test seams

- `board.mjs` is pure over `{ planMarkdown, prs, now, limits }`.
- Each new command is tested through `main()`, as Task 15 did, with a fake `exec` wherever `gh` is
  involved.
- Skills are prose. Their test is the plugin test (§4), plus the dogfood run: waves 1–5 by hand, then
  wave 6 by `/omni:yolo 7`.

## 6. Risks

- **Skill prose drifts from the CLI.** The plugin test fails on any `omni <command>` a SKILL.md names
  that `COMMAND_TABLE` lacks.
- **Marketplace and settings shapes.** The research did not agree on the exact
  `extraKnownMarketplaces` shape. Slice s1 settles it with `claude plugin validate` and a real load,
  and raises what it finds as an outbox item.
- **Nested subagents.** `/omni:wave` dispatches one subagent per slice. The documented limit is 3
  levels deep, and yolo → wave → do-work stays within it.
