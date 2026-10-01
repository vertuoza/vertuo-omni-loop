---
id: s10-02-malformed-github-answer-reads-unreachable
prd: 725
slice: s10
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

When GitHub answers about a target repository in a shape the tool does not expect, what should the targets report say?

## The decision, in plain words

The answer is now checked, and one missing the expected parts shows that repository as unreachable, naming the missing part. Well-formed answers read exactly as before.

## The intro, for fun

GitHub usually answers in full sentences, but the tool now checks the grammar.

## The punchline, for fun

A garbled reply gets a polite 'could not reach you' instead of a shrug three steps later.

## The options, in plain words

A. Show that repository as unreachable, naming the missing part, and carry on with the others
B. Stop the whole command with an error naming the missing part
C. Do not check GitHub's answers in this slice at all

## What I had to decide

The spec asks every value read from the network to pass a schema, failing with an error naming its field. kit/lib/plan-repo/targets.ts read gh api JSON (the repository, a contents listing, a compare) as it came. A schema refusal has to go somewhere: throw out of readTarget, or become a row.

## What I did meanwhile

Added kit/lib/plan-repo/gh-schema.ts: loose schemas naming only the fields the readers use (default_branch; type, name, path; ahead_by, files[].filename, previous_filename) plus the two YAML reads (paths.playbook, a form's state). A refused gh answer throws Unreachable naming the field, so omni targets and omni plan moved show that target as unreachable. A JSON syntax error still throws as before. A non-array contents answer still reads as no folder.

## What it costs to change later

Cheap: answerOf in targets.ts can throw the ZodError instead, one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a malformed GitHub answer should stop the command or stay one row among the others (author)
