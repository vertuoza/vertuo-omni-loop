---
id: s3-01-consumes-is-direct-only
prd: 1162
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When one repository installs a second, and the second installs a third, should the plan check also refuse the first waiting on a change in the third?

## The decision, in plain words

The check only looks at the repositories a repository says it installs directly. A chain through a middle repository is not followed.

## The intro, for fun

Who installs whom, and does the grandparent count too?

## The punchline, for fun

For now the family tree stops at the parents.

## The options, in plain words

A. A. Direct only: a target is refused only for blockers in the targets its own consumes list names.
B. B. Follow the chain: a target also consumes what its consumed targets consume, and the check refuses those blockers too.

## What I had to decide

Whether the consumes rule follows chains of consumers or reads only the direct list.

## What I did meanwhile

Only direct consumes are refused; a person can list the third repository in the first one's consumes to get the refusal today.

## What it costs to change later

One small change in the plan check to walk the chain, and its tests; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a slice in a consumer blocked by a slice in a target it consumes; it does not say whether consumes is transitive (author)
