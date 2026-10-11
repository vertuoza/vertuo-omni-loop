---
id: s4-02-github-call-sites-listed
prd: 1612
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The new proof page reads the code host as the app does: may this slice add it to the list of places allowed to call the code host, a test outside its own folders?

## The decision, in plain words

Yes: the page's reader is added to that list as one more caller through the shared, budget-aware client, and nothing else in that test changed.

## The intro, for fun

The guest list for calling the code host had a new name scribbled at the bottom.

## The punchline, for fun

The bouncer checked: same door, same budget, same rules.

## The options, in plain words

A. A. List the attestation's reader as a new client call site.
B. B. Move the attestation's GitHub reads into the PRD page's existing reader, and list nothing new.

## What I had to decide

apps/galaxy/src/github-call-sites.test.ts lists every galaxy file that calls GitHub, and fails on a new one. The attestation's reader (apps/galaxy/src/dossier/attestation/attestation-github.ts) calls GitHub through @omni/github, so it is listed as `client`. The file is outside s4's territory.
Decided by: Jev (hardToRevert 0.64) · agent said false

## What I did meanwhile

One line added to the SITES map of apps/galaxy/src/github-call-sites.test.ts.

## What it costs to change later

One line to remove, or the reader moved into an already listed file (apps/galaxy/src/dossier/github/reader.ts).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory did not foresee the call-site guard (author).
