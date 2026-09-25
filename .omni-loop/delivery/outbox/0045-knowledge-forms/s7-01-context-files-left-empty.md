---
id: s7-01-context-files-left-empty
prd: 45
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

This repository has no top-level instructions file for coding agents, so the setting that lists such files named one that does not exist. Should it list the arcade's own instructions file instead, or nothing?

## The decision, in plain words

It lists nothing. The arcade's instructions file is a note about the arcade's web framework, so every other change would read a note that does not concern it.

## The options, in plain words

A. The list is empty: nothing at the top of the repository, and the arcade's note stays with the arcade.
B. The list names the arcade's instructions file, so every change reads it before building.
C. The list names the repository's front page instead, so every change reads that first.

## What I had to decide

Spec step 6 has `/omni:terraform` propose `paths.context`, and the skill's step 5 table proposes it when "its list names a missing file, or misses a `CLAUDE.md` or `AGENTS.md` the tree holds: the files that exist, `[]` when none". The before/after page's column for this repository says `paths.context: []`, "because CLAUDE.md does not exist". But the tree holds `apps/galaxy/AGENTS.md` (the Next.js agent note `next dev` writes) and `apps/galaxy/CLAUDE.md` (a one-line `@AGENTS.md`), both about the arcade alone. Neither the spec nor the skill says whether a nested file counts.

## What I did meanwhile

`.omni-loop/config.yml` sets `paths.context: []`, with a comment saying why, in its own commit (`chore(config): paths.context names no missing file (s7)`). `omni config` prints it and `omni check all` stays green. `/omni:do-work`, `/omni:plan` and `/omni:brainstorm` read no context file here; the session-start hook in `.claude/settings.json` prints the briefing instead.

## What it costs to change later

A constant: one line of config. Listing `apps/galaxy/AGENTS.md` later is one entry in the list; besides the skills, only the phase-0 policy reads the list, to count its files as documents.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the skill's rule means a `CLAUDE.md` or `AGENTS.md` anywhere in the tree, or only at its root.
- (author) Whether a slice that changes the arcade needs the Next.js note before it builds; Claude Code reads a folder's own `CLAUDE.md` when it works in that folder, but the skills read only `paths.context`.
