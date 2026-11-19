---
id: s2-01-one-live-bug-team
prd: 3088
slice: s2
rank: high
bears-on: P-PRODUCT-52
raised: 2026-11-19
wave: 1
---

## The question, in plain words

The spec says at most one bug team mission runs at a time, but not whether that limit counts every workspace together or each one apart, nor whether a paused team counts as running.

## The decision, in plain words

The database allows one bug team mission that is running, waiting or paused, across every workspace together. A draft or a stopped one does not count, so stopping the old team lets a new one start.

## The intro, for fun

Two bug teams on the same bug would race to fix it twice.

## The punchline, for fun

So the database keeps one team on duty, and a paused one still holds its seat.

## The options, in plain words

A. A. One live bug team across every workspace, a paused one counted (built).
B. B. One live bug team per workspace: two workspaces could each run a team and take the same bugs.
C. C. Count running and waiting teams only: a paused team gives up its seat, and resuming it after another started is refused.

## What I had to decide

Keep one live team across every workspace (A), or count each workspace apart (B), or count running and waiting only, letting a paused team be replaced (C). Each is one partial index in a follow-up migration.

## What I did meanwhile

A second bug team mission is refused when it starts while another, in any workspace, is running, waiting or paused.

## What it costs to change later

Switching later is one migration that swaps one partial index; no row changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The refusal tells a workspace that a team runs somewhere else, which P-PRODUCT-52 asks to keep deliberate; only the Omni Loop repository may run a team (the kit refuses others), so in practice one workspace meets it.
- (author) The App's Start must turn the refusal into a sentence naming why; that is the App's code, not this slice's.
