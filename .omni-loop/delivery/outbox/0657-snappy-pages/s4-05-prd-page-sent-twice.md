---
id: s4-05-prd-page-sent-twice
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

A PRD's page now shows as soon as the database answers, then shows again, complete, when GitHub answers, so a long spec travels twice. Is that trade fine?

## The decision, in plain words

Yes for now: the page is readable at once, and the complete copy quietly replaces the first one with the stage button, the GitHub links, the Outbox and the Retro filled in.

## The intro, for fun

The newspaper arrives early, with a blank box where the weather goes.

## The punchline, for fun

Later a second copy lands on the mat, weather included, and the first one goes in the recycling.

## The options, in plain words

A. Send the page from the database first, then the complete page in its place (built).
B. Reshape the PRD page so only its GitHub parts (the stage button and links, the Outbox and Retro tabs and their badges) stream as small blocks of their own.

## What I had to decide

Whether /prd/<id> streams its GitHub pill and outbox as small blocks of their own, or as a whole-page swap. The view that draws them (dossierView in view.ts, DossierPage.tsx) builds the header, the tabs' badges and the Outbox pane from one GitHub summary, and both files are outside s4's territory.

## What I did meanwhile

src/dossier/page/stream/DossierStream.tsx renders a Suspense whose fallback is the page drawn from the database (pendingView: Outbox and Retro read 'Reading GitHub…', no GitHub badges or links) and whose content is the complete page with LiveRefresh. The shown Spec or Plan is rendered once and shared by both.

## What it costs to change later

Moving to small blocks later is a reshaping of the PRD page's view and page files; no stored data, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How large the doubled page gets for the longest specs on production was not measured.
