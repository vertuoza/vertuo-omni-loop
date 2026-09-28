---
id: s3-01-retro-read-wired-into-the-reader
prd: 426
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The plan let this slice add a new retro file beside the part of the page that reads GitHub, but not change that part itself, though reading the retro needs one line there. What should this slice do?

## The decision, in plain words

The retro reading lives in its own new file, and the part that reads GitHub calls it with a single added line, with its tests beside the existing ones. Nothing else there changed.

## The intro, for fun

The plan gave this slice a new room but not the key to the hallway.

## The punchline, for fun

So it added one door handle and touched nothing else.

## The options, in plain words

A. Wire the retro read into the reader with one added read, tests beside the existing ones (built).
B. Leave the reader untouched and ship the Retro tab reading nothing, until a later slice wires it in.
C. Amend the plan so s3's territory names the reader and its test file, then keep the same code.

## What I had to decide

Whether s3 may wire its retro read into apps/galaxy/src/dossier/github/reader.ts (and add its cases to reader.test.ts), which the plan names only for s1 and s2, not s3.

## What I did meanwhile

readRetro and retroSource live in github/retro.ts (in territory). reader.ts gained one `raw` helper on its GitHub client and one `part('the retro', ...)` read returning `retroText`; reader.test.ts gained a `retroText: null` expectation and four retro cases. No other line of either file changed; s4 does not touch them.

## What it costs to change later

Reverting is removing one read and one helper in reader.ts and the matching tests; the Retro tab then always shows empty.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant 'github/retro' to cover the reader's wiring, or expected the reader itself to stay untouched (author)
