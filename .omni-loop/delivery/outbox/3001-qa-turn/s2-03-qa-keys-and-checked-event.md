---
id: s2-03-qa-keys-and-checked-event
prd: 3001
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The QA rounds and the fixes between them need their own job names in the database, and QA's verdict needs a place to be written. Where should those live?

## The decision, in plain words

This step taught the database the new job names now, since it is the only step allowed to change the database. QA's verdict is written in the event's sentence, the way the Reviewer's verdict already is.

## The intro, for fun

The supervisor will soon send jobs with names the database has never heard of.

## The punchline, for fun

So the database learned the names before anyone said them.

## The options, in plain words

A. Widen the job key now, and keep QA's verdict in the event's sentence as the Reviewer's is.
B. Add round, verdict and issues columns to mission events, checked by the database, for QA's verdict alone.

## What I had to decide

Two choices in supabase/migrations/20270125160000_qa_turn.sql. First, runner_jobs_mission_key_shape now takes :qa:<1|2> and :qa-fix:1:<1-5> after a run's key: the plan gives the job keys to s4 (apps/omni-app/src/missions/), but only s2 adds a migration, and without it s4's inserts would be refused. Second, a `checked` event adds no column: its round, verdict and bugs' issues ride in its sentence and its link, as a `reviewed` event carries the Reviewer's, so the database does not refuse a `checked` event with no round; the spec's test seam asked that a checked event need a verdict and a round.

## What I did meanwhile

The keys are accepted by the database now; s4 builds them. A checked event's round and bugs are read from its sentence.

## What it costs to change later

Widening or narrowing one check constraint, or adding nullable columns later, in one follow-up migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s5's room can read the round and the bugs' issues from the sentence as reliably as from columns (author)
