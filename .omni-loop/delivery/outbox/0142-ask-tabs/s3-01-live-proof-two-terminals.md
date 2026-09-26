---
id: s3-01-live-proof-two-terminals
prd: 142
slice: s3
rank: human-action
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Does the tabbed page really work with two real terminals asking at once, each answered in its own tab?

## The decision, in plain words

The phone layout is built and tested, but the real-world check needs a person: two terminals open, signed in on the page, answering each one.

## The intro, for fun

Two terminals walk into one page and each wants its own answer.

## The punchline, for fun

Only a person with two hands and one browser can referee this one.

## What a person must do

1. Open the preview deployment of the feature branch and sign in on its ask page.
2. In one checkout, point ask mode at that preview and switch it on, then open two Claude Code terminals there.
3. Have each terminal ask a question; check both show as tabs and that each answer reaches its own terminal.
4. Close one terminal; check its tab is gone on the next poll.
5. On a phone, or a window narrower than 720 px, open the folded list, pick a tab and answer there.
6. Record what you saw on the slice's pull request.

## What I had to decide

Whether the page and the terminals behave together as promised, proven live on the feature's preview deployment.

## What I did meanwhile

The folded tab list for phones is built, tested, and checked in a browser on the demo page at phone and desktop widths. The live proof is left for a person.

## What it costs to change later

Nothing to undo: this is a check, not a change. If it fails, the failure becomes a fix on the feature branch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the feature branch's preview deployment is up and signed-in reads work there was not checked (author).
- Running two interactive terminals and answering on the page as the signed-in person is not something an agent can do on the person's behalf (author).
