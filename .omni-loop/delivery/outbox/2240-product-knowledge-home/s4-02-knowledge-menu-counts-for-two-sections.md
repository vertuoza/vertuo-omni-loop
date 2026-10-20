---
id: s4-02-knowledge-menu-counts-for-two-sections
prd: 2240
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

The Knowledge menu shows a count only for Legal and Glossary, so should Constituents and Personas show theirs too, which needs a change in the menu that an earlier slice owns?

## The decision, in plain words

The Constituents and Personas pages are built, but their menu entries show no count yet, because the menu belongs to an earlier slice and the counts need data it does not read today.

## The intro, for fun

Two new tabs arrived with their number tags still in the post.

## The punchline, for fun

The menu will hang them once someone signs for the delivery.

## The options, in plain words

A. Leave the menu counts for a follow-up in the frame's own slice and ship the two sections without them (built).
B. Widen the frame in this slice so the menu counts constituents and personas too, going outside the territory.

## What I had to decide

The first criterion says the list sections show their count in the menu. The menu (knowledge-sections.ts, KnowledgeNav.tsx and the page frame) is outside this slice's territory and reads only the Legal and Glossary entries from the product's knowledge; counting constituents and personas needs two more reads in that frame. I built the two sections and left the menu as it is. Constituents have a Retired filter; Personas have none, since a deleted persona is not readable by a member.

## What I did meanwhile

The Constituents and Personas entries show without a count; each page shows its own Active and Retired counts (Constituents) or its rows (Personas).

## What it costs to change later

Adding the counts is one read per section in the page frame and two keys in the counts table, about forty lines plus their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a deleted persona should show behind a Retired filter, which needs its row readable by members (author)
