---
id: s2-03-fix-page-does-not-refresh-on-new-rounds
prd: 627
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

A PRD's page refreshes itself when a new version arrives. Should a fix's page do the same when a new round of looks or a new bug record arrives?

## The decision, in plain words

Not yet: a fix's page shows what was there when it was opened, and a reload shows anything newer. A PRD's page refreshes itself exactly as before.

## The intro, for fun

Round three landed, but the page is still admiring round two.

## The punchline, for fun

A reload is the fastest time machine we ship today.

## The options, in plain words

A. A. A fix's page refreshes when its page of today and the pick changes, and only then; a new round or record needs a reload (built).
B. B. Count rounds and records in the pulse too, so a fix's page refreshes on every new version.

## What I had to decide

Whether a fix's page should refresh itself when a new round or record is pushed while someone reads it.

## What I did meanwhile

The page's change check counts only a PRD's spec, plan and page of today beside the pick, as the database's pulse does; a fix whose page of today and the pick changes still refreshes, a new round or record does not.

## What it costs to change later

Small: the pulse the database gives would count the two new kinds too, and the page's check would compare them; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a fix's page refreshes itself, and the pulse lives in a shared file no slice of this plan owns.
