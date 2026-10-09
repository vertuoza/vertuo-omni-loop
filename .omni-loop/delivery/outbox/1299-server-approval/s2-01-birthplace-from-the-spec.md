---
id: s2-01-birthplace-from-the-spec
prd: 1299
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

How does the page learn that a PRD was born on the server, so that only those PRDs can be approved there?

## The decision, in plain words

The page reads it from the first spec it receives: when that spec says it was born on the server, the PRD is marked so for good; any other first spec marks it as born in the repository. Nothing new has to be sent.

## The intro, for fun

Every PRD gets a birth certificate, and nobody had said who signs it.

## The punchline, for fun

The first spec signs it, and the ink never dries off.

## The options, in plain words

A. The database reads it from the first spec pushed, as built.
B. The kit's push sends the birthplace as its own field, and the brainstorm passes it.
C. The page sets it when the repository's phase 0 is on the server at the dossier's opening.

## What I had to decide

Whether the dossier's birthplace is read from the first pushed spec's front matter by the database, or sent as its own field of the push by the kit.

## What I did meanwhile

A trigger on new versions sets dossiers.birthplace from the first spec of a PRD dossier (server when its front matter says phase0: server, repo otherwise) and refuses any later change. Every existing PRD dossier with a spec is marked repo. The kit sends nothing new.

## What it costs to change later

Switching to a push field later is one optional field on the push and one line in the push function; the column and the set-once rule stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec writes the birthplace twice, in the front matter and on the dossier, but does not say which call carries it to the dossier. Reading it from the spec keeps the kit's push and the brainstorm skill (another slice) unchanged.
