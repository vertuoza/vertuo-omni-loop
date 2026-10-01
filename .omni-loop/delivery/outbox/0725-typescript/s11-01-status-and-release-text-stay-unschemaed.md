---
id: s11-01-status-and-release-text-stay-unschemaed
prd: 725
slice: s11
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The status overview reads plain text from version control, and the release note check reads a short header written by hand. Should each of those pass a validation schema here?

## The decision, in plain words

No new schema in this part: the text stays plain text handled by the readers already there, as the core modules already decided, and the release note keeps its own reader so its messages stay word for word the same.

## The intro, for fun

The release note header asked to be checked by the new schema desk like everyone else.

## The punchline, for fun

It was told it already had a personal reader who knows every one of its lines by heart.

## The options, in plain words

A. Plain text stays typed text and the release note keeps its own reader, as built
B. Add a schema for the release note header now, with its messages mapped to today's words
C. Wrap every text read in this part in a schema as well

## What I had to decide

Whether the done-when rule that every value read from a file, a process, the network or the environment passes a Zod schema asks for a schema on the git output kit/lib/status/facts.ts reads (rev-parse, ls-tree, log, for-each-ref, diff), on the plan text kit/lib/delivery/prd.ts hands to parsePlanSlices, on the files kit/lib/delivery/ship.ts rewrites, and on a release note's front matter, which kit/lib/releases/note.ts reads line by line.

## What I did meanwhile

No Zod import was added in this slice's files, following the adopted s4-03 decision for the core modules. Process output is typed string through ExecText and parsed by the readers already there. The release note keeps its hand-written line reader: it reads values as written rather than as YAML, and its refusals (a field it never carries named, a field given twice, prd not a number) are the exact messages omni check releases and omni ship print, which a Zod schema would reword.

## What it costs to change later

A ReleaseNoteFrontMatterSchema beside note.ts parsing the fields readFields returns, with its messages mapped to today's wording; and a z.string() wrap around each git call in facts.ts, one line each. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether unstructured text output, or a front matter the kit deliberately reads without YAML, counts as a value that needs a schema
