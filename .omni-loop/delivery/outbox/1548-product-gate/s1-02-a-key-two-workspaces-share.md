---
id: s1-02-a-key-two-workspaces-share
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

A product's key is unique inside its workspace only. When a person belongs to two workspaces that both have a product with the same key, which one does a PRD name like mobile-12 mean?

## The decision, in plain words

The workspace that lists the repository the command runs from wins, or the one that owns its organisation; failing that, the oldest product with that key. Nothing is refused.

## The intro, for fun

Two workspaces, two products, one short name, one confused terminal.

## The punchline, for fun

The terminal asks the repository where it lives and settles the tie.

## The options, in plain words

A. A. The repository's workspace first, then the oldest product (built).
B. B. Refuse the name and ask for the workspace when two hold the key.
C. C. Make product keys unique across every workspace.

## What I had to decide

Confirm the tie-break, or ask that the server refuse the ambiguous name and make the person say which workspace.

## What I did meanwhile

product_of_key(key, repo) ranks the caller's products with that key by whether their workspace lists repo (or owns its owner), then by age. dossier_push() passes p_repo to it, and prd_dossier() (behind dossier_approval() and approval_request()) does the same, so the kit sending its checkout's repository picks the right one.

## What it costs to change later

Refusing instead is a raise in product_of_key() when two rows tie on the first rank; no stored data changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec keys a product PRD by product key and counter and says nothing of a person in two workspaces sharing a key.
