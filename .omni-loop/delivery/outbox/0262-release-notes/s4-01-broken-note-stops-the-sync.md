---
id: s4-01-broken-note-stops-the-sync
prd: 262
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

When a release note that breaks the writing rules reaches the main branch, what should the publishing step do with that release and with the others?

## The decision, in plain words

It publishes nothing at all until the note is fixed, lists every broken rule, and fails loudly, so no release is ever numbered out of order.

## The intro, for fun

One sloppy note slips past two guards and lands on the main branch. Somebody has to decide how loud to be.

## The punchline, for fun

The whole release train waits at the platform until one note learns to spell.

## The options, in plain words

A. Publish nothing until the broken note is fixed, list every broken rule and fail the run: the option built.
B. Publish the others, leave that PRD out and fail the run: it would get its number later than PRDs that reached main after it.
C. Publish that PRD under its spec title with no description, as if it had no note, and fail the run: a note pinned to the initial release would then take a later number, for good.
D. Publish the broken note as written and only warn in the log.

## What I had to decide

What the sync does when a shipped PRD's `release.md` fails the rules `omni check releases` enforces (or a shipped folder has no `spec.md`, or a note-less PRD's spec cannot be parsed). The spec settles a PRD with no note (rule 5: its spec title, an empty description) but not a note that is there and broken. The ship guard and the feature PR's review should stop it before main, yet a hand edit or a later rule change can still put one there.

## What I did meanwhile

`apps/galaxy/src/releases/sync-shipped.ts` refuses such a folder, naming the file and each rule in the kit's words, and `sync-run.ts` then writes nothing (no insert, no text refresh), prints the refusals and exits 1, so the releases workflow fails. Once a pull request fixes the note, the next run numbers every PRD waiting since in main's order, so a rebuild still gives the same rows (`sync-run.test.ts`, `sync-shipped.test.ts`).

## What it costs to change later

A few lines in `sync-shipped.ts` and `sync-run.ts` and their tests. Nothing stored changes: numbers are only stamped by a successful run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether one broken note may hold back every other release, or how long such a block may last before someone notices the red workflow run.
