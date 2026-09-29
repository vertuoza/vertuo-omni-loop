---
id: s2-01-copy-names-no-local-path
prd: 522
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The spec says the source list of a copied knowledge base is never looked for in the plan repository. Should the other file references in a copy, such as where a rule is enforced or which page a section points to, also be left unchecked?

## The decision, in plain words

Every file a copy names is treated as a file of the other repository, so none is looked for in the plan repository; only the copy's shape and wording are checked.

## The intro, for fun

A copy of someone else's notes keeps pointing at their desk drawers.

## The punchline, for fun

So we stopped opening our own drawers to look for them.

## The options, in plain words

A. Skip every file lookup inside a copy (built).
B. Skip only the source list, as the spec words it; the rule references of a copy would then fail the check.
C. Check each reference against the other repository through GitHub, at the commit the copy was read at.

## What I had to decide

Whether the rule and page references of a copy are checked against the plan repository, skipped, or checked against the other repository.

## What I did meanwhile

Only the structure of a copy is graded; a wrong file name inside a copy goes unnoticed until the sync run redraws it.

## What it costs to change later

Changing it is one condition in each grader; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a copy may ever point at a page of the plan repository itself is not settled (author).
