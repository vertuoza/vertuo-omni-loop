---
screen: prd-dossier
status: draft
mock: prd-dossier.html
implements: ["apps/galaxy/app/prd/[id]/page.tsx", "apps/galaxy/app/prd/[id]/not-found.tsx", "apps/galaxy/app/prd/[id]/loading.tsx", "apps/galaxy/src/dossier/page/*.tsx", apps/galaxy/src/dossier/page/dossier.css, apps/galaxy/src/dossier/page/view.ts, apps/galaxy/src/dossier/page/stage.ts, apps/galaxy/src/runners/send/SendToTerminal.tsx]
reads: ["apps/galaxy/app/prd/[id]/", apps/galaxy/src/dossier/page/, apps/galaxy/app/prd/layout.tsx, apps/galaxy/src/nav/AppShell.tsx, apps/galaxy/src/nav/Sidebar.tsx, apps/galaxy/src/nav/AppBar.tsx, apps/galaxy/src/nav/BrandLogo.tsx, apps/galaxy/src/nav/UserMenu.tsx, apps/galaxy/src/nav/sidebar.ts, apps/galaxy/src/nav/Bell.tsx, apps/galaxy/src/nav/bell.ts]
routes: [/prd/<id>]
supersedes: null
---

## Purpose

The page to share for one PRD: its stage on top, then a tab per artifact (the before/after page, the
spec, the plan, the User voice) and the tabs where people act on it (Questions, Outbox, PR care,
Proof, Launch, Retro). Rendered per request as the signed-in person, so row-level security decides
what each read returns (`apps/galaxy/src/dossier/page/DossierRoute.tsx`). It sits inside the app
shell (`apps/galaxy/app/prd/layout.tsx`), a shared screen of its own, `app-shell`, with the bell its
own `notifications`: their files are in `reads` here. The PRD's own text the page shows (its title,
its spec, its plan) is content, marked `data-content` in the mockup.

## Regions

- **The head, one box in three rows** (`dossier/page/DossierPage.tsx`, `StageHeader.tsx`): the
  title with its actions (the stage's one button: while the feature PR's outbox has open high
  questions, Answer the outbox, then, once each has a reply the kit counts, Fix with answers, which
  copies `/omni:yolo-fix <n>` and names the answers under it as `Fixes with 1: A · 4: B` (PRD 2223); beside a button that copies an `/omni:` line
  a runner may run, Send to terminal, which opens a picker of the runners the viewer may send to and
  says `Queued for <target>` once sent, shown only when the workspace has one; Copy link, Delete
  draft for a draft's opener); the
  facts strip (Stage, Approval for a PRD born on the server, Main for a shipped PRD (PRD 2410: Watching · n days left,
  Clean, Broke main or Could not check), Repo or Repos, On GitHub with when
  GitHub was last read, Opened, with the opener's face); then the tabs. From 900 × 700 px the box
  is pinned while the page scrolls (`PinnedHead.tsx`).
- **The approve screen,** under the head, for a viewer allowed to approve while the PRD waits or
  drifted: each changed file's diff, the spec's Problem and Solution, then Approve.
- **The pane** of the tab shown (`?tab=`, its version by `?v=`): the before/after page framed on its
  sandboxed route; the spec and the plan rendered from Markdown with raw HTML off; Questions with the
  rounds that shaped it and an `N to answer` badge; Outbox (`OutboxPane.tsx`), PR care
  (`CarePane.tsx`), Proof, Launch (its own screen, `launch`), Main (PRD 2410: on a shipped PRD, what broke main, each with
  its link, then the rewind's findings, each a card with its check, where it started, its fix, and
  Approve or Reject), Retro; each artifact tab with a version picker.
- **The play dock** in the page's corner when the agent works on the dossier, saying "▶ Play while the agent works" (`LiveRefresh`).

## States

- **Signed out:** a sign-in card, "Sign in to read this PRD", that comes back here
  (`DossierSignIn.tsx`).
- **Not a member, or no such PRD:** "Not found", in the same words either way, with Switch account
  (`app/prd/[id]/not-found.tsx`).
- **Loading:** the dossier's skeleton inside the layout's frame (`app/prd/[id]/loading.tsx`); then
  the page streams, the parts only GitHub knows saying they are being read.
- **An empty artifact tab:** "The spec has no version yet." and the like, read muted; Outbox empty:
  "No decision yet: the outbox fills while the PRD is built." Retro empty: "The retro is written
  when the feature PR merges." Main with no rewind yet (PRD 2410): the breaks, then "No rewind yet"
  with the `/omni:rewind <n>` line; a failed one says why.
- **Demo:** the demo dossier in development, without a database.
- **A fix's id** at `/prd/<id>` is sent to `/visual/<id>` or `/bugs/<id>`, the query kept.
- **After a draft is deleted:** `?deleted=1` says it is gone.

## Words

Tabs, in order: Questions, Before/after, Spec, Plan, User voice, Outbox, PR care, Proof, Launch,
Main, Retro (`dossier/page/view.ts`; Main from PRD 2410). Actions: Copy link, Delete draft, Approve, Send to terminal (its picker: Any runner, each fleet,
each runner, Send; then `Queued for <target>` and View job). Facts: Stage, Approval, Main,
Repo, Repos, On GitHub, Opened. Main's words (PRD 2410): Watching · n days left, Clean, Broke main,
Could not check; on a finding: Approve, Reject.

## Refusals

- The page tells nobody whether a link they may not read is real: a dossier of another workspace
  and one that never was get the same Not found (`app/prd/[id]/not-found.tsx`).
- The tabs and the version picker are links and a GET form, so the page works before any script
  runs (`DossierPage.tsx`).
- It is the one app page that does not use the full width (`apps/galaxy/src/page-width.test.ts`).

## Open questions

- Where the Main tab sits among the tabs (PRD 2410 draws it before Retro), and whether a Clean PRD
  shows it at all.

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
- /omni:brainstorm, PRD 1830: .omni-loop/delivery/shipped/1830-runners/before-after.html (Send to terminal)
- /omni:brainstorm, PRD 2011: .omni-loop/delivery/shipped/2011-product-records/before-after.html (a product PRD's Outbox tab reads the server's rows)
- /omni:brainstorm, PRD 1915: .omni-loop/delivery/shipped/1915-agent-words-website/before-after.html
- /omni:think-big, concept #2024, crowned L on 2026-10-15: .omni-loop/delivery/inbox/concepts/2024-launch/vision.html (Launch replaces Pitch)
- /omni:brainstorm, PRD 2223: .omni-loop/delivery/shipped/2223-outbox-waiting/before-after.html
- /omni:brainstorm, PRD 2410: .omni-loop/delivery/inbox/2410-broke-main/before-after.html
