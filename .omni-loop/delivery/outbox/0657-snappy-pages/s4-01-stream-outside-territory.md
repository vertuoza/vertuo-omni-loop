---
id: s4-01-stream-outside-territory
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Making a PRD's page show before GitHub answers meant changing the part that builds that page and the existing page tests, which were not on this step's list. Is that all right?

## The decision, in plain words

The PRD page's builder now reads GitHub beside the page instead of before it, and the existing page tests check what a page ends up as once every piece has arrived. Nothing a person sees changed, apart from the page arriving sooner.

## The intro, for fun

The plan gave this step a list of rooms to paint, and one door was in the hallway.

## The punchline, for fun

The door is painted the same colour, and the hallway looks the same as before.

## The options, in plain words

A. Keep the change: the PRD page reads GitHub beside the page, and the tests read the finished page (built).
B. Undo the page builder change: the PRD page waits for GitHub as before, behind its loading skeleton only, and its tests go back as they were.

## What I had to decide

Whether s4 may change apps/galaxy/src/dossier/page/DossierRoute.tsx (the numbered PRD page now returns a streamed page, with its GitHub reads started and not awaited) and the page tests outside its territory (src/dashboard/page.test.ts, src/dashboard/board/page.test.ts, src/dashboard/fleet/page.test.ts, src/dossier/page/page.test.ts, src/fixes/routes.test.ts), which now read a streamed page through src/dossier/page/stream/settled.ts or unwrap the Streamed block.

## What I did meanwhile

Changed them: DossierRoute.tsx keeps its gate, its read and its redirects; a numbered PRD goes to src/dossier/page/stream/DossierStream.tsx, a draft and a fix render as before. The tests keep every assertion they had and read the settled page; /app's test gains the streamed and workspace-out-of-reach cases.

## What it costs to change later

Reverting is two files of code and five test helpers; no stored data, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the page builder to stay untouched, or simply did not list it, is not written anywhere.
