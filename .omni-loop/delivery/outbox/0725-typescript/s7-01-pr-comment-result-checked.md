---
id: s7-01-pr-comment-result-checked
prd: 725
slice: s7
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The note sent to the team chat reads a small file left by the step before it. Should a file whose values have the wrong kind be ignored, or passed along as it is?

## The decision, in plain words

A file whose values have the wrong kind is now ignored, so the note links to the issue instead, exactly as when the file is missing.

## The intro, for fun

A tiny file walks into the chat step carrying a number that is secretly a word.

## The punchline, for fun

It now gets politely turned away at the door, like a missing file would be.

## The options, in plain words

A. Check the file's values and ignore a file whose values have the wrong kind, like a missing one
B. Pass the file along as it is, whatever its values hold, as before
C. Refuse the run with an error naming the wrong value

## What I had to decide

readPrCommentResult (kit/lib/outbox/comment.ts) read the --result JSON file and returned it whenever it was any object, arrays included, trusting htmlUrl and newAdoptedCount as written. The plan's done-when asks every value read from a file to pass a Zod schema first.

## What I did meanwhile

Added PrCommentResultSchema in comment.ts (htmlUrl a string or null or absent, newAdoptedCount a number or absent, any other key kept as written); a file that fails it reads as null, the same answer an unreadable or missing file already gave. The only writer of that file, omni comment --pr, always writes the right kinds, so its own runs read exactly as before.

## What it costs to change later

A constant: drop the schema and return the parsed object again, one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether anyone hands-writes that result file with other kinds of values (author)
- Whether a wrong-kind file should fail loudly instead of falling back quietly (author)
