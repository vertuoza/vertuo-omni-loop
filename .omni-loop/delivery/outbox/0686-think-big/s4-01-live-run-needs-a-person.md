---
id: s4-01-live-run-needs-a-person
prd: 686
slice: s4
rank: human-action
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

Someone has to try the new idea studio for real: give it a big idea, react to its concepts round after round, crown one and merge the proposal it opens. Those picks are a person's to make, so the live run has not happened yet.

## The decision, in plain words

Nothing was tried on a person's behalf: no idea was chosen, no concept was picked and nothing was merged. The run's record says so, with what was checked ahead of it, and the steps below are what a person does.

## The intro, for fun

The studio is built, the lights are on and the critics are warming up.

## The punchline, for fun

The director's chair is still empty, and critics cannot crown their own favourite.

## What a person must do

Before the run:

1. Create the label `omni:concept` on vertuoza/vertuo-omni-loop, with the colour and description `omni init` uses (`labels.autoCreate` is false here, so no agent creates it): `gh label create "omni:concept" --color fbbf24 --description "Omni Loop: a vast idea explored as a concept, before it becomes PRDs"`.
2. Open a Claude Code session in a checkout of `feat/think-big`, and have it follow that branch's `kit/plugin/skills/think-big/SKILL.md` as written (and, at step 7, its `kit/plugin/skills/brainstorm/SKILL.md`): until #689 merges, `main` and the installed plugin have no `/omni:think-big`, no `omni concept` and no `labels.concept` or `branches.concept`.

The two gates (neither writes anything):

3. `/omni:think-big '<a tweak, in your words>'`: a colour, a spacing or a label on a screen that exists. Seen when it states the scale as a tweak, gives the `/omni:visual-fix '<line>'` line and stops, and no issue, branch, PR or file appears (step 0's draft dossier is allowed).
4. `/omni:think-big '<a feature one PRD would carry, in your words>'`. Seen when it says plainly that one PRD would carry it and asks one question: `/omni:brainstorm '<line>'` now, or a lite run. Answer "brainstorm now" to end it there.

The run:

5. `/omni:think-big '<a real vast idea for this repository, in your words>'`. React to round 1's board (six to eight concepts) with its "copy my reactions" line; ask for at least one deeper round of clickable prototypes; check that the panelists answer each other by name; crown one concept; edit the area map in one reply. Every pick is yours.
6. At step 6 (record): the concept worktree is cut from `origin/main`, whose kit has no `concept` verb, so the skill's `node .omni-loop/bin/omni.mjs concept <n>` fails there. Run the feature branch's kit from inside the concept worktree instead, `node <your feat/think-big checkout>/kit/bin/omni.mjs concept <n>`, until it prints `ok`. The skill then opens the `docs(concept): <title>` PR into `main`, labelled `omni:concept`.
7. Review and merge that concept PR yourself. Then `/clear`, and from the feature branch's brainstorm skill run `/omni:brainstorm --concept <n> <wedge id>`: seen when it writes back the wedge's brief, the vision and the verdict before its first question (stop there, or carry on into a real PRD); then `/omni:brainstorm --concept <n> nope`: seen when it stops naming the concept's area ids. If you choose not to merge the concept PR, skip this step and say so in the record.

The record:

8. On `feat/think-big--s4` (sub-PR #710), rewrite `.omni-loop/delivery/inbox/0686-think-big/live-run.md` with what was seen and what was not, linking the concept issue, the concept PR and the feature PR #689, and link the concept PR from #689's body (acceptance criterion 9). Commit it signed, run `pnpm test`, push, then reply `<n>: done` to this question on the feature PR, so the sub-PR can be marked ready and merged into the feature branch.

## What I had to decide

Slice s4 is the live run of `/omni:think-big`: the plan's done-when for s4, the spec's acceptance criteria 9 to 11. Every part of it needs a person. The vast brief and the two gate lines are the person's words; each round's reactions, the crown and the area-map edits are the person's picks, and the skill never picks for them; the concept PR into `main` is merged by a person; and `/omni:brainstorm --concept` reads the concept from `main`, so it can only run after that merge. The slice was taken by a wave subagent that has no question tool, may not spawn the studio's agents, and may not answer, pick, crown or merge in a person's place.

## What I did meanwhile

Wrote `live-run.md` beside the plan: not run yet, what was checked ahead of the run (the `omni:concept` label missing on GitHub; `main` without the skill, the `omni concept` verb or the two config keys; how to run `omni concept` from the feature branch's kit inside the concept worktree), and every criterion marked not seen. Ran no gate and no round, and opened no dossier, issue, branch or PR.

## What it costs to change later

Nothing to undo: the run only proves what s1 to s3 built. Until it happens, the studio's conversation (the gate, the debate, the boards, the crown) has no evidence beyond the tests on the skill's text, and the feature PR cannot claim acceptance criteria 9 to 11.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which vast brief, which tweak and which feature line to run are the person's choice; nothing in the PRD names them.
- (author) The spec does not say whether the concept PR may merge into `main` before PRD 686's feature PR does, yet the hand-off can only be seen once it has. `main`'s layout skips an `inbox/concepts/` folder by construction (it reads only `<number>-<topic>` folders), but no reader on `main` was run against one.
- (author) Whether the session that runs it can search the web (the fuel's references) and continue agents (the debate) is not known from here; the skill has a fallback for each and says so when it uses it.
