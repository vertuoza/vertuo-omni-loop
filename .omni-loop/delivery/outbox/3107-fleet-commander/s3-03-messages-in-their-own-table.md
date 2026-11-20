---
id: s3-03-messages-in-their-own-table
prd: 3107
slice: s3
rank: high
bears-on: none
raised: 2026-11-20
wave: 3
---

## The question, in plain words

Where should a message to the fleet be kept, and how should its event point to it?

## The decision, in plain words

Messages to the fleet get their own table, and the event that points to one carries its id in a new column. Who read a message is kept in a second table, one row per mission and role.

## The intro, for fun

Questions to the oracle and notes for the crew now sit on separate shelves.

## The punchline, for fun

So the oracle never reads the crew's mail by mistake.

## The options, in plain words

A. A. As built: a separate table, a message_id column on events, receipts per mission and role.
B. B. Add a message kind to the Commander's thread table, and link the event by its id in the same new column.
C. C. Link the event with a web address to the fleet page and keep the message id in the sentence.

## What I had to decide

A fleet_messages table, a message_id column on mission events set only on messaged events, and a fleet_message_reads table; the role of a job is read from its mission key.
Decided by: Jev (hardToRevert 0.58) · agent said true

## What I did meanwhile

The Commander's thread is untouched, the message holds its words in one place, and a job of each role reads a message once.

## What it costs to change later

Medium: merging the two tables into one means a migration and rewriting the reader, the claim and the purge.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the event links to the message but does not say how a link to a stored row is written; a mission event's link column holds web addresses only
