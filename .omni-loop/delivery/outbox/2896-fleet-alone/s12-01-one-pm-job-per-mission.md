---
id: s12-01-one-pm-job-per-mission
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

How many times may a mission send its PM to write PRDs, and when does it pick a brainstorm over a roadmap?

## The decision, in plain words

A mission sends its PM once. It asks for a brainstorm when one PRD is left under the cap, and a roadmap when several are, so the PM never writes more than the cap allows.

## The intro, for fun

The PM gets one blank page per mission.

## The punchline, for fun

No second draft unless a person asks for one.

## The options, in plain words

A. A. One PM job per mission; brainstorm for one PRD left, roadmap for several (built).
B. B. Send the PM again after each job while the fleet added fewer than the cap.
C. C. Always send a roadmap and let it write one PRD or several.

## What I had to decide

Whether a mission may send its PM again when the first job wrote fewer PRDs than the cap, and whether the PM should choose brainstorm or roadmap itself.

## What I did meanwhile

The PM job's key is mission:<id>:pm:1, unique, so a replay never sends a second one. A job that failed or wrote nothing adds nothing, and the mission carries on with the PRDs it has.

## What it costs to change later

A constant in apps/omni-app/src/missions/pm.ts (PM_ROUND and the check on jobs already sent): a later round only needs a new round in the key, which the database already accepts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person expects the fleet to keep proposing PRDs until the cap is reached.
