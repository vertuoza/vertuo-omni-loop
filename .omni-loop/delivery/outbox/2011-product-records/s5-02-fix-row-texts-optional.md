---
id: s5-02-fix-row-texts-optional
prd: 2011
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

When a bug record is first sent, its fixes may not have a pull request, a reproduction or a guard yet. Must every row carry all three from the start?

## The decision, in plain words

Only the repository and what the fix changes are required. The pull request, the reproduction and the guard can be filled in by a later send, once they exist; a fix that has merged can no longer be moved, dropped or pointed at another pull request.

## The intro, for fun

Bugs rarely arrive with their paperwork done.

## The punchline, for fun

The record waits for the details, but never forgets a merge.

## The options, in plain words

A. Only the repository and the change are required at first; the rest is filled in later, and a merged row is frozen (as built)
B. Every row must carry its pull request, reproduction and guard from the first send
C. Nothing is frozen: a later send may rewrite or drop even a merged row

## What I had to decide

Which of a Fixes row's fields fix_bug_push() requires at the first push, and what a later push may change once a row merged.

## What I did meanwhile

fix_rows requires repository (one of the product's) and changes; pull, reproduction and guard may be null until a later push fills them. A later push rewrites the rows by position: a row whose repository or pull request changes starts open again, and a merged row's place, repository and pull request are refused to change (its words may still change). One pull request sits on one row of a bug at most.

## What it costs to change later

A constant: requiring the reproduction and the guard later is one check in fix_bug_push() and a constraint, in a follow-up migration, before rows exist without them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists a row's fields but not when each must be known; /omni:mega-bug-fix proves the reproduction red before it fixes, so the record may be pushed before either exists (author)
