---
id: s2-01-two-changes-outside-the-slice
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

This slice was meant to change only the dossier and PRD commands and their routes. Two small changes outside it were needed: may they stay?

## The decision, in plain words

Yes, kept. The terminal's connection to the Omni page learned the four new calls a product PRD needs, and the help's own test now lists the new commands, so the help and its test agree.

## The intro, for fun

The new commands needed a phone line, and the phone book needed a new page.

## The punchline, for fun

We added both and wrote down who we called.

## The options, in plain words

A. A. Keep both changes in this slice (built).
B. B. Move the four new calls into a file of their own beside the dossier commands
C. C. Leave the new commands out of the help

## What I had to decide

Confirm the two changes outside the territory: four calls added to kit/lib/ask/client.ts (pushProductDossier, findProductDossier, getDossier, readProductApproval) and the help pin in kit/lib/help/entries.test.ts updated to the new usage lines of omni dossier and omni prd.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

kit/lib/ask/client.ts gained four calls beside pushDossier and findDossier: POST /api/dossiers/push with productKey, GET /api/dossiers?product=&prd=, GET /api/dossiers/get?product=&prd=&kind= and GET /api/dossiers/approval?prd=<key>-<n>. Nothing existing changed. kit/lib/help/entries.test.ts pins the dossier entry's usage list exactly; it now lists the three new lines, and a new test checks the product PRD wording of omni dossier and omni prd.

## What it costs to change later

Each is a few lines to move or undo. Without the client calls the kit cannot reach a product PRD; without the test change the help test is red.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists kit/lib/help/entries.ts but not its test, and no slice lists kit/lib/ask/client.ts, which every kit call to the Omni page goes through.
