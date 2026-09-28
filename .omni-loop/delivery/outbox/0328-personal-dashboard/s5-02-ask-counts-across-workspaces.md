---
id: s5-02-ask-counts-across-workspaces
prd: 328
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Someone can belong to several workspaces, and the dashboard shows one of them. Should Questions answered and Waiting for you count only that workspace's questions, or all of that person's questions?

## The decision, in plain words

They count all of the person's questions, as the questions pages do, since a question waiting in another workspace still waits for them. Outbox settled and PRDs created count only the workspace shown, like the rest of the dashboard.

## The intro, for fun

Two workspaces, one pile of questions, and a dashboard that can only wear one badge.

## The punchline, for fun

The game's numbers stay home, and the questions follow you wherever you go.

## The options, in plain words

A. Count the person's questions in every workspace, as the questions pages do (the option built).
B. Count only the questions of the workspace the dashboard shows, and let the page the tile links to show more than the tile.

## What I had to decide

Whether the two counts read from the ask tables are narrowed to the workspace the dashboard shows, as the part contract says of every read, or read as the ask pages read them, across every workspace the person belongs to.

## What I did meanwhile

Questions answered counts the rounds the person answered in any workspace they can read; Waiting for you uses readTabs and readForMe unchanged, which read every workspace. Outbox settled and PRDs created filter on the workspace shown. For a person in one workspace, both readings give the same numbers.

## What it costs to change later

One filter per read in the counts' folder; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how many people belong to more than one workspace today was not checked
- (author) the part contract's line that every read filters on the workspace was written before the ask reads were built, and the spec's data table names no workspace for them
