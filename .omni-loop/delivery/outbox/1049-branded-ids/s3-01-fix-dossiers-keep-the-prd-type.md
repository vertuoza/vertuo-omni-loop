---
id: s3-01-fix-dossiers-keep-the-prd-type
prd: 1049
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

A visual or bug fix has a page keyed by its issue's number, kept in the same place a PRD's number is. Should the arcade read that number as a PRD number or as an issue number?

## The decision, in plain words

The arcade reads every page's number as a PRD number, since a PRD number is also an issue number. Only where a fix is looked up on GitHub is it handed over as an issue number.

## The intro, for fun

A fix's page keeps its issue number in the drawer labelled PRD.

## The punchline, for fun

The label stays; the drawer now says what fits in it.

## The options, in plain words

A. Read every dossier's number as a PRD number; a fix's lookup takes it as an issue number (built).
B. Split the dossier row type by kind, a PRD's number for a PRD, an issue number for a fix.

## What I had to decide

The stored dossier row has one number column, `prd`. For a PRD it is the PRD's number; for a visual or bug fix (PRD 627) it is the fix's issue number. The brands ask which kind to read it as.

## What I did meanwhile

Dossier rows are read as `PrdNumber | null`. A push (the dossier API and `DossierPush`) and the lookup `numbered()` take `PrdNumber | IssueNumber`, with the reason beside the type. `FixRef.prd` is an `IssueNumber`; a dossier's `PrdNumber` fits there, since a PRD number is an issue number.

## What it costs to change later

A type change in apps/galaxy only: reading fix rows as `IssueNumber` instead would need a row type per kind (a discriminated union on `kind`), with no stored data or migration touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s5's kit-side `dossier push` (`PrdNumber | IssueNumber`) wants the arcade's row type split by kind as well (author).
