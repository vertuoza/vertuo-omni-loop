---
id: s2-02-missing-copy-fails-check
prd: 522
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When the config says the knowledge of a repository is copied into the plan repository but the copy's folder is not there, should the knowledge check fail or only warn?

## The decision, in plain words

The check fails and names the missing folder, because the config then claims something that is not true.

## The intro, for fun

The guest list says the cousin brought a cake.

## The punchline, for fun

There is no cake, so the party check says so.

## The options, in plain words

A. Fail the check, naming the folder (built).
B. Warn only, and let the check pass.

## What I had to decide

Whether a copied repository with no copy folder fails the knowledge check or only warns.

## What I did meanwhile

A plan repository whose config lists a copy it does not hold stays red until the copy is added or the config says own or none.

## What it costs to change later

Turning it into a warning is one line; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the spec says whether the config or the folder is the truth when they disagree (author).
