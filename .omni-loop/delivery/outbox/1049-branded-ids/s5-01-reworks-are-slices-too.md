---
id: s5-01-reworks-are-slices-too
prd: 1049
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 4
---

## The question, in plain words

The plan names its pieces of work s1, s2 and so on, but a rework of a decision and the settling of answers are pieces of work too, with names like fix-s1-01-something or settle. Should the strict s1 shape also cover those?

## The decision, in plain words

We added a second, wider kind for any piece of work: a plan's own s1 always fits it, and so do the names reworks and settling use. Plan tables, decision files and their accounts take that wider kind; the strict s1 kind stays as it was.

## The intro, for fun

The plan said every slice is s-and-a-number, then a rework walked in wearing a longer name.

## The punchline, for fun

We gave the longer names a seat of their own, one row behind the s1s.

## The options, in plain words

A. A wider WorkSliceId for any piece of work, which the strict SliceId fits, and an item id that may carry a rework's name (built).
B. Keep the strict SliceId everywhere and give reworks and settling a reader and a brand of their own.
C. Widen SliceId itself to admit rework and settle names, with no second kind.

## What I had to decide

Whether the slice and item ids the kit reads (plan tables, outbox front matter, accounts, the settled ledger, item new --slice) take the strict SliceId (s1) or a wider kind that also admits a rework (fix-s1-01-…, from branches.rework) and settle.

## What I did meanwhile

kit/lib/ids.ts gained WorkSliceId (lower-case words joined by hyphens) with parseWorkSliceId; SliceId carries both brands so it fits where a WorkSliceId is expected. OutboxItemId admits a rework's name before s<n>-<nn>-<slug> (fix-s1-01-zod-01-crew), as shipped/0100-workspaces' ledger already holds. parsePlanSlices, the item and account front matter and the board give WorkSliceIds, because renderReworkPlan's table is read back through parsePlanSlices and settle accounts are named settle.md. A malformed id (S1, a blank) is still refused where it is read.

## What it costs to change later

Narrowing back to SliceId is a type change in kit/lib/types.ts, kit/lib/inbox/territory.ts and kit/lib/schema/front-matter.ts, plus a separate reader for rework plans; no data changes, since every id on disk already matches both shapes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says parsePlanSlices gives SliceIds and outbox front matter gives an OutboxItemId shaped s<n>-<nn>-<slug>, but the kit already writes rework slices (fix-<item id>), rework items (fix-s1-01-…-01-…) and settle accounts, and a test reads a rework plan back through parsePlanSlices; the spec does not say how those fit.
