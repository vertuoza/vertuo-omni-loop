---
id: s6-03-guard-reach
prd: 1665
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The new guard checks that the loop's deciding commands never read GitHub through the command-line tool: how far should it look, and does a write that uses the same tool count?

## The decision, in plain words

It looks at the seven commands and every file they use, followed step by step, and counts the seven read forms the spec names; a write through the same tool is let through when its file holds only writes.

## The intro, for fun

A smoke alarm that rings for toast is soon taken off the ceiling.

## The punchline, for fun

This one rings for reading only, and leaves the writing alone.

## The options, in plain words

A. A. The seven forms in the seven commands and every file they import; writes with mutations only pass (built).
B. B. The same, and every REST read through the tool too.
C. C. Only the seven command files themselves, not what they import.

## What I had to decide

kit/test/no-gh-reads.test.ts parses each file's syntax tree (comments never count) and fails on an argument list holding pr list, pr view, pr diff, pr checks, issue view or issue list, the same as one string, and on api graphql when the file holds a GraphQL query (a document that does not start with `mutation`). care.ts's reply and resolve mutations pass (s4-02). Its reach is the seven command files plus every kit file they import, followed transitively, tests left out. Not counted: `gh api` REST calls (comment listing before a write, care's `gh repo view` for a target's default branch), which the spec's list does not name.

## What I did meanwhile

Proven red first on fixtures for each form and on the branch before flow moved (three hits in kit/bin/github.ts), green after.

## What it costs to change later

A line in the guard's list of forms, or its list of files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a REST read through `gh api` on the loop's path should also fail the guard (care's default-branch read would then need the page).
