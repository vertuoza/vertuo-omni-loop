---
id: s26-01-arcade-iii-reads-keep-hand-checks
prd: 725
slice: s26
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The dossier pages, the home page and the waiting badges read data from the browser's storage, from our own web routes and from GitHub. Should those reads be rewritten to go through a formal schema now, or may they keep the checks they already make by hand?

## The decision, in plain words

They keep the checks they already make by hand, so nothing the pages show can change. Each spot where the code trusts the shape it was given now says why, in a short note on that line.

## The intro, for fun

Some doors already had a bouncer checking names by hand.

## The punchline, for fun

We gave each bouncer a name badge instead of hiring a new one.

## The options, in plain words

A. Keep the hand-written checks, and mark each cast with its reason: no output change.
B. Replace each hand-written check with a folder-local Zod schema, at the risk of small changes in what a malformed value does.
C. Leave it to a follow-up pull request after the ratchet: the same as A now, with a ticket for B.

## What I had to decide

Whether this slice should have replaced the existing hand-written checks on outside reads with schemas.

## What I did meanwhile

Every cast in the slice's source files carries a ts-allow reason, the hand-written checks stay as they were, and the index checks and the Database-typed clients are in place.

## What it costs to change later

Replacing a hand-written check with a schema later is a local change in one file per read, with its existing tests as the guard.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I did not list every outside read in the territory one by one; the ones seen are the browser-storage reads in waiting/alerts, waiting/documents and dossier/page/outbox-picks, the route answers read in dossier/page/OutboxSend, waiting/outbox and waiting/business, and GitHub's answers in dossier/github/reader.
- (author) The plan's done-when asks for a schema on every outside read; this slice meets it only where a schema already existed (dossier/page/voice).
