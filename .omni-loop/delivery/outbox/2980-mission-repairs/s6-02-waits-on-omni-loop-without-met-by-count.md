---
id: s6-02-waits-on-omni-loop-without-met-by-count
prd: 2980
slice: s6
rank: medium
bears-on: none
raised: 2026-11-17
wave: 4
---

## The question, in plain words

The page for a PRD that waits on an Omni Loop bug draws how many missions met it, but a workspace cannot read that count: may the page leave it out?

## The decision, in plain words

The Waits on Omni Loop line names the bug and links it, and leaves out the line saying how many missions met it, because that count lives in a table no signed-in person can read.

## The intro, for fun

The page wanted to say how many missions shared its bad luck.

## The punchline, for fun

The count lives behind a door that rightly stays locked.

## The options, in plain words

A. A. The line names and links the bug, with no count.
B. B. The App writes the count onto the event, and the page shows Met by n missions.

## What I had to decide

The before and after page draws Met by 2 missions under the bug link, but the count is a column of the Omni Loop bug table, which names no workspace and which nobody signed in may read. I linked the issue from the bug-reported event and left the count out, instead of reading the table with a service key.

## What I did meanwhile

Built as the spec asks for the link and the state word, without the count.

## What it costs to change later

Adding it later is a read of a count the App would copy onto the bug-reported event, then one line on each page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say where a workspace reads the count from.
