---
id: s4-01-prd-number-still-shows-the-overview
prd: 315
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When someone asks the status command in Claude about one PRD by its number, what should it do?

## The decision, in plain words

It shows the whole repository's overview anyway, then adds one line saying it has no view of a single PRD and that their own PRDs are listed in it.

## The intro, for fun

Someone asks the overview about one PRD, and the overview only knows how to show them all.

## The punchline, for fun

So it shows them all, and points at the row that answers.

## The options, in plain words

A. Show the whole overview anyway, then one line saying it covers every PRD and lists theirs: the option built.
B. Name what the command takes, a request for fresh data or nothing, and stop without showing anything, as the ask mode command does.
C. Show the whole overview, then repeat below it the row of that PRD when it is one of theirs.

## What I had to decide

What `/omni:status` does with an argument other than a request for fresh data, such as a PRD number. The spec says the skill runs `omni status`, with `--fetch` when the person asks for fresh data, and never runs the gate; it says nothing of any other argument. `/omni:ask`, the thin skill the spec names as its model, answers an unknown argument by naming the words it takes and stopping.

## What I did meanwhile

`kit/plugin/skills/status/SKILL.md`, under Input: a PRD number or anything else runs the overview anyway (fetching first when fresh data was also asked for), then one line under it says `/omni:status` shows the whole repository, never one PRD alone, and that the person's own PRDs are listed in it with where each stands. The gate is never run: the plugin test pins that no `omni status <`, PRD number or gate flag appears in the skill.

## What it costs to change later

A few lines of prose in one skill. No code, no stored data, no command changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan say what the skill runs and that it never runs the gate, and nothing about an argument it does not take.
- (author) Whether people will type a PRD number after the command at all is not known.
