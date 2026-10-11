---
id: s1-03-two-changes-outside-the-database-files
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

This slice was meant to touch only the database. Two small changes outside it were needed for the work to build and be checked: may they stay?

## The decision, in plain words

Yes, kept. The web app's outbox sending now skips a PRD that has no repository, so the app still compiles once the repository became optional, and the database workflow runs the new check, as the repository's rules ask of every new check.

## The intro, for fun

The database learned a new trick and two neighbours had to move their chairs.

## The punchline, for fun

One chair now skips the new guest, the other watches it every time.

## The options, in plain words

A. A. Keep both changes in this slice (built).
B. B. Move the galaxy guard to s2 and leave the typecheck red until then.
C. C. Keep the dossier's repository required and give a product PRD a stand-in repository.

## What I had to decide

Confirm both changes outside the territory: the guard in apps/galaxy/src/outbox/send-live.ts and the new step in .github/workflows/supabase.yml.

## What I did meanwhile

dossiers.home_repo became nullable, so the generated types made apps/galaxy/src/outbox/send-live.ts fail the typecheck. sendTargetOf() now answers no target for a dossier with no home repository, and repositoryPrd() makes the recount skip it; a dossier of a repository reads as before. The supabase workflow gained the step that runs supabase/checks/product_prd_ids.sql (conventions: a new database check runs in CI).

## What it costs to change later

Each is a few lines to undo. Without the guard the galaxy typecheck is red; without the step the new check proves nothing in CI.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Other galaxy readers parse a dossier's repository as text and would refuse a product PRD row (the dossier list, the approval bell, the request route); none is typed against the database, so the typecheck does not show them. They belong to s2 and s3.
