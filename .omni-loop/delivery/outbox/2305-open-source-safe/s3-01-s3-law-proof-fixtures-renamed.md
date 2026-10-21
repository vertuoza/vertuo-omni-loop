---
id: s3-01-s3-law-proof-fixtures-renamed
prd: 2305
slice: s3
rank: high
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Six tests that prove locked rules of the GitHub App now use the fictional example names in their fixtures. Do you approve the renamed proofs?

## The decision, in plain words

Only the fixture names changed in those tests; no assertion, rule or expected result was edited, and the whole GitHub App test run stays green.

## The intro, for fun

Six tests got a costume change, and they swear the plot stayed the same.

## The punchline, for fun

Please check that the actors still say their lines.

## The options, in plain words

A. A. Keep the renamed fixtures, as the PRD's rule says.
B. B. Keep the old fixture names in these six tests and list them as an exception, which the PRD ruled out.

## What I had to decide

Approve the renamed fixtures in the six law-proof test files, or ask for them to be renamed another way.

## What I did meanwhile

The renamed tests run in the full preflight and stay green; nothing else waits on this answer.

## What it costs to change later

A different answer costs a re-rename of fixture strings in six test files, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the law's owner wants fixture names in a law proof left untouched (author)
