---
id: s5-01-s5-files-outside-territory
prd: 2632
slice: s5
rank: medium
bears-on: none
raised: 2026-11-04
wave: 4
---

## The question, in plain words

The new business laws gate needs a new secret and a switch-on in the App, which touches four files the plan did not list for this slice. Is it right that this slice changed them?

## The decision, in plain words

The slice also changed the App's function wiring, the App's environment test, and the two README lists of settings, because the code cannot work or pass its own checks without them.

## The intro, for fun

A new gate walked in and asked for a key, and the key needed a drawer.

## The punchline, for fun

The drawers were four files over the line.

## The options, in plain words

A. Keep the four small edits in this slice, as built
B. Move them into a follow-up slice and leave the gate unplugged until then

## What I had to decide

Territory read as written leaves the gate unplugged: apps/omni-app/src/functions.ts must hand the judge to the inbox check, apps/omni-app/src/env.test.ts lists every group the App reads, and the two READMEs (apps/galaxy/README.md, apps/omni-app/README.md) must name every variable the env.ts files read or env-docs.test.ts fails. Each edit is one added line or entry.

## What I did meanwhile

The gate code, route and tests stand either way; only the plug-in and the documentation lines differ.

## What it costs to change later

A person reads four small extra edits in the sub-PR.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists no README, functions.ts or env.test.ts in this slice, so whether the owner wants them here was not settled.
