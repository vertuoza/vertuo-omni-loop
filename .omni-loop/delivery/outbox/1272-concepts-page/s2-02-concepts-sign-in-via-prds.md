---
id: s2-02-concepts-sign-in-via-prds
prd: 1272
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When someone who is not signed in opens the Concepts list, how do they sign in?

## The decision, in plain words

The page tells them to sign in from the PRDs page and links to it; once signed in, they come back to Concepts from the menu.

## The intro, for fun

The Concepts room opened before anyone fitted it with its own front door.

## The punchline, for fun

For now, guests use the PRDs entrance next door and walk over.

## The options, in plain words

A. A. Point a signed-out person to the PRDs page's sign-in.
B. B. Give /concepts its own sign-in callback, so it comes straight back to the list.

## What I had to decide

Whether /concepts gets its own sign-in that returns to it, which needs a /concepts/callback route outside this slice's territory (app/concepts/page, layout and loading only), or points to the sign-in /prd already has.

## What I did meanwhile

Signed out, /concepts shows a card "Sign in to see your workspace's concepts" with a link to /prd, whose sign-in returns to /prd. The other states: no database (closed), the demo (empty list) and a failed read (the dossier database notice), each covered by src/concepts render and state tests. The date on each card is the concept dossier's creation date, the first push of the concept.

## What it costs to change later

One callback route, app/concepts/callback/route.ts, copied from app/bugs/callback with WORK_PATHS.concept, and the page then renders DossierSignIn with a concept copy. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 names no callback route, and the spec does not say how a signed-out person reaches /concepts (author)
