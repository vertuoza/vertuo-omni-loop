---
id: s1-02-db-module-wraps-cookie-builder
prd: 1318
slice: s1
rank: high
bears-on: ADR-0051
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The new database module should build the signed-in person's client, but the old builder lives in a file this slice may not change. Should the new module copy it or reuse it?

## The decision, in plain words

The new database module reuses the old cookie builder for the signed-in person and builds the service role's client itself, so nothing is copied and no file outside the slice changes.

## The intro, for fun

Two doors into the same database room, and only one of them is new.

## The punchline, for fun

The old door stays until everyone has learnt to use the new one.

## The options, in plain words

A. As built: the new module reuses the old builder for the signed-in person and builds the service role's client itself.
B. Move the old builder into the new module in a later slice, and leave the old file pointing at it.
C. Copy the old builder into the new module now, leaving two builders side by side.

## What I had to decide

Whether apps/galaxy/src/data/db.ts wraps supabaseServer() from supabase-server.ts for userDb(), rather than moving that builder into db.ts now.

## What I did meanwhile

Repositories written by later slices import db.ts only; supabase-server.ts keeps its current callers until each area moves.

## What it costs to change later

Moving the builder into db.ts later is a file move and an import change per caller, with no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) supabase-server.ts and its callers are outside this slice's territory, so the builder could not move without touching them.
