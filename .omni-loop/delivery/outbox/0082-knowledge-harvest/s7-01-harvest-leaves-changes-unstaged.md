---
id: s7-01-harvest-leaves-changes-unstaged
prd: 82
slice: s7
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When the harvest runs on a person's own computer, should it leave its changes ready to review but not yet marked for saving, or mark them for saving like the shipping step does?

## The decision, in plain words

It leaves every change in place, not yet marked for saving. The person reviews the changes, then marks and saves them themselves.

## The intro, for fun

Two ways to leave a desk tidy: papers in a pile, or papers already in the folder.

## The punchline, for fun

The harvest leaves the pile, so nothing is filed before someone reads it.

## The options, in plain words

A. Leave every change unstaged: plain file operations, the person stages and commits.
B. Stage every change after applying it, as omni ship stages its moves.

## What I had to decide

The spec says omni harvest writes into the working tree and never commits, like omni ship. omni ship stages its moves with git mv; the harvest also deletes item files and rewrites the ledger around the moves, which git mv does not handle cleanly on a folder holding a deleted tracked file.

## What I did meanwhile

applyHarvestEdits applies the edit set with plain file operations (delete, rename, write): the working tree changes, the index does not. The printed report ends with 'Review the diff and commit it.'

## What it costs to change later

One function: staging the result afterwards is a single git add over the moved and written paths, added to the command. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a reviewer expects the same staged state omni ship leaves; neither the spec nor the plan says.
