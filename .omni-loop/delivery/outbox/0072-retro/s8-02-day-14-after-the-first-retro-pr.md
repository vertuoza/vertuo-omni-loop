---
id: s8-02-day-14-after-the-first-retro-pr
prd: 72
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Where does the second look, fourteen days later, go when the first retro pull request is no longer open?

## The decision, in plain words

While the first retro pull request is open, the second look is added to it. Once it has been merged, or closed without merging, a new pull request opens from the main line as it stands, holding the whole retro again with the new section.

## The intro, for fun

The follow-up visit arrives to find the first appointment already closed.

## The punchline, for fun

So it books a fresh room and brings the whole file along.

## The options, in plain words

A. Open a new pull request from the main line whenever the first is no longer open, merged or closed, the option built.
B. When the first was closed without merging, add nothing and open nothing.
C. Start the new branch from the merged feature instead, which clashes with the retro files already merged.

## What I had to decide

The spec says the day-14 run commits to the same branch while its PR is open and opens `<branch>-day-14` once it is merged. It does not say where that branch starts, nor what a first PR closed without merging leads to.

## What I did meanwhile

`publishRetro` lists the PRs from the `branches.retro` branch: an open one (or none at all) keeps the day-14 commit there. Otherwise it cuts `<branch>-day-14` from the head of `repo.defaultBranch` and writes the merge run's record again beside the day-14 one, so the retro is whole even when the first PR was never merged. On a replay, a merged PR that already holds the branch's head is not opened again.

## What it costs to change later

A constant in `publish.mjs`: which PR states count as gone, and the ref the new branch is cut from.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a first retro pull request closed without merging means the retro was refused, so the second look should open nothing.
