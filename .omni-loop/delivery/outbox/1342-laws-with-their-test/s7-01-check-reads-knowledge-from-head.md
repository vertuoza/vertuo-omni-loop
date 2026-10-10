---
id: s7-01-check-reads-knowledge-from-head
prd: 1342
slice: s7
rank: high
bears-on: N-PRODUCT-4
raised: 2026-10-10
wave: 3
---

## The question, in plain words

To notice a rule losing its test, the pull request check must now read the rules folder from the pull request too, while a standing rule says it reads only the delivery folder from there. Is that acceptable?

## The decision, in plain words

Yes: the check still takes its settings from the main branch, so a pull request cannot change how it is judged, and it reads the pull request's rules only as the thing being judged.

## The intro, for fun

The referee has to read the new rulebook to notice a page was torn out of it.

## The punchline, for fun

He still blows the whistle by the old rulebook, though.

## The options, in plain words

A. A. Read the rules folder from both sides, settings from the main branch only (built).
B. B. Read the rules folder from the main branch only, and stop spotting a rule that loses its test on the server.
C. C. Keep A and reword the standing rule to say the rules folder is read from the pull request as data.

## What I had to decide

Whether the outbox check may snapshot the knowledge folder at the head as well as at the base, which grading law-proof and law-demoted needs, against N-PRODUCT-4's wording that only the delivery folder is read from the head.

## What I did meanwhile

With laws.source knowledge, the check snapshots paths.knowledge at the base and at the head beside the delivery folder. The config, its labels and its branch shapes still come from the base only. A head that removes or demotes a law fires law-text and law-demoted, so it cannot hide a law by editing the registers.

## What it costs to change later

A constant: drop the head knowledge snapshot in apps/omni-app/src/outbox-check/outbox-check.ts, or reword N-PRODUCT-4 to name the knowledge folder as data read from the head.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) N-PRODUCT-4 is unenforced and was adopted as medium; whether its author meant 'only the delivery folder' as a hard boundary or as 'never the config' is not written down.
- (author) Reading law-proof paths from the base registers instead would miss a law the pull request adds with its test; this slice did not explore that further.
