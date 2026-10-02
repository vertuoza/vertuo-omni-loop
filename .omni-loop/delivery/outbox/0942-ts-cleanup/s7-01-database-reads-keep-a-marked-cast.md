---
id: s7-01-database-reads-keep-a-marked-cast
prd: 942
slice: s7
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

The dashboard and the profile read rows from the database without checking their shape. Should those reads check each row as it arrives, or keep trusting the database and say so plainly?

## The decision, in plain words

The reads keep trusting the database, as they did before, and each place that trusts it now says why in a short note. Nothing the pages show changes.

## The intro, for fun

Seven database reads walked in without showing a ticket.

## The punchline, for fun

They now wear a badge saying who let them in.

## The options, in plain words

A. Keep one marked cast per read, naming the untyped client (built)
B. Check each read's rows against a schema as they arrive, as the people page already does for the roster
C. Type the client with the generated database types and narrow what they leave loose

## What I had to decide

Whether the dashboard's and the profile's database reads keep a marked cast, or parse each row with a schema at the boundary as the architecture form's pattern asks.

## What I did meanwhile

Each of the seven reads keeps one cast, the double cast through unknown narrowed to a single one, with a reason naming the untyped client. A schema parse would turn a malformed row into an unreadable part, a behaviour change the PRD keeps out of scope; the people page's loader already shows the schema route for the roster if it is wanted.

## What it costs to change later

Low: swapping a cast for a schema parse is a local edit per read, with no stored shape or contract touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the stored answered count can arrive as text, which the loader's Number() suggests and a schema would have to allow (author)
- Whether the PRD wanted schema parses wherever a value comes from outside, or only where a cast could not be given a true reason (author)
