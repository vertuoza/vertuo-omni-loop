---
prd: 292
title: The brainstorm and the plan end with a plain "What is next?"
blocked-by: none
spec: file
---

# The brainstorm and the plan end with a plain "What is next?"

**Date:** 2026-09-27 · **PRD:** #292 · **Touches:** two skills of the `omni` plugin
(`kit/plugin/skills/brainstorm/SKILL.md`, `kit/plugin/skills/plan/SKILL.md`), the plugin's test
(`kit/test/plugin.test.mjs`) and two porting notes. No kit code, no command, no bundle, no page.

## Problem

`/omni:brainstorm` ends its last reply with a list of links (the PRD issue, the feature PR, the
phase-0 PR, the waves, the checks) and then one bare line, `/omni:yolo <n>`. Someone running their
first brainstorm is left guessing:

- **What to do first.** Nothing says the phase-0 PR must be reviewed and merged before
  `/omni:yolo` runs, nor that a person merges it, not the agent.
- **What the merge does.** Nothing says that merging the phase-0 PR puts the PRD in the inbox:
  approved, ready to build.
- **Where things are.** Nothing shows the PRD's folder, or which stage of the loop the PRD has
  reached (idea, PRD, inbox, outbox, shipped, retro).
- **Whether the session matters.** Nothing says they can `/clear` or open a new terminal before
  `/omni:yolo`, and lose nothing.

`/omni:plan`, run on its own, has the same bare ending.

## Solution

Both skills end with a short, tutorial-style hand-off. It is written for someone who knows nothing
about the loop and just does what it says, one step at a time.

### `/omni:brainstorm`, step 10

The reply keeps its report (the PRD issue, the feature PR, the phase-0 PR, the waves
`omni plan check` printed, every check that ran or did not). Then it always ends with three
blocks, in this order, every placeholder filled with a real path, number or link.

**1. The PRD's folder.** The tree of the folder, with a few words per file. The files are the ones
`omni prd <n>` lists; a scenario file, when `acceptance.enabled`, is listed under the tree.

```text
PRD 292's folder: on the phase-0 PR now, on main once it merges

  .omni-loop/delivery/inbox/0292-what-is-next/
  ├── spec.md            what changes, and why
  ├── plan.md            how it gets built, slice by slice
  └── before-after.html  today beside after
```

**2. Where it is.** The six stages of the loop on one line, a marker on PRD ("you are here") and one
on inbox (what the phase-0 merge does), then one plain line per stage.

```text
Where it is

  idea ──▶ PRD ──▶ inbox ──▶ outbox ──▶ shipped ──▶ retro
            ▲        ▲
            │        └─ merging the phase-0 PR moves it here
            └─ you are here

  idea     talked through, nothing written
  PRD      spec, plan and before/after written, in the phase-0 PR
  inbox    phase-0 PR merged: approved, ready to build
  outbox   being built: what the agents decided alone waits for you
  shipped  feature PR merged: the change is on main
  retro    a retro PR tells how the delivery went
```

**3. What is next?** Three numbered steps, then the command alone on the reply's last line.

```text
**What is next?**

1. Review the PRD: https://github.com/<owner>/<repo>/pull/<phase-0 PR>
   (spec, plan and before/after side by side: <dossier link>)
2. Merge that PR. → PRD 292 moves into the inbox.
3. Once it's merged, type /clear (or open a new terminal), then run:

/omni:yolo 292
```

The line in brackets appears only when `/omni:dossier-push` printed a dossier link; otherwise step 1
is the phase-0 PR alone.

### `/omni:plan`, step 7

- **Followed by `/omni:brainstorm` or `/omni:yolo`:** it returns to that skill and prints no
  "What is next?". The caller says what is next, so the reply never carries two.
- **Run alone:** after the slice table and the waves, it ends with:

```text
**What is next?**

1. Review the plan: https://github.com/<owner>/<repo>/pull/<feature PR>
2. Type /clear (or open a new terminal), then run:

/omni:yolo <n>
```

### The PRD issue

The Handoff's `Next command:` line in the issue `/omni:brainstorm` opens (step 2) becomes
``Next command: `/omni:yolo <n>`, once the phase-0 PR is merged``, so the issue and the reply say
the same thing.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | The brainstorm ends: report, folder, where it is, What is next?, command. | The folder and the stages give the context, then the steps, in the order a newcomer does them. (Asked: "before the what is next, explain the folder structure and the status".) |
| D2 | Step 1 links the phase-0 PR; the dossier link is a second line, only when one was printed. | The phase-0 PR always exists and is what gets merged; the dossier may not open. (Asked: "give the link of the PR".) |
| D3 | `/omni:yolo <n>` stays the last line of the reply, alone. | One line to copy, as today. |
| D4 | The stages are idea, PRD, inbox, outbox, shipped, retro; "you are here" is always PRD. | The person's words. A brainstorm always ends with the phase-0 PR open. |
| D5 | Plan run alone gets What is next? in two steps, with no folder and no stages. | It cannot tell whether its PRD's phase-0 PR merged, so a stage marker could be wrong. (Asked: "brainstorm + plan".) |
| D6 | When the brainstorm or yolo runs the plan, the plan prints no What is next?. | One hand-off per reply. |
| D7 | Short, imperative steps: "Review", "Merge", "type /clear, then run". | Tutorial style: the person does what it says. (Asked: "do short, like a tutorial".) |
| D8 | The templates are fixed text in the two skills, filled from config and real links. No new command. | The change is wording; a printing command is more than the brief needs. |

## User stories

1. As someone who just finished their first brainstorm, I read only the end of the reply and know
   where the PRD's files are, which stage it has reached, and the three things to do, in order, each
   with its link.
2. As that person, I know that merging the phase-0 PR moves the PRD into the inbox, and I run
   `/omni:yolo` only after that merge.
3. As that person, I know I can `/clear` or open a new terminal before `/omni:yolo`, and lose
   nothing.
4. As someone who ran `/omni:plan` on its own, I know to review the plan on the draft feature PR,
   then run `/omni:yolo <n>`.

## Scope

**In:**

- `kit/plugin/skills/brainstorm/SKILL.md`: step 10 (the three blocks, their rules) and step 2 (the
  issue's `Next command:` line).
- `kit/plugin/skills/plan/SKILL.md`: step 7 (return silently to a caller; What is next? when run
  alone).
- `kit/test/plugin.test.mjs`: the assertions under **Test seams**.
- `kit/porting/plugin--brainstorm.md` and `kit/porting/plugin--plan.md`: one **Changed** line each.

**Out:**

- The endings of every other skill (`/omni:yolo`, `/omni:wave`, `/omni:do-work`, `/omni:yolo-fix`,
  `/omni:invade`, `/omni:pr`).
- The brainstorm's `needs clarification` stop and the spike's ending: unchanged.
- Any kit code, `omni` command, the bundle, the Omni page or the dossier.

## Test seams

From the testing playbook: `pnpm test` runs vitest over `kit/`, tests sit beside their code or in
`kit/test/`, and no test calls GitHub.

- **`kit/test/plugin.test.mjs`**, a new block on the live skills, reading sections with the file's
  `skillSection` helper:
  - brainstorm `## 10.` names, in this order: `inbox/<folder>/`, `spec.md`, `plan.md`,
    `before-after.html`, the stages line `idea ──▶ PRD ──▶ inbox ──▶ outbox ──▶ shipped ──▶ retro`,
    `you are here`, `merging the phase-0 PR moves it here`, `**What is next?**`, `Review the PRD`,
    `Merge that PR`, `/clear`; and the last line of its last fenced block is `/omni:yolo <n>`.
  - plan `## 7.` names `**What is next?**`, `Review the plan`, `/clear`, and the last line of its
    last fenced block is `/omni:yolo <n>`.
  - brainstorm `## 2.` names `once the phase-0 PR is merged`.
- **The existing guards stay green:** `kit/test/no-literals.test.mjs` (no repository literal in a
  skill: the folder is written `<paths.delivery>/inbox/<folder>/`), `kit/test/no-game-words.test.mjs`,
  and the plugin guard's rule that every `omni <command>` a skill names exists.

## Risks

- **What merging publishes.** The plugin marketplace serves `kit/plugin`, so a merge changes the
  `/omni:brainstorm` and `/omni:plan` every repository installing the `omni` plugin gets. No kit
  code, no bundle, no database, no page.
- **Rollback.** Revert the feature PR's merge commit: the two skills end as today.
- **Alignment.** The markers under the stages line assume a monospaced terminal where `─`, `▶` and
  `▲` are one column wide. Where they are not, a marker drifts; the lines under it say the same
  thing in words.

## Acceptance criteria

1. `/omni:brainstorm` step 10 ends the reply with, in this order: the report, the PRD's folder as a
   tree (each file with its words), the stages line with "you are here" under PRD and "merging the
   phase-0 PR moves it here" under inbox, one line per stage, **What is next?** with three numbered
   steps, and `/omni:yolo <n>` alone as the last line.
2. Step 1 of that **What is next?** links the phase-0 PR, and the dossier link appears on a second
   line only when `/omni:dossier-push` printed one.
3. Step 2 says to merge that PR and that the PRD then moves into the inbox; step 3 says to type
   `/clear` or open a new terminal once it is merged, then run the command.
4. `/omni:plan` run alone ends with **What is next?** (review the plan on the draft feature PR,
   then `/clear` or a new terminal) and `/omni:yolo <n>` alone as the last line; run by
   `/omni:brainstorm` or `/omni:yolo`, it prints no **What is next?**.
5. The PRD issue template's Handoff reads ``Next command: `/omni:yolo <n>`, once the phase-0 PR is
   merged``.
6. `kit/porting/plugin--brainstorm.md` and `kit/porting/plugin--plan.md` each record the change
   under **Changed**.
7. `pnpm test` passes, the new `kit/test/plugin.test.mjs` assertions included.
