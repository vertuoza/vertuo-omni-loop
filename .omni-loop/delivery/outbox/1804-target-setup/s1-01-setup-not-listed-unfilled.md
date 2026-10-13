---
id: s1-01-setup-not-listed-unfilled
prd: 1804
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

When the install step cannot guess how to prepare a fresh copy of the project, should its closing list still name that step as one left to fill?

## The decision, in plain words

It is asked on a terminal and takes a flag like the others, but an empty answer means no preparation is needed, so the closing list never names it as unfilled.

## The intro, for fun

Some projects need nothing installed before their tests run.

## The punchline, for fun

Nagging them about it would be like reminding a bicycle to refuel.

## The options, in plain words

A. A. Never list the setup as unfilled: null means none is needed (built).
B. B. List it like the other commands, with its --setup flag, whenever it is null.

## What I had to decide

Whether a setup left empty is listed among the commands still to fill at the end of omni init.

## What I did meanwhile

omni init lists only test, preflight and preflightFull as unfilled; a null setup is read as none needed.

## What it costs to change later

One filter condition in kit/bin/commands/init.ts and the closing-steps tests that pin the list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says init asks for the setup when it cannot detect it, but not whether the closing list names it (author).
