---
id: s2-01-tab-switch-drops-draft
prd: 142
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

When a person has started answering in one terminal's tab and then opens another tab, should the page keep their unfinished answer?

## The decision, in plain words

Opening another tab loads that terminal's page fresh, so an answer started but not sent in the first tab is lost and must be picked again on return.

## The intro, for fun

Two terminals, one half-written answer, and a person who wandered off to check the other tab.

## The punchline, for fun

The page has the memory of a goldfish for unsent answers, for now.

## The options, in plain words

A. Switching tabs starts the other terminal fresh; an unsent answer is dropped (built).
B. Keep each tab's unsent picks in the browser while the page stays open.
C. Ask before leaving a tab with unsent picks.

## What I had to decide

Whether an unsent answer must survive a switch to another tab and back.

## What I did meanwhile

Picking a tab opens that terminal's own address; the pane starts from what the database holds, with no picks made.

## What it costs to change later

Keeping the picks means holding every visited tab's draft in the browser: a change to the page component only, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often a person switches tabs mid-answer is unknown (author).
