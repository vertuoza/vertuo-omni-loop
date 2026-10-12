---
prd: 1679
title: Context budgets — what every agent reads stays small, in every repository
blocked-by: [1548]
spec: file
phase0: server
---

# Context budgets — what every agent reads stays small, in every repository

**Date:** 2026-10-12 · **PRD:** #1679
**Touches:**
- `kit/lib/budgets/` (new: the measure, the ceilings file, the ratchet)
- `kit/lib/playbook/resolve.ts` (read only: the measure prints each form through `resolveForm`)
- `kit/bin/commands/budget.ts` (new: `omni budget measure|set context`), `kit/bin/commands/check.ts`
  (`omni check context`, and `context` in `omni check all`)
- `kit/lib/config.ts`, `kit/lib/types.ts`, `kit/lib/schema/` (the `budgets.context` key)
- `kit/lib/help/entries.ts` (the new verbs)
- `apps/omni-app/src/budgets-check/` (new: the `omni / budgets` check run),
  `apps/omni-app/src/server-event/` (`item-settled` reruns it), `apps/omni-app/src/webhook/`
  (pull request events run it)
- `kit/templates/playbook/ci.md` (a **Budgets** section)
- `kit/plugin/skills/invade/SKILL.md`, `kit/plugin/skills/pr-care/SKILL.md`,
  `kit/plugin/skills/do-work/SKILL.md` (the budget red, the raise item)
- `.omni-loop/config.yml`, `.omni-loop/budgets/context.json` (this repository turns it on)

## Problem

Every agent session in a repository that runs the loop starts by reading the same things: the
briefing the SessionStart hook prints, the files in `paths.context` (CLAUDE.md, AGENTS.md), and,
step after step, the playbook forms through `omni kb show <form>`. Nothing measures how big that is,
so it only grows: each run adds one more reasonable paragraph, and every later session is slower,
dearer and less focused for it.

It already happened here. On 2026-10-12, `omni kb show releasing` printed 132,831 bytes, about 33k
tokens, which `/omni:brainstorm`, `/omni:yolo` and `/omni:yolo-fix` all read: its pointer
`[→ apps/galaxy/README.md#deploy-to-production]` runs past its section into the rest of the galaxy
README. The other forms print 1 to 14 KB. Nobody saw it, because nothing looks.

vertuoza/vnext answers the same problem with character budgets on its hot-path files, checked in
its CI. That answer is theirs: their files, their CI, and a raise any agent can approve by typing a
trailer. The loop is installed in repositories of every stack, so its answer must be the kit's:
measured by the kit, the same everywhere, and raised only by a person.

## Solution

### What is measured

`omni budget measure context` prints one byte count per **target**, read at a commit:

| target | what it is |
|---|---|
| `briefing` | what `omni kb show briefing` prints |
| `form:<name>` | each playbook form as `omni kb show <name>` prints it, every pointer expanded |
| `context:<path>` | each file `paths.context` names |
| `session` | `briefing` plus every `context:` target: what every session loads before its first step |

Bytes, not tokens: the same number on every machine, every model and the App. Reports add an
approximate token figure (bytes ÷ 4) for people. Skills are not measured (the kit owns them, not
the repository); ADRs and registers are not (a session reads them on demand).

### The ceilings and the ratchet

`.omni-loop/budgets/context.json` holds `{ "<target>": <ceiling in bytes> }`, versioned and
reviewed like `mutation/floor.json`. One pure function, `ratchet`, takes the base's ceilings, the
head's ceilings, the head's measures and the settled raise items, and gives each target a verdict:

| at the head | verdict |
|---|---|
| measure ≤ ceiling, ceiling not raised | green |
| ceiling lowered | green |
| ceiling raised, or a first ceiling for a new target, with a settled raise item for that target and that ceiling | green |
| ceiling raised, or a first ceiling, without one | red: *needs a person's yes* |
| measure > ceiling | red: *over budget* |

The config key is `budgets.context: { enabled, file }`, shaped as `budgets.<name>` so a later PRD
adds `budgets.perf` with a measuring command its repository owns, reusing `ratchet` unchanged. This
PRD builds the context measure only.

### Where it is enforced

- **Locally:** `omni check context` runs the measure and the ratchet against `--base` (default the
  default branch), and joins `omni check all`, which `/omni:do-work` and `/omni:wave` run before
  they push.
- **On every pull request:** the Omni App posts an `omni / budgets` check run on each pull request
  of a repository whose `budgets.context.enabled` is true, measured at the head and the base with
  the same kit code the App already bundles. It is posted on a pull request's events and again on
  `item-settled`, the server event that already re-posts the outbox and approved checks
  (PRD 1548). A repository with budgets off gets no check run.

### The red, written for a junior

A red check (and `omni check context`) says, for each red target, in this order:

1. **What:** "Over budget: the `design` playbook form is 9.8 KB, its ceiling is 8 KB." (or "needs
   a person's yes: this PR raises the ceiling of `design` from 8 KB to 10 KB").
2. **Why it matters,** one sentence: every AI agent working here reads this before it starts; when
   it grows, agents get slower, cost more and lose focus, so the team set a ceiling.
3. **What grew:** the file, the bytes added since the base, and the commits that added them.
4. **Fix it for me:** on a pull request that belongs to a PRD, `/omni:pr-care` (or
   `/omni:yolo-fix <n>`) handles it by itself; on any pull request, a prompt to paste into Claude:
   *"Trim `<file>` back under <ceiling> without losing a rule; move detail into a linked file."*
5. **Or it needs the room:** on a pull request that belongs to a PRD, raise the ceiling in the
   same PR and file a high outbox item that says why; a person's answer turns the check green. On a
   pull request that belongs to no PRD, a raise is not possible: trim, or make the change through a
   PRD or `/omni:bug-fix`, whose outbox carries the raise.

### The person's yes

A raise is a **high outbox item**, filed and settled through `OutboxStore` (PRD 1548), whichever
store the PRD's birthplace picks. The item names the target and the new ceiling, so `ratchet`
matches it; a later push that raises the same target again, or changes that ceiling, no longer
matches and needs a new yes. No agent settles a raise item: the gate's existing rule.

### Agents meet it

- `/omni:pr-care` treats a red `omni / budgets` like a red CI check: it trims the content first;
  when it cannot trim without dropping a rule, it raises the ceiling and files the high item, and
  never forces the check green another way.
- `/omni:do-work` sees `omni check context` red in `omni check all` before it pushes, and does the
  same inside its slice's territory.

### Installing

`/omni:invade` measures every target, writes `.omni-loop/budgets/context.json` with each ceiling at
today's size rounded up to the next KiB (installing never turns anything red), sets
`budgets.context.enabled: true` in the config it proposes, fills the `ci` form's **Budgets**
section, and lists on its map, as a `TODO(human)` to trim, every target above the kit's guideline:
a form over 16 KiB, a `session` over 24 KiB. The guideline is a hint on the map, never a check.

### This repository

It turns budgets on through the same path, and its ceilings are written at today's sizes: the
releasing form enters at its expanded size, flagged to trim, until the pointer bug is fixed on its
own.

## Decisions

- **D1 · Measure what a session reads, not the files.** A form is measured as `kb show` prints it,
  pointers expanded: the releasing form is 1.9 KB on disk and 133 KB as read.
- **D2 · Bytes.** Asked; the person chose bytes over tokens.
- **D3 · Enforced by the Omni App and by `omni check all`.** Asked; the App's check covers every
  pull request with no CI step written into a repository's own workflows, whose stacks differ.
- **D4 · A raise needs a person's yes, through the outbox.** Asked. vnext's raise is a trailer any
  agent can type; here it is a high item only a person settles. Built on PRD 1548's `OutboxStore`
  and `item-settled` event rather than a record of its own, after the person pointed at #1552.
- **D5 · Raises on loop pull requests only.** Asked; a pull request with no PRD has no outbox, so
  it trims or goes through a PRD or `/omni:bug-fix`.
- **D6 · A measurement that fails is neutral.** Asked; a broken pointer or a timeout never blocks a
  merge, and the check says why.
- **D7 · The red is written for a junior and offers a fix.** The person's answer to the voice's
  objection: what, why, what grew, a prompt and the skill that fixes it.
- **D8 · Ceilings start at today's size.** Taken without asking, the reversible choice: installing
  never turns a repository red; the guideline only flags.
- **D9 · Guideline 16 KiB per form, 24 KiB per session.** Taken without asking: today's largest
  sound forms here print under 14 KB, and a session's start under 3 KB. It is a hint on a map, and
  changing it changes nothing that runs.
- **D10 · Skills, ADRs and registers are not measured.** Taken without asking: skills are the
  kit's own, ADRs and registers are read on demand.
- **D11 · The releasing pointer is a bug of its own,** fixed through `/omni:bug-fix`, out of this
  PRD.
- **The voice.** persona:Irisa objected that a red check about a file she never opened would stop
  her quick win with no idea what to do. Settled `accepted`: D7.

## User stories

- As a PM who does not master the harness, when my pull request makes a form too big, I read what
  happened and why in plain words, and I have a prompt or a command that fixes it.
- As a lead engineer, I see on every pull request whether what agents read grew, and a ceiling
  only goes up when a person said yes, with the reason written down.
- As a developer installing the loop in a repository of any stack, `/omni:invade` sets the budgets
  up from today's sizes and tells me which files to trim, and nothing turns red.
- As an agent running a slice, I learn the budget is broken before I push, and I trim or ask.

## Scope

**In:** the context measure; the ceilings file; the `ratchet` function; `omni budget measure|set
context`; `omni check context` and its place in `omni check all`; the App's `omni / budgets` check
and its rerun on `item-settled`; the raise as a high outbox item; the junior-readable red;
`/omni:pr-care`, `/omni:do-work` and `/omni:invade` meeting it; the `ci` form's **Budgets**
section; this repository turning it on.

**Out:** performance budgets, dependency updates and a one-command local stack (each its own PRD);
the releasing pointer bug (`/omni:bug-fix`); measuring skills, ADRs or registers; a raise on a pull
request with no PRD; any budget in tokens.

## Test seams

Vitest beside the code; nothing calls GitHub or Supabase (`omni kb show testing`).

- **`ratchet`, pure:** every row of the verdict table; a raise item for another target or another
  ceiling not matching; a ceiling changed again after a settled raise. It gets a floor in
  `mutation/floor.json`.
- **The measure:** a fixture repository with a briefing, two forms (one with a pointer), and two
  `paths.context` files; each count equals the bytes `resolveForm` prints, the pointer expanded;
  `session` is their sum; a missing context file is a measurement error.
- **`omni check context`:** green; red with the five parts of the message; neutral on a broken
  pointer; part of `omni check all`.
- **`omni budget set context`:** writes today's sizes rounded up to the next KiB for targets with no
  ceiling yet, and never raises a ceiling that exists.
- **The App check:** on the stubbed GitHub of `outbox-check/end-to-end.test.ts`: red over budget;
  green after an `item-settled` event for the matching raise; neutral on a measurement error; no
  check run where budgets are off.
- **Skills:** the text of `/omni:pr-care`, `/omni:do-work` and `/omni:invade` names the budget red,
  the trim first, the high item, and never a forced green.

## Risks

Merging publishes a new check run on the pull requests of every repository that turns
`budgets.context` on, and new kit verbs with the next kit release; repositories that do not turn it
on see nothing. A wrong measure could block pull requests: rolled back per repository by setting
`budgets.context.enabled: false`, and for everyone by reverting the App change, which posts no
check run once gone (`omni kb show releasing`).

## Acceptance criteria

1. In a repository with budgets on, a pull request that grows a form past its ceiling gets a red
   `omni / budgets` check that names the file, its size, its ceiling, what grew, why it matters, a
   prompt to paste and the way to ask for a raise.
2. On a pull request that belongs to a PRD, raising that ceiling with a high outbox item keeps the
   check red until a person answers the item, then turns it green with no new push.
3. A pull request that lowers a ceiling, or stays under every ceiling, gets a green check with a
   table of target, size, ceiling and change.
4. A form whose pointer cannot be read gets a neutral check that says why.
5. `omni check context` gives the same verdict as the App's check, and `omni check all` fails on a
   red one.
6. `/omni:invade` on a repository without budgets writes ceilings that keep it green and lists the
   targets above the guideline as `TODO(human)`.
7. A repository with `budgets.context.enabled: false` gets no `omni / budgets` check run.
8. This repository has budgets on, and its releasing form's ceiling is its expanded size, flagged
   to trim.
