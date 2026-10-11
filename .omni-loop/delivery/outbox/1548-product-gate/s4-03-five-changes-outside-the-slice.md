---
id: s4-03-five-changes-outside-the-slice
prd: 1548
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

Building this needed small changes in files outside the slice's ground: may they stay?

## The decision, in plain words

Yes, kept. The GitHub app's new address needed its build list, its hosting settings and its test of served functions to name it, and the web app's push and PRD page needed one line each to send the void and show the approval card.

## The intro, for fun

The new message needed a door, a doorbell and a nameplate in the hallway.

## The punchline, for fun

We touched the hallway as little as we could and wrote down every fingerprint.

## The options, in plain words

A. Keep all five in this slice (built).
B. Move the galaxy wiring to a later slice, leaving the void unsent and the card unshown until then.

## What I had to decide

Confirm the five changes outside the territory: apps/omni-app/build.ts (server-event in FUNCTIONS), apps/omni-app/vercel.json (its maxDuration, which narrate.test.ts requires of every function), apps/omni-app/src/outbox-check/inngest-route.test.ts (the eighth function and twelve registered), apps/galaxy/src/dossier/api-live.ts (tellVoids wrapped by withAppTold) and apps/galaxy/src/dossier/page/DossierRoute.tsx (the attestation read on the product PRD path).

## What I did meanwhile

Each is a line or two. The new Vercel function's bundle, apps/omni-app/api/server-event.mjs, is generated and left to the wave's rebuild. The plan names apps/galaxy/layering/baseline.json, which does not exist: the baseline is layering/baseline.json at the root, and it needed no change since every new galaxy file follows its role.

## What it costs to change later

Each is a few lines to undo. Without the first three the new route is not served or its tests are red; without the last two the void is not sent and the page shows no attestation.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory has no entry for the App's build list, its Vercel settings or the dossier push and page wiring, which the done-when lines need.
