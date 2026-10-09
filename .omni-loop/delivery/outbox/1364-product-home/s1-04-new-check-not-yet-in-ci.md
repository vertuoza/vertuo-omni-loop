---
id: s1-04-new-check-not-yet-in-ci
prd: 1364
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The new check that proves product links is not yet run by the automated checks on pull requests. Who adds it?

## The decision, in plain words

This slice did not touch the workflow file that lists the checks, because it is outside its territory; the check is written and passes locally, and one step in that workflow makes it run on every pull request.

## The intro, for fun

The smoke alarm is unboxed, tested and sitting on the shelf.

## The punchline, for fun

It works best once somebody screws it to the ceiling.

## The options, in plain words

A. Leave the workflow to the wave or a follow-up change, the option built.
B. Widen this slice's territory to the workflow file and add the step here.

## What I had to decide

Where the workflow step that runs the new product-links check gets added.

## What I did meanwhile

Not added: the wave, or a follow-up change, adds one named step to the database workflow for the new check.

## What it costs to change later

One step in one workflow file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- which slice or step of the wave owns workflow changes for new database checks (author)
