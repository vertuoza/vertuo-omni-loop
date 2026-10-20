---
prd: 2213
title: A concept reads as shipped
blocked-by: none
spec: file
phase0: server
---

## Problem

A concept (PRD 1272) has three states: in review while its concept PR is open, in the inbox once it
merged, and state unknown. Nothing comes after the inbox. Concept #1269, Products, has a PRD for each
of its six areas, and all six shipped, yet its page and its card on the Concepts list still say "in
the inbox". Its Areas tab links each PRD but says nothing of where each one is, so a reader cannot
tell a finished concept from one that has not started. A concept whose remaining areas will never be
built has no way to be closed either.

## Solution

A concept gains a fourth state, **shipped**, reached in either of two ways:

1. **By itself:** its concept PR has merged, every area of its Areas table names a PRD, and each of
   those PRDs' stored stage is `shipped` or `retro`.
2. **By a person:** its concept PR has merged and its GitHub issue is closed. A workspace member
   closes it from the concept page with **Mark done**, or on GitHub as for any issue. Reopening the
   issue, from the page with **Reopen** or on GitHub, undoes it.

What changes, screen by screen:

- **The state chip,** on the concept page's header and on each card of the Concepts list, reads
  `shipped` for a shipped concept, in the green that says done elsewhere on the app pages.
- **The Areas tab:** each area that names a PRD shows that PRD's stage beside its link, in the words
  the PRDs tab uses (`PRD`, `inbox`, `building`, `outbox`, `shipped`, `retro`; `syncing` while no
  stage is stored). On a concept shipped by a person, an area without a shipped PRD reads
  `not built`, and the brainstorm line of the first area without a PRD is no longer offered.
- **The Concepts list card** splits its line of facts into short pieces, `<m> of <n> have a PRD` · `<k> of <n> shipped` ·
  its date, the shipped count new (the word pass found today's line too long at rest).
- **Mark done,** in the concept page's header actions, for a concept in the inbox that is not
  shipped. Pressed, it closes the concept's issue as completed through the Omni app, with one comment,
  `Marked done on the Omni page by @<login>.`, then the page reloads reading `shipped`. **Reopen**
  takes its place on a concept shipped by a person, and reopens the issue with
  `Reopened on the Omni page by @<login>.` A concept shipped by itself shows neither.
- **Keeping it current:** the 15-minute sync keeps reading a merged concept's issue (one GitHub read
  per concept; its PR is no longer read once merged, as today), and a GitHub `issues` event on a
  concept's issue refreshes that concept's stored facts at once, through the touched route.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | concept state | `'shipped'` in `ConceptState`, label `shipped` | no written convention: follows `apps/galaxy/src/concepts/state.ts:9` and `STAGE_LABELS` ← `apps/galaxy/src/stages/stage.ts:26` |
| vertuo-omni-loop | chip class | `.fix-state-shipped` | no written convention: follows `.fix-state-merged` ← `apps/galaxy/src/dossier/page/dossier.css:730` |
| vertuo-omni-loop | route | `POST /api/concepts/done`, body `{ concept, done: true \| false }` | no written convention: follows `app/api/dossiers/approval/route.ts` and `APPROVAL_ROUTE` ← `apps/galaxy/src/dossier/page/approval.ts:32` |
| vertuo-omni-loop | component | `MarkDoneButton` | no written convention: follows `ApproveButton` ← `apps/galaxy/src/dossier/page/ApproveButton.tsx:22` |
| vertuo-omni-loop | area view field | `stage: string \| null` on `AreaView` | no written convention: follows `AreaView` ← `apps/galaxy/src/concepts/areas.ts:14` |

## Decisions

- **Shipped by itself counts `shipped` and `retro`:** a PRD with a retro has shipped. Every area must
  name a PRD: an area without one keeps the concept open until a person marks it done.
- **One word, `shipped`, for both ways** (the person's answer). The difference shows on the Areas
  tab: an area left without a shipped PRD reads `not built` on a concept a person closed.
- **The voice objected** (persona:Paul - Product Manager): a concept closed early that reads
  "shipped" would count its dropped areas as delivered in a roadmap review. **Accepted:** the
  `not built` mark above is the answer.
- **Who may mark it done:** any member of the concept's workspace (the person's answer), checked as
  the caller, never with a service key, as the PRD approval is (`public.is_member`). The issue is
  closed with the Omni app's installation token, server-side only, as the approval label is
  (`apps/galaxy/src/approval/label.ts`).
- **Both ways mark it done** (the person's answer): the button, and closing the issue on GitHub. Any
  close counts, whatever GitHub's reason (`completed` or `not planned`): the page reads only open or
  closed, as it does today, and the button closes as `completed`.
- **A concept still in review is never shipped:** a closed issue counts only once its concept PR has
  merged. Mark done shows only for a concept in the inbox.
- **No migration:** `fix_facts.facts` is `jsonb` and already holds the issue's `state`; the PRD
  stages come from `prd_stages` through `StageStore.currentStages`, one read for the workspace.
- **No record table:** the issue's close, its comment naming who, and GitHub's timeline are the
  record, as the approval label's history is.
- A failed close or reopen leaves the state as it was and says so on the page, in one line; it is
  never retried by itself.
- BR-PRODUCT-93 stays true: a concept with no stored facts, or whose pull request is unread or
  missing, is `state unknown`.

## User stories

- As a PM following a concept, I see `shipped` on its card once every area's PRD has shipped, without
  opening anything.
- As a PM, I open a concept's Areas tab and see, area by area, how far each PRD has got.
- As a workspace member, I mark a concept done when its remaining areas will never be built, and
  undo it if I was wrong.
- As a reviewer, I see which areas of a concept closed early were never built.

## Scope

**In:** the shipped state and its two ways, the chip, the Areas tab's stages and `not built`, the
list card's shipped count, Mark done and Reopen, the sync and the touched route keeping a merged
concept's issue current.

**Out:** a reason typed when marking done; `omni status` or any kit command counting shipped
concepts; notifications when a concept ships; concepts whose areas' PRDs live in another repository
than the concept's (each area's PRD is read in the concept's own repository, as the Areas tab links
it today).

## Test seams

Unit and service tests, with fakes, as `omni kb show testing` says; no test calls GitHub.

- `conceptState` as a pure function: each state from facts and stages, the order of the rules, and
  BR-PRODUCT-93's unknown cases.
- `areaViews`: each area's stage word, `syncing`, `not built` only on a concept a person closed, and
  no brainstorm line on a shipped concept.
- The list: the shipped count, from stored facts and one stages read.
- The route: a member's close and reopen against a fake GitHub (the call, its body, the comment), a
  non-member refused (403), a signed-out caller refused (401), a GitHub failure answered without a
  state change.
- The refresh: a merged concept's issue re-read, its PR not; a close and a reopen stored.
- The touched route: an `issues` event for a concept's issue refreshes that concept's facts.

## Risks

- **What merging publishes:** the new chip and tab content on every concept page and the Concepts
  list, and a button that closes a GitHub issue for any workspace member. Roll back by reverting the
  feature PR: no migration, no stored shape changes, and an issue closed meanwhile is reopened by
  hand on GitHub.
- **GitHub budget:** one more read per merged concept per sync run; a workspace holds a handful of
  concepts.
- The locked laws: none touched. N-PRODUCT-17 (no secret reaches the browser) bears on the button:
  the installation token stays on the server, as for the approval label.

## Acceptance criteria

- A concept whose concept PR merged, whose every area names a PRD, and each of whose PRDs is stored
  at `shipped` or `retro` reads `shipped` on its page and on its Concepts list card.
- A merged concept with an area that names no PRD, or a PRD at any other stage, still reads `in the
  inbox` while its issue is open.
- A workspace member pressing **Mark done** on a merged concept closes its GitHub issue as completed,
  with the comment naming them, and the page then reads `shipped`; **Reopen** reopens it and the page
  reads `in the inbox` again.
- A concept whose issue is closed on GitHub reads `shipped` within one sync run, and at once when the
  `issues` event reaches the touched route; reopened, it reads `in the inbox` again the same way.
- A concept in review never reads `shipped`, whatever its issue's state, and shows no Mark done.
- A caller who is not a member of the concept's workspace is refused, and the issue is unchanged.
- The Areas tab shows each named PRD's stage beside its link, `syncing` when none is stored, and, on
  a concept shipped by a person, `not built` for each area without a shipped PRD.
- The Concepts list card shows `<m> of <n> have a PRD`, `<k> of <n> shipped` and its date, each its own piece.
- A concept with no stored facts, or whose pull request is unread or missing, reads `state unknown`
  (BR-PRODUCT-93).
