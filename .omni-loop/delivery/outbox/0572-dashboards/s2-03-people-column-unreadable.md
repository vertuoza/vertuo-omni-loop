---
id: s2-03-people-column-unreadable
prd: 572
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When one of the numbers behind the People table cannot be loaded, should the whole table disappear, or only that column?

## The decision, in plain words

Only that column: its cells show a question mark and one line under the table names what could not load; the list of members still shows.

## The intro, for fun

One missing number should not make a whole team vanish.

## The punchline, for fun

So the team stays, and the gap wears a question mark.

## The options, in plain words

A. Keep the members, mark only the failed column.
B. Hide the whole table whenever any of its numbers fails.

## What I had to decide

How the People table shows a failed read of points, contributions or answered counts, when the members themselves could be read.

## What I did meanwhile

The table renders every member; a failed column's cells read '?' (said 'could not load'), and a line lists the failed columns. The table alone says it could not load when the roster fails.

## What it costs to change later

The People view in src/dashboard/board/Board.tsx and peopleRows in tally.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a question mark reads clearly to someone scanning the table (author)
