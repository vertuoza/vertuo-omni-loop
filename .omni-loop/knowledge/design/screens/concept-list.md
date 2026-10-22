---
screen: concept-list
status: draft
kind: page
mock: concept-list.html
implements: [apps/galaxy/app/concepts/page.tsx, apps/galaxy/src/concepts/ConceptList.tsx, apps/galaxy/src/concepts/state-chip.tsx]
reads: [apps/galaxy/src/concepts/list.ts, apps/galaxy/src/concepts/state.ts, apps/galaxy/src/stages/store.ts, apps/galaxy/src/dossier/page/dossier.css, apps/galaxy/src/nav/AppShell.tsx]
routes: [/concepts]
supersedes: null
---

## Purpose

Every concept of the person's workspaces, newest first, each a card with its state and how far its
areas have got (PRD 2213).

## Regions

- **A card per concept:** its title, its state chip, then its facts as short pieces:
  `<m> of <n> have a PRD` · `<k> of <n> shipped` · its date.

## States

- The chip reads `in review`, `in the inbox`, `shipped` or `state unknown`, as on the concept page.
- No concept yet: the page says how to start one.

## Words

`have a PRD`, `shipped`, and the chip's words.

## Refusals

- The facts line is never one long sentence: each piece stands alone.

## Open questions

None.

## Source

/omni:brainstorm, PRD 2213: .omni-loop/delivery/shipped/2213-concept-shipped/before-after.html
