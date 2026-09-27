---
prd: 301
title: The yolo and the yolo-fix end with a plain "What is next?"
blocked-by: none
spec: file
---

# The yolo and the yolo-fix end with a plain "What is next?"

**Date:** 2026-09-27 · **PRD:** #301 · **Touches:** two skills of the `omni` plugin
(`kit/plugin/skills/yolo/SKILL.md`, `kit/plugin/skills/yolo-fix/SKILL.md`), the plugin's test
(`kit/test/plugin.test.mjs`) and two porting notes. No kit code, no command, no bundle, no page.
It follows PRD 292, which gave `/omni:brainstorm` and `/omni:plan` the same kind of ending.

## Problem

`/omni:yolo` ends its last reply with a report written for someone who already knows the loop: the
feature PR and its state, slices merged out of total, the checks, every open outbox item with its
rank and file. `/omni:yolo-fix` ends the same way, then says "A person merges #<feature PR>". Someone
running their first yolo is left guessing:

- **What happened.** Did the PRD ship? What is a green gate, a red gate, a held run? Where did its
  files go (`omni ship` moved them out of the inbox)?
- **Where it is.** Nothing shows which stage of the loop the PRD has reached (idea, PRD, inbox,
  outbox, shipped, retro), nor that merging the feature PR is what makes it shipped.
- **What to do now.** On a green gate, that a person reviews and merges the feature PR, and that the
  retro PR and the knowledge PR follow the merge. On a red gate, where the questions are, how to
  answer them, and that `/omni:yolo-fix <n>` does nothing until they are answered. On a held run,
  what holds it and what to run once it is cleared.
- **Whether the session matters.** That they can `/clear` or open a new terminal before the next
  command, and lose nothing.

## Solution

Both skills end the way `/omni:brainstorm` ends since PRD 292: a short, tutorial-style hand-off
written for someone who knows nothing about the loop and just does what it says, one step at a time.

### `/omni:yolo`, step 7

The heading becomes `## 7. Hand off`. The reply keeps its report (the feature PR and its state,
slices merged out of total with each held slice's reason, the checks that ran and did not, every open
outbox item with its rank and file). Then it always ends with three blocks, in this order, every
placeholder filled with a real path, number or link, read from `omni prd <n>` run on the feature
branch as the run leaves it.

**1. The PRD's folder.** Its path is the `dir` that `omni prd <n>` prints, then each file it lists,
a few words each. `release.md` appears only when it is listed. When the PRD shipped, its outbox sits
inside the folder, as `outbox/`:

```text
PRD 301's folder: on the feature PR now, on main once it merges

  .omni-loop/delivery/shipped/0301-yolo-what-is-next/
  ├── spec.md            what changes, and why
  ├── plan.md            how it is built, slice by slice
  ├── before-after.html  today beside after
  ├── release.md         what ships, in plain words
  └── outbox/            every decision the agents took, and how each was settled
```

When it did not ship, the folder is still in the inbox and its outbox is a folder of its own (the
`outbox` path `omni prd <n>` prints). When that folder exists on the branch, a second tree follows,
with one line per open item file and `settled.md` when it is there:

```text
  .omni-loop/delivery/outbox/0301-yolo-what-is-next/
  ├── s1-02-….md         open: a question waiting for you
  └── settled.md         the decisions already settled
```

**2. Where it is.** The same six stages and the same six lines as the brainstorm's hand-off, word
for word, with the markers moved on: "you are here" under outbox, and "merging the feature PR moves
it here" under shipped. They are the same on every ending: the feature PR is not merged, whatever
the gate read.

```text
Where it is

  idea ──▶ PRD ──▶ inbox ──▶ outbox ──▶ shipped ──▶ retro
                               ▲           ▲
                               │           └─ merging the feature PR moves it here
                               └─ you are here

  idea     talked through, nothing written
  PRD      spec, plan and before/after written, in the phase-0 PR
  inbox    phase-0 PR merged: approved, ready to build
  outbox   being built: what the agents decided alone waits for you
  shipped  feature PR merged: the change is on main
  retro    a retro PR tells how the delivery went
```

**3. What is next?** One of three, by how the run ended.

**Green:** the gate was green, `omni ship` is committed and the feature PR is ready.

```text
**What is next?**

1. Review the change: https://github.com/<owner>/<repo>/pull/<feature PR>
   (the diff, and the outbox comment listing every decision the agents took)
2. Merge that PR. → PRD 301 is shipped: the change is on main.
3. If the omni-loop app is installed, it then opens a retro PR (how the delivery went)
   and a knowledge PR (the decisions, written back): review and merge each.

Nothing to run: merging #<feature PR> is yours.
```

When `/omni:pr`'s lifecycle left the ready feature PR's CI stuck, the line in brackets under step 1
names the red check instead: `(its CI is red: <check>; it must be green before you merge)`.

**Red:** every slice merged, the gate red, the feature PR still a draft, the outbox comment posted.

```text
**What is next?**

1. Read the questions: https://github.com/<owner>/<repo>/pull/<feature PR>#issuecomment-<id>
2. Answer each one in a comment on that PR, as the questions explain: `2: A`,
   `2: B because …`, or `go with recommendation` for all of them. Nothing changes until step 3.
3. Once you've answered, type /clear (or open a new terminal), then run:

/omni:yolo-fix 301
```

`<id>` is the comment's id the `omni comment` line printed (`pull request comment #<id>`); when it
printed none, step 1 links the feature PR alone.

**Held:** a slice stuck, stopped, blocked or in flight, a wave's check red, or a finish or a ship
that stayed red.

```text
**What is next?**

1. See what holds it: https://github.com/<owner>/<repo>/pull/<the PR that holds it>
2. <the one thing a person must do: the human steps of the final status comment>
3. Once that's done, type /clear (or open a new terminal), then run:

/omni:yolo 301
```

The PR that holds it is the stuck sub-PR when there is one, the feature PR otherwise.

The last line of the reply is always the ending's own: `Nothing to run: merging #<feature PR> is
yours.`, `/omni:yolo-fix <n>` or `/omni:yolo <n>`, alone on it. Step 5's red-gate report line and
step 7's closing "A person merges the feature PR" line go: the hand-off says both.

**Before step 2, no hand-off.** A run that stops before it picks up the feature PR (the config does
not read, the checkout is not clean, the PRD is in another state, `/omni:plan` needs clarification)
keeps its one line: nothing was built, so there is nothing to hand off.

### `/omni:yolo-fix`, step 8

The heading becomes `## 8. Hand off`. The reply keeps its report (what step 3 settled, the reworks,
the checks, the gate and the feature PR's state), drops the line "A person merges #<feature PR> into
`repo.defaultBranch`.", and ends with `/omni:yolo` §7's hand-off, as written. It already follows
`/omni:yolo` §4 to §6 that way. One difference: the held ending's command is `/omni:yolo-fix <n>`,
since that is what a held rework resumes with. The red ending already runs `/omni:yolo-fix <n>`.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Both `/omni:yolo` and `/omni:yolo-fix` get the hand-off. | Asked: "yolo + yolo-fix". Yolo-fix ends at the same gate, and after a red gate it is the next reply the person reads. |
| D2 | The hand-off is written once, in `/omni:yolo` §7; yolo-fix step 8 follows it "as written", naming only its held command. | Yolo-fix already follows `/omni:yolo` §4 to §6 that way. One copy cannot drift. |
| D3 | Three endings, green, red and held, each with its own **What is next?** and its own last line. | Each asks something different of the person: merge, answer, or clear a blocker. |
| D4 | The green ending's last line is `Nothing to run: merging #<feature PR> is yours.` | Asked: "merge line last". There is no command to run, and the merge is a person's. |
| D5 | "You are here" is under outbox and the merge marker under shipped, on every ending. | The feature PR is not merged on any of them. The **What is next?** carries the difference. |
| D6 | The six stage lines are the brainstorm's, word for word. | One legend for the whole loop, learned once. |
| D7 | The folder tree comes from `omni prd <n>` on the feature branch: a shipped folder with its `outbox/` inside, or the inbox folder with its outbox folder as a second tree. | The same command the brainstorm's tree reads. It shows where the files really are after `omni ship`. |
| D8 | Step 1 of the red ending links the outbox comment itself, through the id `omni comment` prints. | The questions are what the person reads first; the PR alone makes them look for it. |
| D9 | A run that stops before step 2 prints no hand-off. | Nothing was built. |
| D10 | The templates are fixed text in the skill, filled from config and real links. No new command. | The change is wording, as in PRD 292. |

## User stories

1. As someone whose first yolo just ended green, I read only the end of the reply and know that the
   build is done and waits for my review, that merging the feature PR ships it, and that a retro PR
   and a knowledge PR come after.
2. As someone whose yolo ended red, I know where the questions are, how to answer them, and that I
   run `/omni:yolo-fix <n>` once I have, after `/clear` if I like.
3. As someone whose yolo was held, I know which PR holds it, what I must do, and what to run after.
4. As any of them, I see where the PRD's files are now and which stage of the loop it has reached.
5. As someone whose `/omni:yolo-fix` just ended, I read the same three blocks, with the command that
   resumes it.

## Scope

**In:**

- `kit/plugin/skills/yolo/SKILL.md`: step 7 (the heading, the report kept, the three blocks and
  their rules), step 5's red-gate report line.
- `kit/plugin/skills/yolo-fix/SKILL.md`: step 8 (the heading, the report kept, the closing line
  replaced by `/omni:yolo` §7's hand-off with its held command).
- `kit/test/plugin.test.mjs`: the assertions under **Test seams**.
- `kit/porting/plugin--yolo.md` and `kit/porting/plugin--yolo-fix.md`: one **Changed** line each.

**Out:**

- The endings of `/omni:brainstorm` and `/omni:plan` (PRD 292) and of every other skill
  (`/omni:wave`, `/omni:do-work`, `/omni:invade`, `/omni:pr`).
- What yolo and yolo-fix build, check, push, label, comment or mark ready: only the reply's ending
  moves.
- Any kit code, `omni` command (`omni comment` and `omni prd` print what they print today), the
  bundle, the Omni page, the dossier, the omni-loop app.

## Test seams

From the testing playbook: `pnpm test` runs vitest over `kit/`, tests sit beside their code or in
`kit/test/`, and no test calls GitHub.

- **`kit/test/plugin.test.mjs`**, a new block on the live skills, reading sections with the file's
  `skillSection` helper:
  - yolo `## 7. Hand off` names, in this order: `<dir>/`, `spec.md`, `plan.md`,
    `before-after.html`, `release.md`, `outbox/`, `settled.md`, the stages line
    `idea ──▶ PRD ──▶ inbox ──▶ outbox ──▶ shipped ──▶ retro`, `you are here`,
    `merging the feature PR moves it here`, then `Review the change`, `Merge that PR`, `retro PR`,
    `knowledge PR`, then `Read the questions`, `#issuecomment-`, `/clear`, then
    `See what holds it`, `/clear`.
  - Its fenced blocks that open with `**What is next?**` are three, and their last non-blank lines
    are, in order, `Nothing to run: merging #<feature PR> is yours.`, `/omni:yolo-fix <n>` and
    `/omni:yolo <n>`.
  - yolo-fix `## 8. Hand off` names `/omni:yolo` §7 and `/omni:yolo-fix <n>`, and no longer
    `A person merges`.
  - A fixture proves the check fails when a phrase is removed, when an ending's last line changes,
    and when an ending is missing.
- **The existing guards stay green:** `kit/test/no-literals.test.mjs` (no repository literal in a
  skill: paths are written `<dir>/` and `<paths.delivery>`), `kit/test/no-game-words.test.mjs`,
  PRD 262's release-note block (step 5's order is unchanged), and the plugin guard's rule that every
  `omni <command>` a skill names exists.

## Risks

- **What merging publishes.** The plugin marketplace serves `kit/plugin`, so a merge changes the
  `/omni:yolo` and `/omni:yolo-fix` every repository installing the `omni` plugin gets. No kit
  code, no bundle, no database, no page.
- **Rollback.** Revert the feature PR's merge commit: the two skills end as today.
- **Alignment.** The markers under the stages line assume a monospaced terminal where `─`, `▶` and
  `▲` are one column wide. Where they are not, a marker drifts; the lines under it say the same
  thing in words.
- **The app.** The green ending says the retro and knowledge PRs come "if the omni-loop app is
  installed". A repository without it gets neither, and the sentence says so.

## Acceptance criteria

1. `/omni:yolo` step 7 is headed `## 7. Hand off` and ends the reply with, in this order: the report,
   the PRD's folder as a tree read from `omni prd <n>` (with `release.md` only when listed, `outbox/`
   inside a shipped folder, or the outbox folder as a second tree), the stages line with "you are
   here" under outbox and "merging the feature PR moves it here" under shipped, the six stage lines,
   and one of the three **What is next?** endings.
2. The green ending: review the feature PR, merge it (PRD n is shipped), the retro and knowledge PRs
   if the app is installed, then `Nothing to run: merging #<feature PR> is yours.` alone as the last
   line. A ready feature PR with stuck CI names the red check under step 1.
3. The red ending: the outbox comment's link, how to answer, `/clear`, then `/omni:yolo-fix <n>`
   alone as the last line.
4. The held ending: the PR that holds it, what a person must do, `/clear`, then `/omni:yolo <n>`
   alone as the last line.
5. A run that stops before step 2 prints no hand-off.
6. `/omni:yolo-fix` step 8 is headed `## 8. Hand off`, keeps its report, drops "A person merges …",
   and ends with `/omni:yolo` §7's hand-off, its held ending running `/omni:yolo-fix <n>`.
7. `kit/porting/plugin--yolo.md` and `kit/porting/plugin--yolo-fix.md` each record the change under
   **Changed**.
8. `pnpm test` passes, the new `kit/test/plugin.test.mjs` assertions included.
