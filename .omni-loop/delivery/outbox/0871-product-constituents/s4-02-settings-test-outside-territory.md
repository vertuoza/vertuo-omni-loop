---
id: s4-02-settings-test-outside-territory
prd: 871
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

Adding the new decision to the Jev settings page made one existing page test expect three rows instead of four, and that test sits outside this slice's ground. Should the slice fix it, and who documents the judge's new shared secret?

## The decision, in plain words

The slice updated that one test so it expects the fourth row, and left the new shared secret out of the Galaxy example settings file, also outside its ground, for whoever sets it on the deployments.

## The intro, for fun

A fourth guest arrived and the seating chart still counted three.

## The punchline, for fun

One chair added, and a note left on the door about the new key.

## The options, in plain words

A. Update the one test now and leave the example settings file to whoever sets the secret.
B. Leave the test red for a later slice, staying inside the ground but merging the wave red.
C. Also add the secret to the Galaxy example settings file now, one more file outside the ground.

## What I had to decide

Whether a slice may update a test outside its territory that its own registry change breaks, and where the new secret is documented.

## What I did meanwhile

apps/galaxy/src/jev/settings/render.test.ts now lists constituent-break as the fourth row with its Sends line and Save form. CONSTITUENT_JUDGE_SECRET is not in apps/galaxy/.env.example; it must be set on Galaxy and on omni-app (s5) before the judge answers.
Decided by: Jev (hardToRevert 0.74) · agent said false

## What it costs to change later

Reverting the test change is one line; documenting the secret is two lines in the env example.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The env example and the deployment's secret are not covered by any slice's territory in the plan (author)
