---
id: s2-05-schemas-apart-from-the-server-modules
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The database check loads each schema outside the web app, which two of this slice's modules cannot do, and the sign-in answer is a large object of which the arcade reads two fields: how are these read?

## The decision, in plain words

The ledger's, the profile's and the sign-in session's schemas now sit in small files of their own, which the check and the modules both load. The sign-in session is checked on the two fields the arcade reads, its other fields let through as they come.

## The intro, for fun

Some modules will not leave the house without the whole web app in their pocket.

## The punchline, for fun

Their descriptions now travel light, in a file of their own.

## The options, in plain words

A. A. Schemas in their own small files, the session checked on the two fields read: the option built.
B. B. Teach the database check to load the web app's page cache, in the first slice's script.
C. C. Check the whole session strictly, against an answer the authentication service may grow at any release.

## What I had to decide

Where a schema lives when its module cannot load outside the web app, and how strictly the sign-in session, which the authentication service shapes, is checked.

## What I did meanwhile

Three new files hold the ledger row, the profile's rows and the session, each imported by its module. The session's check is not strict: it needs the user's id, and GitHub's token as text or nothing; anything else in it is left alone.

## What it costs to change later

Three small files more; a session missing its user now reads as no session, as an answer that carried none always did.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the database check itself could learn to load such modules, which is its own slice's folder
