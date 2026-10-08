---
id: s2-03-slice-worktree-per-prd
prd: 1205
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Two cross-repository PRDs built at once can both have a first slice in the same code repository: where does each slice's working folder go?

## The decision, in plain words

Each slice's working folder is named after its PRD as well as its slice, beside that PRD's own copy of the code repository, so two PRDs' slices never share a folder.

## The intro, for fun

Two first slices, one folder name, and a very confused filing cabinet.

## The punchline, for fun

Adding the PRD number to the label settles the argument.

## The options, in plain words

A. The slice folder carries the PRD number beside the slice id (built).
B. Keep the slice folder as it was and accept a clash when two PRDs share a slice id.
C. Put each slice folder inside the PRD's clone folder instead.

## What I had to decide

do-work --target built each slice in <worktrees>/targets/<name>--<slice>. With a clone per PRD, two PRDs running at once can both reach slice s1 in one target, and the same folder would be asked for twice. The plan does not list it, but the spec's isolation rule (no two running steps share a HEAD) needs it, so the slice worktree is now <worktrees>/targets/<name>@<prd>--<slice>.

## What I did meanwhile

do-work's Under --target section names the new folder in all three places.

## What it costs to change later

A constant: the folder name in kit/plugin/skills/do-work/SKILL.md. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) mega-bug-fix keeps <worktrees>/targets/<name> and its own --fix-<n> worktrees: it has no PRD and the loop never runs it, so it was left out of this slice's territory.
