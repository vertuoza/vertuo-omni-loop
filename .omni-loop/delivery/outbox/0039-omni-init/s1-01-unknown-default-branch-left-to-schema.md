---
id: s1-01-unknown-default-branch-left-to-schema
prd: 39
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When neither GitHub nor the local copy can say which branch is the main one, what should the installer write down?

## The decision, in plain words

It writes nothing for it, so the loop assumes the usual name, main. The person reviewing the new settings file before committing it sees the assumption and can correct it.

## The options, in plain words

A. Leave the default branch out so the schema default applies, and write an unknown slug as null (built).
B. Write the currently checked-out branch as the default branch.
C. On a terminal, ask for the default branch; otherwise leave it out.

## What I had to decide

What repo.defaultBranch (and repo.slug) become in the written config when gh cannot answer and origin/HEAD is not set.

## What I did meanwhile

repo.defaultBranch is left out of the written config, so the schema default applies; an unknown slug is written as null, which the schema allows and which every command already fills from the origin remote at load time.

## What it costs to change later

A few lines in the config writer; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the current branch, or a prompt on a terminal, would be a better guess than the schema default was not settled by the spec.
