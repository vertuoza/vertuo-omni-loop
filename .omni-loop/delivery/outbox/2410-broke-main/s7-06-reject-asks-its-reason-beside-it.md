---
id: s7-06-reject-asks-its-reason-beside-it
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

The page's drawing shows each finding with only Approve and Reject, and the spec lets a rejection carry an optional reason. Where does the member type it?

## The decision, in plain words

Reject first opens a small optional field beside it, then a second Reject sends the rejection with or without a reason; Approve stays one click, and only the first open finding's Approve is the page's main button.

## The intro, for fun

Saying no is easy; saying why takes one more box.

## The punchline, for fun

The box only shows up when you are already saying no.

## The options, in plain words

A. Open an optional reason field when Reject is clicked, then reject (built).
B. Reject in one click, with no reason.
C. Show the optional reason field on every card at rest.

## What I had to decide

Pick A to keep the field that opens on Reject, B to reject in one click with no reason, or C to show the reason field on every card at rest.

## What I did meanwhile

A proposed finding shows Approve and Reject, as the before/after page draws them. Reject opens a field (Why, if you like) with Reject and Cancel; Enter or Reject sends it. The first proposed finding's Approve carries the page's primary look, the others the quiet one, as the drawing shows.

## What it costs to change later

B or C is a few lines of the card's component; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Rejecting takes two clicks, where the voice's answer promised one click per proposal; approving keeps one.
