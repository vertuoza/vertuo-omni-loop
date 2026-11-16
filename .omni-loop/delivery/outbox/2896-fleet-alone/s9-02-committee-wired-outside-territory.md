---
id: s9-02-committee-wired-outside-territory
prd: 2896
slice: s9
rank: medium
bears-on: none
raised: 2026-11-15
wave: 9
---

## The question, in plain words

The new committee command and its runner line had to be listed in two places outside this slice's ground. Is that acceptable?

## The decision, in plain words

Two one-line changes outside the slice: the list of the kit's commands now names the committee command, and the guide's Runners page names the committee among the lines a runner takes, since a test holds that page to the runner's list.

## The intro, for fun

The new colleague needed a badge and a line in the phone book.

## The punchline, for fun

Both took one line, and nobody else moved desks.

## The options, in plain words

A. Keep the two one-line changes outside the territory (built).
B. Move them to a slice whose territory holds the command table and the guide.

## What I had to decide

Whether the command table and the guide's runner list may each take the one line the committee needs, outside s9's territory.

## What I did meanwhile

kit/bin/commands/index.ts registers omni committee; docs/guide/runners.md lists /omni:committee.

## What it costs to change later

Reverting either is one line; without them the command does not exist and the guide's test fails.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s13 rewrites the guide's Missions page and may want the committee described there as well
