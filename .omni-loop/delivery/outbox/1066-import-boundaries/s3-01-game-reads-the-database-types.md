---
id: s3-01-game-reads-the-database-types
prd: 1066
slice: s3
rank: medium
bears-on: none
raised: 2026-10-04
wave: 2
---

## The question, in plain words

The game writes its scores with the help of the database's own description of its tables, yet the agreed layering rules let it borrow only two small pieces of the delivery tool. Should the game also be allowed to borrow that description?

## The decision, in plain words

Yes: the game may read the database's description of its tables, the way both apps already do. Nothing else about the game's limits changes.

## The intro, for fun

The game was told to pack light, then turned up carrying the map of its own house.

## The punchline, for fun

So the map stays in the bag: it is the one thing the game cannot do without.

## The options, in plain words

A. The game may import the generated database types, as both apps may (what was built).
B. Keep the table as written: the game's adapter declares the few row shapes it writes by hand and drops the generated types.
C. Move the game's Supabase adapter out of the game into a zone that may read the types, and hand it to the game as a port.

## What I had to decide

Whether the game zone may import the generated supabase types (supabase/database.types.ts). The spec's rule table lets the game import only kit/lib/ids and kit/lib/env, while game/sources/supabase.ts, the game's REST adapter for its ledger, types its rows from the generated types (a type-only import). The guard found it on the whole tree.

## What I did meanwhile

The guard's table gives the game a third allowance, the supabase types, beside kit/lib/ids and kit/lib/env, with a comment naming this item; the ADR and the architecture form's table show it. The apps already had the same allowance in the spec's table.

## What it costs to change later

One line in the guard's table, its fixtures' messages, a row of the ADR and of the architecture form. Option B would also retype the game's adapter by hand.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's table and its decisions never mention the game's Supabase adapter, so whether leaving the supabase types out of the game's row was meant is unknown.
