---
screen: concept-page
status: draft
kind: page
mock: concept-page.html
implements: ["apps/galaxy/app/concepts/[id]/page.tsx", apps/galaxy/src/concepts/ConceptPage.tsx, apps/galaxy/src/concepts/ConceptPage.view.ts, apps/galaxy/src/concepts/areas.ts, apps/galaxy/src/concepts/state-chip.tsx, apps/galaxy/src/concepts/MarkDoneButton.tsx]
reads: [apps/galaxy/src/concepts/state.ts, apps/galaxy/src/concepts/ConceptPage.read.ts, apps/galaxy/src/stages/stage.ts, apps/galaxy/src/dossier/page/dossier.css, apps/galaxy/src/nav/AppShell.tsx]
routes: [/concepts/<id>]
supersedes: null
---

## Purpose

One concept, laid out as a dossier's page: its state, its links on GitHub, and its tabs (Overview,
Areas, Vision tour, Boards, Debate). The Areas tab says where each area's PRD has got, and a member
marks the concept done when the rest will never be built (PRD 2213).

## Regions

- **The header:** the Concept badge, `#n ↗` to its issue, the title; actions Copy link, and Mark done
  (in the inbox, not shipped) or Reopen (shipped by a person).
- **The facts:** State, its chip (`in review`, `in the inbox`, `shipped`, `state unknown`); On GitHub,
  its issue and its concept PR.
- **The tabs,** Areas among them.
- **The Areas tab:** the areas in build order, the wedge marked; each area's PRD link with its stage
  (`PRD`, `inbox`, `building`, `outbox`, `shipped`, `retro`, or `syncing`); the first area without a
  PRD carries its brainstorm line with Copy, unless the concept is shipped.

## States

- **In review:** the chip edged in cyan; no Mark done.
- **In the inbox:** the chip filled yellow; Mark done in the header.
- **Shipped by itself:** the chip filled green; no Mark done, no Reopen.
- **Shipped by a person:** the chip filled green; Reopen; each area without a shipped PRD reads
  `not built` in red.
- **State unknown:** the chip muted.
- **A close or reopen that failed:** one line under the header saying so; the state as it was.

## Words

`shipped`, `Mark done`, `Reopen`, `not built`, `syncing`, and the stage words of the PRDs tab.

## Refusals

- Never "shipped" for a concept in review.
- Mark done never shows on a concept shipped by itself.

## Open questions

- Where the failed-close line sits exactly, and its words.

## Source

/omni:brainstorm, PRD 2213: .omni-loop/delivery/inbox/2213-concept-shipped/before-after.html
