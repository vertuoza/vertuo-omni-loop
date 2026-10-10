---
id: s9-15-design-paths-include-the-routes-folder
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The plan listed three folders for the check that spots screen changes, but the pages and layouts that put our screens on their addresses live in a fourth folder. Should that folder count too?

## The decision, in plain words

Yes: the routes folder of the web app was added to the three the plan names, so a change to a page or a layout reads as a screen change.

## The intro, for fun

The plan listed the rooms and forgot the hallway that leads to them.

## The punchline, for fun

The hallway got its own sign on the door.

## The options, in plain words

A. Add the routes folder to the three the plan names (built)
B. Keep the three folders the plan names, and nothing else

## What I had to decide

Whether apps/galaxy/app/ joins the three folders the plan names for design.paths.

## What I did meanwhile

design.paths in .omni-loop/config.yml lists apps/galaxy/src/, apps/galaxy/app/, apps/omni-app/src/ and packages/design/. Without the second, a change to apps/galaxy/app/layout.tsx (zoom for every page) would read ui: no.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan name three folders and say nothing of apps/galaxy/app/
