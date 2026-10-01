---
id: s4-03-core-text-reads-stay-unschemaed
prd: 725
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The core modules read plain text from version control and folder names from disk, and the board takes pull request lists that another module fetched. Should each of those pass a validation schema here?

## The decision, in plain words

No new schema in this slice: the text is already a plain string handled by the existing parsers, and the pull request list should be checked where it is fetched, which belongs to the slice that types the command line.

## The intro, for fun

Plain text walked up to the schema desk and asked what form to fill in.

## The punchline, for fun

It was told strings fill in their own form, and to come back as JSON.

## The options, in plain words

A. A: plain text stays a typed string, and the pull request list is checked where it is fetched, in the command line slice
B. B: add a schema for the pull request list beside the board now, unused until the command line slice wires it
C. C: wrap every plain text read here in a schema as well

## What I had to decide

Whether the done-when rule 'every value read from a file, a process, the network or the environment passes a Zod schema' asks for a schema on git stdout (check-report.trackedFiles, git.rangeChanges, context.loadContext), on directory listings (layout, laws, fix-verdict), on CLAUDE.md's text (laws), and on the gh pr list payload boardFor receives.

## What I did meanwhile

No Zod import was added in this slice's files. Process output is typed `string` through an `ExecText` runner type, and parsed by the parsers already there (parseNameStatus, slugFromRemote, invariantAdrs). boardFor's payload is typed `BoardPr` with every field optional, as the board already tolerates; the gh JSON is read in kit/bin/commands/board.ts (s17's territory), where its schema belongs.

## What it costs to change later

A schema for the pull request payload in s17 (kit/bin/commands/board.ts) parsing into BoardPr; or a small `z.string()` wrap around each runner call here, one line each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether unstructured text output counts as a value that needs a schema (author)
