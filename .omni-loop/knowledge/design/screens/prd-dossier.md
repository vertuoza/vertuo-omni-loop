---
screen: prd-dossier
status: draft
mock: null
implements: ["apps/galaxy/app/prd/[id]/", apps/galaxy/src/dossier/page/]
routes: [/prd/<id>]
supersedes: null
---

## Purpose

The page to share for one PRD: its stage on top, then a tab per artifact (the before/after page, the
spec, the plan, the User voice) and the tabs where people act on it (Questions, Outbox, PR care,
Proof, Pitch, Retro). Rendered per request as the signed-in person, so row-level security decides
what each read returns (`apps/galaxy/src/dossier/page/DossierRoute.tsx`).

## Regions

- **The head, one box in three rows** (`dossier/page/DossierPage.tsx`, `StageHeader.tsx`): the
  title with its actions (the stage's one button, Copy link, Delete draft for a draft's opener); the
  facts strip (Stage, Approval for a PRD born on the server, Repo or Repos, On GitHub with when
  GitHub was last read, Opened, with the opener's face); then the tabs. From 900 × 700 px the box
  is pinned while the page scrolls (`PinnedHead.tsx`).
- **The approve screen,** under the head, for a viewer allowed to approve while the PRD waits or
  drifted: each changed file's diff, the spec's Problem and Solution, then Approve.
- **The pane** of the tab shown (`?tab=`, its version by `?v=`): the before/after page framed on its
  sandboxed route; the spec and the plan rendered from Markdown with raw HTML off; Questions with the
  rounds that shaped it and an `N to answer` badge; Outbox (`OutboxPane.tsx`), PR care
  (`CarePane.tsx`), Proof, Pitch, Retro; each artifact tab with a version picker.
- **The play dock** in the page's corner when Claude works on the dossier (`LiveRefresh`).

## States

- **Signed out:** a sign-in card, "Sign in to read this PRD", that comes back here
  (`DossierSignIn.tsx`).
- **Not a member, or no such PRD:** "Not found", in the same words either way, with Switch account
  (`app/prd/[id]/not-found.tsx`).
- **Loading:** the dossier's skeleton inside the layout's frame (`app/prd/[id]/loading.tsx`); then
  the page streams, the parts only GitHub knows saying they are being read.
- **An empty artifact tab:** "The spec has no version yet." and the like, read muted; Outbox empty:
  "No decision yet: the outbox fills while the PRD is built." Retro empty: "The retro is written
  when the feature PR merges."
- **Demo:** the demo dossier in development, without a database.
- **A fix's id** at `/prd/<id>` is sent to `/visual/<id>` or `/bugs/<id>`, the query kept.
- **After a draft is deleted:** `?deleted=1` says it is gone.

## Words

Tabs, in order: Questions, Before/after, Spec, Plan, User voice, Outbox, PR care, Proof, Pitch,
Retro (`dossier/page/view.ts`). Actions: Copy link, Delete draft, Approve. Facts: Stage, Approval,
Repo, Repos, On GitHub, Opened.

## Refusals

- The page tells nobody whether a link they may not read is real: a dossier of another workspace
  and one that never was get the same Not found (`app/prd/[id]/not-found.tsx`).
- The tabs and the version picker are links and a GET form, so the page works before any script
  runs (`DossierPage.tsx`).
- It is the one app page that does not use the full width (`apps/galaxy/src/page-width.test.ts`).

## Open questions

- Which is the page's one primary action? The stage's button, Approve and an outbox answer can each
  be the next step; the code does not rank them.
- The page holds a dozen tabs and as many panes, each with its own states: is it one screen of the
  library, or one per tab?
- What the play dock is for on a reading page is not said in the page's copy.
- The PRD page is narrower than the other app pages on purpose (`page-width.test.ts`): what width,
  and why, is not written next to the rule.

## Source

- apps/galaxy/app/prd/[id]/page.tsx@b884e26
- apps/galaxy/app/prd/[id]/not-found.tsx@f848a24
- apps/galaxy/app/prd/[id]/loading.tsx@4e5224b
- apps/galaxy/src/dossier/page/DossierRoute.tsx@29a0a21
- apps/galaxy/src/dossier/page/DossierPage.tsx@03dacd1
- apps/galaxy/src/dossier/page/DossierSignIn.tsx@d3f339b
- apps/galaxy/src/dossier/page/view.ts@84c8451
- apps/galaxy/src/page-width.test.ts@7302b0d
- /omni:invade 2026-10-10 (written by hand from its screen-library step, PRD 1407 s9)
