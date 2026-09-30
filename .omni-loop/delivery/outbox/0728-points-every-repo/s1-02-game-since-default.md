---
id: s1-02-game-since-default
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

A workspace created after this change: when does its game start?

## The decision, in plain words

At the moment it is created. Every workspace that already exists starts at the moment the change is applied, as the spec asks.

## The intro, for fun

The starting pistol fires once for everyone already on the track.

## The punchline, for fun

Late runners get their own pistol.

## The options, in plain words

A. A new workspace starts when it is created, the option built.
B. A new workspace has no start and counts everything its repositories ever delivered.

## What I had to decide

What the new game start moment holds for a workspace made after the migration. The spec only says the migration sets it to the moment it is applied.

## What I did meanwhile

The column is required, defaulting to now: existing workspaces get the migration's moment, a new one its creation moment.

## What it costs to change later

A migration that drops the default, or makes the column optional, if a new workspace should instead replay its repositories' history.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a workspace created later should count PRDs delivered before it was created
