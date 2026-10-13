---
id: s5-01-guide-tests-outside-territory
prd: 1831
slice: s5
rank: medium
bears-on: none
raised: 2026-10-13
wave: 3
---

## The question, in plain words

The new guide page for any coding agent could only be added by also updating the two docs tests that pin the guide's page list, which the plan did not give this slice. Should the page sit right after Cloud sessions, as built?

## The decision, in plain words

The page sits right after Cloud sessions in the guide, and the two docs tests that list every guide page now list it too, with its title and its Next link to How the loop works.

## The intro, for fun

One new page walked into the guide, and two tests asked to see its ticket.

## The punchline, for fun

It was on the list after all: right behind Cloud sessions.

## The options, in plain words

A. Keep the page after Cloud sessions, the two docs tests updated to list it.
B. Move the page elsewhere in the guide, such as after Install, and update the same tests.

## What I had to decide

Keep the page after Cloud sessions (A), or move it elsewhere in the guide's order (B).

## What I did meanwhile

The page is served under /docs/any-agent, between Cloud sessions and Invade, and the docs tests pass.

## What it costs to change later

Moving it later is one line in the guide's order file and the same lines in the two tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this slice named the guide files but not apps/galaxy/src/docs/guide.test.ts and docs.test.ts, which pin the page list (author).
