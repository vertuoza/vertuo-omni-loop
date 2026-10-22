---
id: s4-03-list-new-github-caller
prd: 2433
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The module that checks a key's GitHub App and mints its tokens calls GitHub with the App's own signed requests, and a test outside this slice's folders lists every file that calls GitHub: may this slice add one line there?

## The decision, in plain words

Yes: the new file is listed in that test as one of the App's own signed callers, which is the only change outside the slice's folders. Without the line the whole test run stays red.

## The intro, for fun

A new caller signs the guest book at the door of GitHub.

## The punchline, for fun

One line outside the folders, and the book stays honest.

## The options, in plain words

A. A. Add one line to the call-sites test for the new file, as a signed caller of the App, and report the breach of the slice's folders.
B. B. Keep the GitHub address out of the new file by importing it from the sign-up module, which leaves the test untouched but ties two features to one file.
C. C. Move the new module into the sign-up folder where the first signed caller already lives, which changes the path the later slices were told to import.

## What I had to decide

A test that lives beside the arcade's sources fails whenever a source file names GitHub's address and is not on its list, so a new caller must be added there, whatever folder it sits in. The plan's territory for this slice does not name that test, and the full test run is the check a slice must pass before its pull request is marked ready.

Decided by: Jev (hardToRevert 0.76) · agent said false

## What I did meanwhile

Added the one line for keys/github-app.ts, kind jwt (the App's own signed calls, like the sign-up module's), to apps/galaxy/src/github-call-sites.test.ts. Nothing else outside the slice's folders and the outbox changed.

## What it costs to change later

Small. Removing the line puts the test back to red; a later slice that moves or renames the module changes the same one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the later slices that import this module must be listed as callers too: they only import it and name no GitHub address, so I believe not (author)
