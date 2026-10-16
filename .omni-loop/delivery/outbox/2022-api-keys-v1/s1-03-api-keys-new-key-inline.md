---
id: s1-03-api-keys-new-key-inline
prd: 2022
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The design of the API keys page left open how New key asks for the name and the repositories, and the page needed an answer to be built. Is a form that opens in the page, above the table, the right way?

## The decision, in plain words

New key opens a small form in the page, above the table, with the name and either all repositories or a pick among the tracked ones; Revoke asks a second time before it acts.

## The intro, for fun

Every new key needs a name before it gets a job.

## The punchline, for fun

We asked in the page, no pop-up drama.

## The options, in plain words

A. An inline form above the table, and Revoke asked twice (built).
B. A dialog for New key, and Revoke asked twice.
C. An inline form, and Revoke acting on its first click.

## What I had to decide

How New key asks for the name and the repositories on Settings › API keys: an inline form or a dialog (the api-keys draft screen's first open question), and whether Revoke asks twice.

## What I did meanwhile

An inline form above the table, All repositories picked first; Revoke shows Revoke for good and Keep on its first click. A revoked key leaves the table at once, as the plan's done-when says.

## What it costs to change later

A change of one component, ApiKeysView.tsx, and its render test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the screen owner prefers a dialog, as the draft screen leaves it open (author)
