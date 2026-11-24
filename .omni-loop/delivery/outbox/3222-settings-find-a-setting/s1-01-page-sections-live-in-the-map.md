---
id: s1-01-page-sections-live-in-the-map
prd: 3222
slice: s1
rank: medium
bears-on: none
raised: 2026-11-24
wave: 1
---

## The question, in plain words

The search must find a section inside a page, such as Retired fleets, but the spec does not say where the list of a page's sections is kept. Where should it live?

## The decision, in plain words

I planned for the settings map to hold each page's sections, with their summary and keywords, and for a test to check that every page really shows them. No page has to change.

## The intro, for fun

A search needs something to search, and someone has to keep the list.

## The punchline, for fun

The map keeps the list, and a test keeps the map honest.

## The options, in plain words

A. A. The map holds each page's sections (anchor, label, summary, keywords) and a test checks each page renders them.
B. B. Each page declares its own sections and the map reads them, which touches all six pages and the two page PRDs' territories.
C. C. The search finds pages only, with no sections, which leaves most of the spec unmet.

## What I had to decide

Whether the settings map or each page owns the list of the page's sections.

## What I did meanwhile

The plan goes ahead with the map owning the list; nothing is built until the plan is approved.

## What it costs to change later

Moving the list into the pages later is a small change inside one slice, with no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says keywords are kept in the map beside the label but does not say where a page's sections are declared (author)
- The anchors the two page PRDs give are not written yet, so the first slice reads them from the pages as built (author)
