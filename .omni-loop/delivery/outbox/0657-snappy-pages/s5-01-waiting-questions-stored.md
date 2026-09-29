---
id: s5-01-waiting-questions-stored
prd: 657
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

The waiting list shows each question that waits on you, not just how many there are. Where should the question words come from once the list stops asking GitHub?

## The decision, in plain words

The new table keeps, beside each PRD's count, the few questions that wait on a person, so the waiting list can show them without asking GitHub.

## The intro, for fun

The plan packed a counter for the trip, but the waiting list wanted to read the postcards too.

## The punchline, for fun

So the postcards ride along in the same suitcase, and GitHub stays home.

## The options, in plain words

A. Keep the waiting questions beside each count in the new table, filled by the same recount (built).
B. Store only the count, and let the waiting list keep asking GitHub for the questions of the PRDs whose count is above zero.
C. Store only the count, and show the waiting list as a number per PRD, without the question words.

## What I had to decide

Whether prd_outbox keeps the waiting questions (rank, id and words of each human-action or high item while the feature PR is open) in a list column beside open_questions, as built, or whether the waiting outbox keeps reading GitHub for its question words.

## What I did meanwhile

The migration adds a waiting jsonb column (a list, checked by the database) to prd_outbox. The recount fills it from the same GitHub summary it counts, and GET /api/waiting/outbox builds its items from it with no GitHub call. The plan only named open_questions and synced_at.

## What it costs to change later

The table is new in this PRD, so before it ships dropping or changing the column is an edit of its migration; after it ships, one follow-up migration drops the column, and the waiting route goes back to the GitHub reader.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the waiting outbox reads prd_outbox but only names a count; it does not say where the question words come from.
