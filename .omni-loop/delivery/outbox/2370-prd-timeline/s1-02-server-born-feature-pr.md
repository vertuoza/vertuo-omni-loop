---
id: s1-02-server-born-feature-pr
prd: 2370
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A PRD approved on the Omni page keeps its folder off the main branch until it ships, so the sync cannot tell its feature branch by the folder. Should the sync find it by the feature pull request whose description says it closes that PRD?

## The decision, in plain words

For a PRD approved on the Omni page, the sync takes as its feature pull request the one on a feature branch whose description closes that PRD, and dates its slices, ready and merge from it while it is built.

## The intro, for fun

A PRD without a folder is a guest without a name tag.

## The punchline, for fun

So the sync reads the guest list instead: the line that closes it.

## The options, in plain words

A. Find the feature pull request of a PRD approved on the Omni page by the line that closes it.
B. Date such a PRD's lane only once it ships and its folder reaches the main branch.

## What I had to decide

Answer A to keep finding these PRDs' feature pull requests by their closing line. Answer B to date them only once they ship and their folder reaches the main branch, accepting that their earlier slices go unrecorded.

## What I did meanwhile

The sync keeps each pull request's description from the list it already reads, and for each PRD approved on the Omni page with no folder on the main branch, takes the feature pull request whose description carries the repository's closing line for it.

## What it costs to change later

A: none beyond the description already in the list, and the events of that one pull request. B: a few lines to remove; those PRDs' first and last slice stay not recorded, since a later read only sees what changed recently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A feature pull request whose description drops the closing line is not found, and that PRD's lane waits until it ships. (author)
