---
id: s2-01-stuck-and-retro-shapes
prd: 3065
slice: s2
rank: high
bears-on: none
raised: 2026-11-18
wave: 1
---

## The question, in plain words

How should the database remember that a mission was paused because it was stuck, and what a retro that could not be written looks like?

## The decision, in plain words

A mission now carries a small mark saying it was paused because it was stuck, and the database wipes that mark itself as soon as the mission is resumed or stopped. A retro that was skipped is kept as a card saying why, and every proposed rule change points back to the one retro or repair that raised it.

## The intro, for fun

A mission that spins all night needs a sticky note on the fridge.

## The punchline, for fun

The note peels itself off the moment someone presses Resume.

## The options, in plain words

A. Keep a paused-by mark on the mission, cleared by the database when the pause ends, and the shapes above.
B. Keep no mark: tell a pause by stuck apart from the mission's latest events instead.
C. Keep the pause by stuck as its own table of questions and answers, as the token budget does.

## What I had to decide

The spec asks the database to keep the pause by stuck but does not say how. I added missions.paused_by (only 'stuck', only while status is paused), and a trigger clears it whenever the mission leaves paused, so the existing Resume and Stop paths need no change. Other shapes the spec left open: a mission_retros row holds either a retro or a skipped reason (never both), one per milestone; a mission_items row is raised by exactly one milestone retro or one repair of the same mission, numbered 1 to 20 within it; a stuck repair's failed_job_id is the fifth job, whose end made the mission stuck; job keys mission:<id>:stuck:<k> and mission:<id>:retro:<roadmap n | mission> keep a replay from sending twice; a stuck repair is claimed first in line, as a PRD's repair is.

Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

Built and proven by supabase/checks/mission_retros.sql against a local database, with every other database check still green.

## What it costs to change later

Low: the tables and the column are new and empty until the supervisor (s4) writes them; a follow-up migration can reshape them before any row exists, or with a small backfill after.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the pause by a token budget should share the same mark, which today lives in its own budget-stop table, was left as it is.
