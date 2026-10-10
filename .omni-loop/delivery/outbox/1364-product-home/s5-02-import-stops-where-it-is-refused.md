---
id: s5-02-import-stops-where-it-is-refused
prd: 1364
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When the import is refused halfway, for example because one repository is not known to the workspace, should the links already written stay?

## The decision, in plain words

They stay. The import writes one link at a time and stops at the first refusal, naming it; running it again once the cause is fixed finishes the job and changes nothing it already did.

## The intro, for fun

Halfway through moving house, a box would not fit through the door.

## The punchline, for fun

The boxes already inside stay inside, and the move resumes once the door is wider.

## The options, in plain words

A. A. Write link by link and keep what was written before a refusal; a rerun finishes.
B. B. Write every link in one transaction through a new database function, all or nothing.

## What I had to decide

Whether POST /api/products/import writes all links in one database transaction (a new SQL function) or link by link through product_repository_link(), keeping what was written before a refusal.

## What I did meanwhile

productRepositoriesService.importTargets writes the new links first with nothing consumed, then every link that still differs, through product_repository_link(); the first refusal ends the call with the database's words (403 not an owner, 422 a field or a repository). The kit says 'the import into product <name> stopped' with that reason. A rerun is idempotent.

## What it costs to change later

An all-or-nothing import is one new SQL function and a migration in a later slice; nothing the person sees changes but the half-done state.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the import runs once and a second run changes nothing; it does not say what a refusal halfway leaves.
