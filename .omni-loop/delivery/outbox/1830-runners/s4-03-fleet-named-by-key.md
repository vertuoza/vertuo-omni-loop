---
id: s4-03-fleet-named-by-key
prd: 1830
slice: s4
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The picker names each fleet, and a fleet has both a short internal name and the label people see in the game. Which should the picker show?

## The decision, in plain words

The picker shows the fleet's internal name, the one the runners already carry, because reading the label would mean changing the shared runner code this part of the work does not own.

## The intro, for fun

A team's jersey says Cyan, but the roster calls them team three.

## The punchline, for fun

For now the picker reads the roster.

## The options, in plain words

A. Show the fleet's internal name.
B. Show the fleet's label, the board read carrying it.

## What I had to decide

Whether the picker and Queued for <target> name a fleet by its key (public.teams.name, what runners.fleet holds) or by its label (public.teams.label, as the mockup's Cyan suggests).

## What I did meanwhile

targets.ts labels a fleet option with runner.fleet, the key. Showing the label needs the board read (runners.service.ts, runners.repository.ts, s1's files) to carry each fleet's label, outside this slice's territory.

## What it costs to change later

A label field on the board read and one line in targets.ts; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a workspace's fleet keys read well to people is not known: in the seeded workspaces they are short lower-case words.
