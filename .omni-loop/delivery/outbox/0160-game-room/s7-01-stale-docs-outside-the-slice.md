---
id: s7-01-stale-docs-outside-the-slice
prd: 160
slice: s7
rank: medium
bears-on: none
raised: 2026-09-26
wave: 6
---

## The question, in plain words

Two pages outside this piece of work still describe the game as it was before XP: the repository's front page lists the backup without the high scores and leaves out the new XP command, and the team's architecture notes say the game writes only the ledger, a weekly comment and a backup. Should this piece of work have corrected them?

## The decision, in plain words

I left both pages as they are, since this piece of work may only change the two guides it was given, and I name the stale lines here so a person can fix them in one small follow-up.

## The intro, for fun

Two guides got a fresh coat of paint, while the neighbours' signs still point down the old road.

## The punchline, for fun

We left them a map with the new road circled in red.

## The options, in plain words

A. Leave both pages as they are, and fix them in a small follow-up change.
B. Fix both pages in this piece of work, although they are outside what it may change.
C. Fix only the front page here, and leave the architecture notes, which a person wrote, to a person.

## What I had to decide

The slice's territory is `game/README.md` and `apps/galaxy/README.md`. PRD 160 also made two lines outside it untrue or incomplete. `README.md` › Run it by hand lists `game:banner`, `game:project`, `game:score` and `game:export` but not `pnpm game:xp`, and describes `game:export` as "its row, ledger, sectors, fleets and players as JSONL", while it now also writes `arcade_scores.jsonl`. `.omni-loop/knowledge/playbook/architecture.md` › Boundaries, a section marked by-human, says the game's "only outputs are the ledger in Supabase, one weekly comment and a backup (game/README.md)", while `pnpm game:xp` now also writes `player_xp` at every poll.

## What I did meanwhile

Changed nothing outside the territory. `game/README.md` now names the game's outputs with `player_xp`, lists `pnpm game:xp`, and lists `arcade_scores` in the backup, so both stale lines have a correct source to follow.

## What it costs to change later

None: two one-line doc edits, in any later pull request. The playbook line is in a by-human section, so a person edits it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The PRD's scope names `game/README.md` and `apps/galaxy/README.md` as the docs it changes and says nothing of the root README or the playbook, so whether they belong to this feature or to a follow-up is not settled.
