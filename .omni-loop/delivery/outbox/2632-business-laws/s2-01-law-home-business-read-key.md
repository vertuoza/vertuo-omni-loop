---
id: s2-01-law-home-business-read-key
prd: 2632
slice: s2
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

The page's read of a product's business only accepts the keys it already knows, so the new law home answer would have made every read fail. Is it fine that slice s2 let that read accept one more key, though the file sits outside its listed territory?

## The decision, in plain words

The read now accepts an optional law home, and a server that sends none reads exactly as before. Nothing else in that file changed.

## The intro, for fun

A strict doorman kept turning away a guest nobody had put on the list.

## The punchline, for fun

We added one name to the list, and only that name.

## The options, in plain words

A. A. Accept the key in the business read, as built: one optional line, covered by a test.
B. B. Leave the read untouched and serve the law home from another endpoint, which needs a new route and a second call from every terminal.

## What I had to decide

One optional line in apps/galaxy/src/business-api/read.ts: lawHome: z.string().nullable().optional(). The read schema is strict, so without it the law home returned by business_for_repo() makes every business read fail with an unexpected answer. Reverting the line while keeping the migration would break the read, so the migration and the line go together.

## What I did meanwhile

Nothing waits: the line is in the slice's pull request, and the law home reads as none until a server sends one.

## What it costs to change later

Reverting means removing one optional line and the law home key from the database function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a separate endpoint would be preferred over widening the strict read (author).
