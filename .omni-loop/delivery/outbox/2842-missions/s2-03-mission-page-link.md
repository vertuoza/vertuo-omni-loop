---
id: s2-03-mission-page-link
prd: 2842
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Pushing a mission prints a link to its page, but no slice of the plan builds a page that shows one mission's brief. Where should that link lead?

## The decision, in plain words

The link reads like the other pages' links, at the missions address, and the page behind it is left for later. Until then it shows the usual page-not-found screen.

## The intro, for fun

The brief got a shiny new address before anyone built the house.

## The punchline, for fun

The mail is safe; the postman just has nowhere to knock yet.

## The options, in plain words

A. The missions address now, its page in a later slice or PRD (built)
B. The Fleet section's Missions tab, with the mission chosen in the address
C. A small page in this PRD that shows the brief and its versions, added to s7

## What I had to decide

Keep the missions address and build its page in a later slice or PRD (A), or point the link at the Fleet section's Missions tab, which shows the mission among the others (B).

## What I did meanwhile

omni mission push prints <app>/missions/<id>; the app stores every version of the brief, and the Missions tab of the Fleet section (s7) lists the mission once it is built.

## What it costs to change later

Small: the address is one entry in each of two lists, and a page reading a dossier by its id exists for every other kind.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the mission's page on the Omni app is the source of truth while it runs, and s7 says the Missions tab links its brief; neither names a page of its own, and no slice's territory holds one.
