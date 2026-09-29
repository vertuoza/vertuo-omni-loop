---
id: s3-01-sidebar-tests-outside-territory
prd: 612
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Adding Engineering to the sidebar meant touching three tests the plan did not list, the ones that count the sidebar's entries on every page. Is that all right?

## The decision, in plain words

We taught those three tests about the new Engineering entry, exactly as the Repositories entry did before. Nothing else outside the plan was changed.

## The intro, for fun

The sidebar grew one line, and three tests noticed.

## The punchline, for fun

We told them politely, and they counted to one more.

## The options, in plain words

A. A. Keep the three test edits, the option built.
B. B. Widen the plan's territory for sidebar changes to name these tests, and keep the edits.

## What I had to decide

Whether slice s3 may change three sidebar tests outside its territory: apps/galaxy/src/nav/Sidebar.render.test.ts, apps/galaxy/src/switch/headers.test.ts and apps/galaxy/src/switch/switch.test.ts, as s1 did for the Repositories entry (item s1-01, adopted).

## What I did meanwhile

Each of the three tests now expects the Engineering entry after Workspace, and headers.test.ts also checks /app/engineering sits in the app shell with the title Engineering.

## What it costs to change later

Reverting is removing the Engineering entry from three expected lists; the sidebar tests then go red, since the sidebar change forces them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant apps/galaxy/src/nav/sidebar to cover Sidebar.render.test.ts, whose name differs only in case (author)
