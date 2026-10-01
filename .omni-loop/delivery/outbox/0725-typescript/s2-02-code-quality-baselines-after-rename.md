---
id: s2-02-code-quality-baselines-after-rename
prd: 725
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

After the rename, the code-quality check mistakes old known problems for new ones, because every file moved by a line and is read as a new language. Who refreshes its saved list of known problems, and when?

## The decision, in plain words

The saved list now uses the new file names, but it was not regenerated: the house rule says never to regenerate it just to turn the check green. Until someone refreshes it, the check on the final feature change will report old problems as new.

## The intro, for fun

Every known problem in the codebase moved one seat to the left, and the guest list no longer matches.

## The punchline, for fun

Nobody new came to the party; the seating chart just needs reprinting.

## The options, in plain words

A. A: keep the saved lists as renamed only, and refresh them once on the feature branch after the last typing slice
B. B: refresh them now in the rename slice, and again after each typing wave
C. C: refresh them only when the feature pull request's audit goes red, naming the rename as the reason

## What I had to decide

Whether to regenerate the fallow baselines (dead code, duplication, health) in the rename slice, against fallow/README.md's rule never to regenerate one to turn a red audit green.

## What I did meanwhile

fallow/dead-code.json, fallow/dupes.json and fallow/health.json carry the renamed file names and nothing else. A local `fallow audit` against the feature branch still reports inherited findings as new (clone groups and complexity under shifted line numbers, a duplicate export now seen between apps/galaxy/src/jev/mask.ts and kit/lib/openrouter.ts). The audit runs only on the feature pull request into main, not on this sub-pull request.

## What it costs to change later

Three commands from fallow/README.md, run once on the feature branch after the last typing slice (s29), in a commit of their own that says why.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a rename that moves every line counts as clearing findings, the one case fallow/README.md allows a regeneration, is not settled
- (author) Later typing slices move lines again, so a refresh now would go stale before the feature pull request is graded
