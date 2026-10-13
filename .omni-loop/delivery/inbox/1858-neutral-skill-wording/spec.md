---
prd: 1858
title: Neutral skill wording — every skill in words any coding agent follows, the Claude way in brackets
blocked-by: [1831]
spec: file
phase0: server
---

# Neutral skill wording

**Date:** 2026-10-13 · **PRD:** #1858 · **Touches:** `kit/plugin/skills/*/SKILL.md` (and
`pixel-perfect`'s reference files), `kit/templates/playbook/briefing.md`, `kit/test/plugin.test.ts`,
a new `kit/test/agent-neutral.test.ts`, a new `kit/test/skill-steps.test.ts` and its snapshot, the
rebuilt `kit/dist/` · **Kind:** Architectural

## Problem

PRD 1831 made every hook's job a plain `omni` command: `omni session start|end`, `omni ask
question|wait|answer`, and a heartbeat any command sends. The 33 skills still speak to Claude Code
alone, so another coding agent reading them meets steps it cannot carry out:

| what a skill says (on `main`) | where |
|---|---|
| step 0 prints the briefing with `omni kb show briefing` | 20 skills |
| ask through `AskUserQuestion` | brainstorm, yolo, think-big, ask |
| `type /clear (or open a new terminal)` | 9 skills, 14 lines |
| `/loop`, and "the only part that is Claude Code's" | drive, mega-drive (23 lines) |
| one subagent per slice or step, `isolation: "worktree"`, "several Agent calls", "background agent" | wave, drive, mega-drive, yolo-fix |
| `run_in_background: true` … "act when it wakes you" | pr, pr-care, mega-pr-care, invade |
| "this Claude session", "Claude Code terminal", "the slash commands a person types in Claude" | ask, brainstorm, think-big, dossier-open, dossier-push, help, pr-care, pr |
| "the co-author trailer your session requires" | 21 skills, 24 lines |

`kit/test/plugin.test.ts` asserts many of these strings by name (`/loop`, `/clear`,
`AskUserQuestion`, "background agent", `worktree`), so the Claude wording is held in place by the
tests themselves.

## Solution

### 1. The rule: neutral words, then the Claude way in brackets

Every Claude-only action is said in words any agent can follow, followed by the Claude way, always
written `(in Claude: …)`. The mapping, applied to every skill and nothing beyond it:

| today | after |
|---|---|
| `type /clear (or open a new terminal)` | `start a fresh session (in Claude: /clear), or open a new terminal` |
| ask … `through AskUserQuestion` | ask the person (in Claude: `AskUserQuestion`), as the briefing's **Any agent** says |
| one subagent per slice or step, `isolation: "worktree"`, "several Agent calls", "background agent" | start one agent per slice (or step), each in its own worktree, all at once (in Claude: one message with several Agent calls, each `isolation: "worktree"`, in the background) |
| `run_in_background: true` … act when it wakes you | run it in the background and act when it ends (in Claude: Bash with `run_in_background: true`) |
| drive's and mega-drive's `/loop` and **Claude Code.** section | run this tick again after the wait it names (in Claude: `/loop /omni:drive`, with no interval) |
| "this Claude session", "Claude Code terminal" | "this session", "terminal" |
| "the slash commands a person types in Claude" | "the skills a person runs" |
| "the co-author trailer your session requires" | "the co-author trailer your agent adds, if it adds one (in Claude: the `Co-Authored-By` line its session gives)" |
| step 0: `node .omni-loop/bin/omni.mjs kb show briefing` | step 0: `node .omni-loop/bin/omni.mjs session start` (PRD 1831: the constituents, then the briefing, then `session: <id>`) |

What a step does, which `omni` command it runs and which guard it names do not change: only the
words around a Claude tool do.

### 2. Skill names stay `/omni:<name>`, defined once

The 658 references of the form `/omni:<name>` stay as they are: it is the kit's name for a skill. The
briefing's **Any agent** section (below) defines it once, and every skill prints the briefing at
step 0.

### 3. The briefing's **Any agent** section

A new section of the kit default `kit/templates/playbook/briefing.md`, between **Links** and
**Where to read next**. A repository whose own briefing has no such section prints the kit default,
as it does for **Links** today, so every installed repository gets it with no change of its own. It
says, in plain words:

- **Skills.** `/omni:<name>` names a skill of the kit: run it the way your agent runs skills (in
  Claude: type it).
- **Asking the person.** With a tool for asking, use it (in Claude: `AskUserQuestion`). Without
  one, write the questions to a file and run `omni ask question --file <file>`: exit 0 prints the
  answers; exit 4 prints `round <id>`, resume with `omni ask wait <id>`; exit 3 means ask in your own
  chat, then send the answer with `omni ask answer <round> --file <file>` when a round is named.
- **Parallel agents.** When a skill says to start one agent per slice or step and your agent cannot
  start agents, build the same slices or steps one after another, in the board's order, each still
  in its own worktree and its own sub-PR, merged by the same guards.
- **Waiting in the background.** When your agent cannot run a command in the background, run it in
  the foreground within your shell's limit, and run it again until it ends.
- **A fresh session.** Where a skill says to start a fresh session, do what clears your agent's
  context (in Claude: `/clear`), or open a new terminal: everything the next session needs is in
  the repository and on GitHub.

### 4. The guards

- **`kit/test/agent-neutral.test.ts`** reads every `SKILL.md` and reference file under
  `kit/plugin/skills/` and fails, naming the file and the line, on any of these names outside an
  `(in Claude: …)` bracket: `AskUserQuestion`, `/clear`, `/loop`, `isolation:`,
  `run_in_background`, `Agent call`, `Claude Code`, `Claude session`, `ScheduleWakeup`,
  `/reload-plugins`. A bracket runs from `(in Claude:` to its matching `)`, backticks inside it
  included. A fixture proves both a hit and a pass.
- **`kit/test/skill-steps.test.ts`** compares each skill's steps with a snapshot,
  `kit/test/skill-steps.snapshot.json`, taken from `main` before any skill is reworded: for each
  skill, the sorted set of `omni <verb>` commands it names and of guard phrases it states (`omni plan
  check`, `omni flow check merge`, `omni phase0`, `omni ship`, `omni status`, `never merge`, `draft`,
  `labels.outboxGo`). A skill that loses one fails, naming it. Step 0's `kb show briefing` → `session
  start` is the one change the snapshot records, in the same commit as the rewording.
- **`kit/test/plugin.test.ts`**: each assertion of a Claude string is rewritten to assert its new
  wording (`start a fresh session (in Claude: /clear)`, `(in Claude: /loop /omni:drive`, …). Its
  other assertions (names, descriptions, commands in `COMMAND_TABLE`, signing) stay.

## Decisions

- **`/omni:<name>` stays** (the person's choice over bracketing all 658 references, or only the
  hand-offs): it is the kit's name for a skill, defined once in the briefing.
- **No parallel agents: one after another** (the person's choice over an inline fallback or a
  refusal): the same slices, worktrees, sub-PRs and guards, only slower.
- **The bracket form is fixed**, `(in Claude: …)`, so a test can find it and a person can scan for
  it. Proposed by the person: "start a fresh session (in Claude: "/clear")".
- **The briefing carries the shared procedures** (asking, parallel agents, waiting, a fresh
  session), so each skill's text stays short and every agent reads them at step 0.
- **The voice objected at the design** (persona:F-E Developer): *"Rewording all 33 skills changes the
  prompts my Claude runs every day (persona:F-E Developer); if one reworded step makes it skip a
  guard, that bug ships."* Settled `accepted`: the snapshot test of each skill's commands and guards.
- **`blocked-by: [1831]`**: the skills call `omni session start` and `omni ask question`, which PRD
  1831 shipped (merged as #1833).
- **Proof video: no.** Nothing here shows in a browser.

## User stories

- As a developer on Codex, I run a kit skill and every step names something I can do: the commands,
  and the neutral words, with Claude's way only as an example (persona:B-E DEv).
- As that developer, when my agent cannot start parallel agents, the wave still builds every slice,
  one after another, with the same sub-PRs and checks.
- As a PM on any agent, when the skill needs my answer, it reaches my ask page through `omni ask
  question` or my chat (persona:Irisa, persona:Paul - Product Manager).
- As a Claude Code user, the bracket names the tool my session already uses, and every guard of every
  skill is still there (persona:F-E Developer).
- As a team lead, one briefing section tells every agent on my team how to run the kit
  (persona:Lead Engineer).

## Scope

In: every `SKILL.md` under `kit/plugin/skills/` and `pixel-perfect`'s reference files, by the mapping
above; the **Any agent** section of `kit/templates/playbook/briefing.md`; the two new tests and the
snapshot; the rewritten assertions of `kit/test/plugin.test.ts` and of any other test that reads a
reworded line; the rebuilt `kit/dist/`.

Out: `omni help` and `kit/lib/help/entries.ts`, `omni init`, `.agents/skills/`, the status line and
`plugin-hud` (PRD 3); a step runner (PRD 4); `kit/porting/` notes (history); this repository's own
`.omni-loop/knowledge/playbook/briefing.md` (it prints the kit default); `docs/guide/`.

## Test seams

As `omni kb show testing` says: vitest, colocated or under `kit/test/`, no network, no GitHub.

- `agent-neutral.test.ts`: every skill file passes; a fixture with `type /clear` fails, naming the
  line; a fixture with `start a fresh session (in Claude: \`/clear\`)` passes; a name inside a code
  block but outside a bracket fails.
- `skill-steps.test.ts`: every skill matches the snapshot; a fixture that drops `omni plan check` from
  a skill fails, naming the skill and the command.
- The briefing: `omni kb show briefing` in a fixture repository whose `briefing.md` has no **Any
  agent** section prints it, marked `[kit default]`; `omni session start` prints it too.
- `plugin.test.ts`, `flow-points.test.ts`, `no-literals.test.ts`, `stage-words.test.ts`,
  `skills-dossier-link.test.ts`, `brainstorm-concept.test.ts`, `kit/lib/help/entries.test.ts` and
  every other test that reads skill text pass, edited only where they assert a reworded line.
- The full `pnpm test`, `pnpm lint` and `pnpm typecheck` stay green; `kit/test/dist.test.ts` with
  the rebuilt bundle.

## Risks

Merging publishes the kit on `main`: the release workflow's version commit follows, and installs
pick up the reworded skills and the new briefing section on `omni update` (the plugin's skills come
from `kit/plugin`). Rollback is reverting the merge commit: the change is text in skills, a template
and tests, with no state.

- **A reworded step that changes what Claude does.** The mapping is the only edit allowed, the
  snapshot test fails on a lost command or guard, and the feature PR's reviewer reads the diff of
  each skill.
- **A skill now runs `omni session start` at step 0:** it prints the constituents too (up to 3 s
  when the Omni page is slow), and stores a session id when none resolves. Both are PRD 1831's
  behaviour; a subagent's step 0 prints them again.
- **One after another is slower:** a wave of five slices on an agent with no subagents takes five
  builds' time. Nothing changes for Claude.

The locked laws: the skills and their tests state or enforce all twenty; this PRD changes the words
around them and none of their meaning, and the snapshot test holds each guard. Changing any of them
needs @pierrederval to approve the pull request on GitHub.

- BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering.
- BR-PRODUCT-5: a person could merge work whose open decisions nobody answered.
- BR-PRODUCT-6: a risky change nobody explained reaches the main branch unseen.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind.
- BR-PRODUCT-28: a stranger could tie themselves to a team and see what it sees.
- BR-PRODUCT-29: a stranger could read a team's questions and answers.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner lose it.
- BR-PRODUCT-59: a member could copy the paid AI key and run up the bill.
- BR-PRODUCT-63: an agent could read another team's private work.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent.
- BR-PRODUCT-94: an agent could answer a question in a person's name.
- N-PRODUCT-3: a badly ranked question slips past the person who answers it.
- N-PRODUCT-4: a change could switch its own gate off behind a green check.
- N-PRODUCT-7: a person is locked out of their own terminal by a broken hook.
- N-PRODUCT-8: questions and answers could go to a server the person never chose.
- N-PRODUCT-13: the install could overwrite a person's own settings.
- N-PRODUCT-14: a rule quietly loses its test until the server refuses the PR.
- N-PRODUCT-15: unreviewed work reaches every user with nobody choosing to ship it.
- N-PRODUCT-16: scores and history could change after the fact.
- N-PRODUCT-17: anyone opening the arcade could read a key that controls the database.

## Acceptance criteria

1. No `SKILL.md` or reference file under `kit/plugin/skills/` holds `AskUserQuestion`, `/clear`,
   `/loop`, `isolation:`, `run_in_background`, `Agent call`, `Claude Code`, `Claude session`,
   `ScheduleWakeup` or `/reload-plugins` outside an `(in Claude: …)` bracket, and
   `kit/test/agent-neutral.test.ts` fails when one is added.
2. Every skill whose step 0 printed the briefing runs `node .omni-loop/bin/omni.mjs session start`
   instead.
3. Every skill that says "type /clear" says "start a fresh session (in Claude: `/clear`)".
4. wave, drive, mega-drive and yolo-fix say to start one agent per slice or step, each in its own
   worktree, with the Claude way in brackets; the briefing says to build them one after another
   when the agent cannot start agents.
5. `omni kb show briefing` in a repository whose briefing has no **Any agent** section prints it as
   a kit default, with the skills, asking, parallel agents, waiting and fresh-session paragraphs.
6. `kit/test/skill-steps.test.ts` passes against a snapshot taken from `main` before the rewording,
   and fails when a skill loses an `omni` command or a guard.
7. `kit/test/plugin.test.ts` asserts the new wording, and no test asserts a Claude string outside a
   bracket.
8. `pnpm test`, `pnpm lint` and `pnpm typecheck` are green, and `kit/dist/` is rebuilt.
