---
id: s2-04-the-prd-list-reads-a-repository-every-prd-had
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The page that lists every PRD, and a PRD's own page, still expect each PRD to have a home project. A PRD that lives only on its product has none: who teaches those pages, and before when?

## The decision, in plain words

Not this slice: it only taught the terminal and the routes it calls. The pages are left as they were, and a product PRD must not be created for real until a later slice teaches them.

## The intro, for fun

We built a new kind of guest, but the guest list still asks for a street address.

## The punchline, for fun

Nobody sends the invitation until the list learns to leave that line blank.

## The options, in plain words

A. A. Leave the pages to a later slice, before any product key is set (built)
B. B. Widen this slice to the PRD list and page now
C. C. Make the database leave product PRDs out of the list until the pages learn them

## What I had to decide

Name the slice that teaches the PRD list and the PRD page a product PRD (no home repository, no repository number, its name `mobile-12`), before any product key is set in production: s4, which owns DossierPage.tsx, or a new slice for apps/galaxy/src/dossier/page/history.ts and view.ts.

Decided by: Jev (hardToRevert 0.60) · agent said true

## What I did meanwhile

DossierRow.home_repo stays typed as text: making it nullable turns the typecheck red in apps/galaxy/src/dossier/page/history.ts and view.ts, outside this territory. history.ts's stageKeyOf calls home_repo.toLowerCase() on a dossier with no PRD number, which a product PRD is, so the list would throw on one. The dossier fake leaves a product PRD out of dossier_list(), and the product PRD calls of this slice read no page row. No product PRD can exist until an owner sets a product's key (product_set_key()), which no page offers yet.

## What it costs to change later

A guard in two page modules and their tests; nothing stored changes. Left undone, the PRD list breaks for a workspace the day its first product PRD is created.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice apps/galaxy/src/dossier/page/history.ts or view.ts; s1's item s1-03 named the dossier list among the readers s2 and s3 would teach, but neither territory holds it.
