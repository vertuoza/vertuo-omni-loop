---
id: s2-01-dashboard-skips-concepts
prd: 1272
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Now that concepts are stored with the other work, should the dashboard count them with the PRDs and fixes?

## The decision, in plain words

The dashboard reads a concept without failing and leaves it out: it keeps counting PRDs and fixes only, and concepts have their own list.

## The intro, for fun

A new kind of guest arrived, and the head count at the door did not know how to count them.

## The punchline, for fun

So the door now waves them through to their own room instead of slamming shut.

## The options, in plain words

A. A. The dashboard reads concepts and leaves them out, counting PRDs and fixes only.
B. B. The dashboard keeps concepts in its rows, and its panels learn to show them.
C. C. The database's history list leaves concepts out, and the Concepts list reads them its own way.

## What I had to decide

Whether the dashboard's read of all the workspace's dossiers keeps concept rows, or reads them and leaves them out. It sits in apps/galaxy/src/data/dossiers.ts, outside this slice's territory: without the change, the dashboard would throw as soon as one concept is pushed (the carry-over from s1-01-page-kinds-stay-narrow).

## What I did meanwhile

apps/galaxy/src/data/dossiers.ts: workspaceDossiers() now parses each row of dossier_list() with a wider schema (kind may be concept, latest may hold a concept's four version kinds), then drops concept rows and parses the rest with the unchanged DossierListEntry. DossierListEntry and DossierListRow are unchanged. A test in dossiers.test.ts pushes a concept row through the fake and checks the dashboard lists the other dossiers alone. In the same slice, WORK_PATHS and WORK_NAMES (src/dossier/page/work.ts) name the concept, and ofWork keeps a concept out of every other kind's rows.

## What it costs to change later

One filter to remove in workspaceDossiers() if the dashboard should count concepts later, plus whatever the board then shows for them. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec puts the board counting concepts out of scope, which I read as: the dashboard leaves them out (author)
