---
id: s2-01-tests-beyond-territory-followed
prd: 359
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Removing joining by email and Google sign-in broke two older checks and left one screen telling people to use Google, all in files another slice or no slice owns. Should this slice fix them, or leave them failing for their owner?

## The decision, in plain words

This slice changed them just enough to match: one arcade check now expects a person who has not signed in since to be outside, one knowledge check expects the GitHub button, and the knowledge page's notice now asks for a GitHub account.

## The intro, for fun

Pull one thread out of the sign-in sweater and three buttons elsewhere pop off.

## The punchline, for fun

This slice sewed them back on, and left a note for the tailor.

## The options, in plain words

A. A: edit the three files just enough to follow (built)
B. B: leave them for their owners, with the tests red on the feature branch until s3 merges
C. C: widen s2's territory in the plan to name them

## What I had to decide

Whether to edit files outside s2's territory that its change breaks or leaves wrong.

## What I did meanwhile

Edited outside the territory: apps/galaxy/src/arcade/onboarding.test.ts (s3's ground; BEA moved from the crew list to the outsider list, since the page no longer joins), apps/galaxy/src/knowledge/render.test.ts (expects 'Sign in with GitHub') and apps/galaxy/src/knowledge/KnowledgeScreen.tsx (the crew-only notice asks for the GitHub account of the workspace's org, not a Google one).

## What it costs to change later

A constant: three small edits, each revertible alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists KnowledgeSignIn in s2's territory but not the knowledge screen and test that name its button, nor s3's onboarding test that relied on joining by email
