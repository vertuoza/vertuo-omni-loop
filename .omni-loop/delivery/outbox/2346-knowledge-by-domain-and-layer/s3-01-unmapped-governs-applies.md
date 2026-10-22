---
id: s3-01-unmapped-governs-applies
prd: 2346
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a repository has drawn no map of its areas and layers, should a rule that names the changed files still show in the top group, the one that says what applies here, or should everything sit in the global group?

## The decision, in plain words

A rule that names the changed files shows in the top group, saying it names them; every other law shows in the global group. The list holds exactly what it held before the map existed, only grouped.

## The intro, for fun

No map drawn, yet one rule still points straight at the file you are editing.

## The punchline, for fun

We let it raise its hand instead of hiding it in the crowd.

## The options, in plain words

A. Show a rule that names the changed files under Applies here, marked governs, and every other law under Global (built).
B. Show every entry under Global when nothing is mapped, a rule that names the files marked governs there.

## What I had to decide

Where a rule that names the changed files is shown when the repository has no map: in Applies here, marked governs, or under Global with every other entry.

Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

In a repository with no map, a rule whose Governs: line matches a changed file prints under Applies here, marked governs; every other locked law prints under Global, and no law is hidden. The entries listed are the ones the lookup listed before PRD 2346.

## What it costs to change later

One condition in the lookup and the expectations of the unmapped tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says both that a Governs: match applies and that, with no map, every entry is global; it does not say which wins for a Governs: match in an unmapped repository.
