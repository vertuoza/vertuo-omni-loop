---
id: s5-01-check-grades-changed-files
prd: 28
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Should the live check also hold a pull request for risky changes nobody explained, or only for open questions and unfinished rework?

## The decision, in plain words

It also holds it for unexplained risky changes: the app hands the pull request's list of changed files to the gate, as the spec's description of the check asks, so the check matches the kit's fullest gate.

## The options, in plain words

A. Pass the changed files, so unexplained risky changes also turn the check red, as built.
B. Never pass them: the check looks only at open questions and unfinished rework.
C. Pass them and widen the copy to the knowledge folder, so every rule can fire.

## What I had to decide

Whether the running check passes the pull request's changed files to the gate.

## What I did meanwhile

The evaluate step reads the compare endpoint (base...head, paginated, at most 3,000 files) and maps GitHub's file statuses to the one-letter shape the kit reads; evaluate hands them to gateResult. On a repository without config, nothing is compared.

## What it costs to change later

One argument in the evaluate step: pass null instead of the list. No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec's conclusion table (open items and drift only) or its unit description (changed files from the compare endpoint) is the intent; the two disagree.
- (author) With laws.source set to knowledge, the law-proof rule reads the knowledge folder, which the snapshot does not hold, so that one rule never fires from the app.
