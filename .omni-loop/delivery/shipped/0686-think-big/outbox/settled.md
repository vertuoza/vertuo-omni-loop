# Settled outbox items — PRD 686

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-update-test-knows-concept-label -->

## s1-01-update-test-knows-concept-label — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-update-test-knows-concept-label
prd: 686
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new concept label made an older test of the kit's update step expect one more label, and the plan had not given this slice that test. Was it right to add the label to that test's list?

## The decision, in plain words

We added the new label to the list of labels that test pretends a repository already has, and changed nothing else in it.

## The intro, for fun

A new label walked in, and an old test counted the chairs again.

## The punchline, for fun

One more chair, same table, nobody had to move.

## The options, in plain words

A. Add the new label to that test's fixture list, the option built.
B. Leave that test alone and let the update step's report say one label was created, changing its expected output instead.
C. Make that test read the label list from the kit's own label table, so a new label never needs a test edit again.

## What I had to decide

Whether s1 may touch `kit/bin/update.test.mjs`, outside its territory, to keep the suite green once `labels.concept` exists.

## What I did meanwhile

Its `LOOP_LABELS` fixture gains `'omni:concept'`, so its fake `gh label list` still holds every loop label and `omni update --apply` still reports `labels   ok`. No assertion changed.

## What it costs to change later

One string in one test fixture; undone by removing it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for s1 lists `kit/bin/init.test.mjs` but not `kit/bin/update.test.mjs`, which holds its own copy of the loop label list (author)

```

<!-- /omni-outbox-settled: s1-01-update-test-knows-concept-label -->

<!-- omni-outbox-settled: s1-02-shared-branch-verdict-shell -->

## s1-02-shared-branch-verdict-shell — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-shared-branch-verdict-shell
prd: 686
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new concept check was a near copy of the bug and visual fix checks, so the repository's quality gate refused every commit. Should the three checks share one piece of code, even though that changes the older two?

## The decision, in plain words

The concept, bug and visual checks, and the phase-0 check, now share one piece of code for reading the branch and printing the verdict. Their behaviour and their messages stay the same.

## The intro, for fun

Three checks walked in wearing the same outfit, and the gate would not let them through.

## The punchline, for fun

Now they share one wardrobe and each keeps its own hat.

## The options, in plain words

A. A. Share one shell and one set of folder and page checks across the four commands and three verdicts, the option built.
B. B. Share them only between the concept check and a new helper, leaving bug and visual as they were; the gate still counts the copies they hold of the helper as new.
C. C. Add the concept check's copies to the gate's baseline so the gate stops counting them.

## What I had to decide

Whether the wave's fix for the duplication and complexity gate may refactor `omni bug`, `omni visual` and `omni phase0`, which no slice owns, onto a shared `kit/bin/branch-range.mjs`, and move the folder finder and raster check into `kit/lib/fix-verdict.mjs`.

## What I did meanwhile

Added `kit/bin/branch-range.mjs` (the base ref, the range's commits and paths, and the `omni <verb> <n> [--base <ref>]` shell); `concept`, `bug` and `visual` are each one call to it, and `phase0` reuses its base and commit readers. `numberedFolders` and `rasterFaults` moved into `kit/lib/fix-verdict.mjs`. The concept verdict's `folderFaults` and `networkLoads` and the Areas parser were split into smaller functions. Every message and exit code is unchanged, and each command's tests pass as they were.

## What it costs to change later

Reverting it means copying the helpers back into four command files and three verdicts, and the gate refusing commits again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The gate's own thresholds were read from its findings, not from a written rule in this repository (author).

```

<!-- /omni-outbox-settled: s1-02-shared-branch-verdict-shell -->

<!-- omni-outbox-settled: s3-01-area-screens-from-brief -->

## s3-01-area-screens-from-brief — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-area-screens-from-brief
prd: 686
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

A concept lists its areas with a name and a one-line brief, but not which screens of its vision tour each area covers. How should the brainstorm know which screens to start the new page from?

## The decision, in plain words

The brainstorm takes the screens that the area's brief or the concept's vision names for that area; when neither names any, it picks the screens that show what the brief describes, and says which ones it took so the person can correct the pick before the first question.

## The intro, for fun

The map says where each area lives, but forgot to draw the streets.

## The punchline, for fun

So the brainstorm reads the signposts, and asks if it guessed the right street.

## The options, in plain words

A. Read the screens from the words of the area's brief and the vision, and show the pick to the person to correct, the option built.
B. Add a fifth column to the concept's areas table naming the screens each area covers, filled by the studio and checked by the concept check.
C. Have the studio mark each screen of the vision tour with the area it belongs to, and have the brainstorm read that mark.

## What I had to decide

How `/omni:brainstorm --concept` finds the area's screens in `vision.html`. The spec's crown step says each area carries "the vision tour's screens it covers", but the `concept.md` Areas table it defines (and `kit/lib/concept/parse.mjs` enforces) has only `id | area | brief | PRD`, and nothing says how `vision.html` marks a screen's area.

## What I did meanwhile

The **From a concept** section of `kit/plugin/skills/brainstorm/SKILL.md` takes the screens of `vision.html` that the area's brief or **The vision** names for it, or, when neither names any, those that show what its brief describes; step 1 names the screens it took in its write-back, so the person corrects the pick before anything is written.

## What it costs to change later

Two sentences of skill prose. A later marker (a column, or an attribute on each screen of the vision tour) replaces them without touching any concept already merged.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's crown step lists the screens an area covers, but `concept.md`'s Areas table has no column for them and `omni concept` checks none.
- (author) `/omni:think-big` (slice s2) is written in parallel, so how its vision tour marks screens was not known when this was written.

```

<!-- /omni-outbox-settled: s3-01-area-screens-from-brief -->

<!-- omni-outbox-settled: s4-01-live-run-needs-a-person -->

## s4-01-live-run-needs-a-person — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-09-30T06:38:57Z
- Channel: feature pull request #689
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/689#issuecomment-5905617945
- Basis: affirmation — the answer opens with "ok" and carries no contradiction marker
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: human-action
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 3
- Stays here: The person confirmed the live run of this PRD's own skill; it proves what was built and sets no lasting rule. The run's findings are in `live-run.md`.

### The answer, as it was given

```text
ok
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s4-01-live-run-needs-a-person -->
