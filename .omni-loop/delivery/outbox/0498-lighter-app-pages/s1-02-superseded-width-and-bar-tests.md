---
id: s1-02-superseded-width-and-bar-tests
prd: 498
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Two older checks still insisted on a faint top bar edge and a capped home page, rules this change deliberately replaces. Should they be updated here, though they sit outside the files this piece of work was given?

## The decision, in plain words

Yes: both checks were updated to the new rules in this same piece of work, so the checks stay green and still guard everything else they covered.

## The intro, for fun

Two old guards were still standing at posts that had been moved.

## The punchline, for fun

They got new orders instead of being sent home.

## The options, in plain words

A. Update both checks in this slice, as the spec replaces their rules.
B. Leave them failing and add a follow-up slice to update them.
C. Widen the plan's territory for s1 and keep the edits.

## What I had to decide

Whether a slice may edit tests outside its territory when the spec replaces the rule those tests guard.

## What I did meanwhile

The outline check no longer counts the top bar as a faint divider, and the home page check asks for full width with no cap.

## What it costs to change later

Reverting two small test edits and moving them into another slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 did not list these two test files (author).
