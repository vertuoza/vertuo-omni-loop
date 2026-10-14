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
Proof, Pitch, Retro). Rendered per request as the signed-in person, so row-level security decides
what each read returns (`apps/galaxy/src/dossier/page/DossierRoute.tsx`). It sits inside the app
shell (`apps/galaxy/app/prd/layout.tsx`), a shared screen of its own, `app-shell`, with the bell its
own `notifications`: their files are in `reads` here. The PRD's own text the page shows (its title,
its spec, its plan) is content, marked `data-content` in the mockup.

## Regions

- **The head, one box in three rows** (`dossier/page/DossierPage.tsx`, `StageHeader.tsx`): the
  title with its actions (the stage's one button; beside a button that copies an `/omni:` line
  a runner may run, Send to terminal, which opens a picker of the runners the viewer may send to and
  says `Queued for <target>` once sent, shown only when the workspace has one; Copy link, Delete
  draft for a draft's opener); the
  facts strip (Stage, Approval for a PRD born on the server, Repo or Repos, On GitHub with when
  GitHub was last read, Opened, with the opener's face); then the tabs. From 900 × 700 px the box
  is pinned while the page scrolls (`PinnedHead.tsx`).
- **The approve screen,** under the head, for a viewer allowed to approve while the PRD waits or
  drifted: each changed file's diff, the spec's Problem and Solution, then Approve.
- **The pane** of the tab shown (`?tab=`, its version by `?v=`): the before/after page framed on its
  sandboxed route; the spec and the plan rendered from Markdown with raw HTML off; Questions with the
  rounds that shaped it and an `N to answer` badge; Outbox (`OutboxPane.tsx`), PR care
  (`CarePane.tsx`), Proof, Pitch, Retro, Rewind; each artifact tab with a version picker.
- **The Retro tab's echo row** (concept #1964), in anti-loop mode (`anti-loop-mode`): under the
  replay, where an earlier PRD had the same finding it keeps its own lane behind `⋯ earlier · PRD
  <n>`; the finding (`repeated-red:check`, its title, its retro issue) carries an Echo: Seen before
  (the PRD and its issue), Proposed (how many times), KB rules, `generated:`, Guard; then **Open the
  lesson** and Not the same cause. A PRD with no human review says `0 human review threads`.
- **The Rewind tab** (concept #1964), in anti-loop mode, PM first: plain words ("Lesson repeated:
  regenerate types, first seen in 1322"; Lesson carried), then the spec's claims; the file questions
  folded behind "For the agents · <n> questions", each a file, its slice and why (outside its
  territory), with Ask <slice>'s agent.
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
  when the feature PR merges."
- **Rewind** (concept #1964): for the PM (plain words and claims); for the agents (the questions
  unfolded, "Questions, never deletions."); Nothing to ask (a PRD whose files all answer to a claim:
  "52 files · 0 questions", PRD 1904); This spec numbers no criteria ("So the rewind asks."); No
  rewind yet, before the feature PR merges ("Runs when the feature PR merges.").
- **Retro with an echo** (concept #1964): the echo row above; a PRD whose findings echo nothing shows
  the retro as before.
- **Demo:** the demo dossier in development, without a database.
- **A fix's id** at `/prd/<id>` is sent to `/visual/<id>` or `/bugs/<id>`, the query kept.
- **After a draft is deleted:** `?deleted=1` says it is gone.

## Words

Tabs, in order: Questions, Before/after, Spec, Plan, User voice, Outbox, PR care, Proof, Pitch,
Retro (`dossier/page/view.ts`), then Rewind (concept #1964). Retro's echo: Echo, Seen before,
Proposed, KB rules, Guard, Open the lesson, Not the same cause, 0 human review threads. Rewind:
Lesson repeated, Lesson carried, Claims, For the agents, Nothing to ask, No rewind yet. Actions: Copy link, Delete draft, Approve, Send to terminal (its picker: Any runner, each fleet,
each runner, Send; then `Queued for <target>` and View job). Facts: Stage, Approval,
Repo, Repos, On GitHub, Opened.

## Refusals

- The page tells nobody whether a link they may not read is real: a dossier of another workspace
  and one that never was get the same Not found (`app/prd/[id]/not-found.tsx`).
- The tabs and the version picker are links and a GET form, so the page works before any script
  runs (`DossierPage.tsx`).
- The Rewind tab asks and never proposes a deletion (concept #1964); every number on the Retro and
  Rewind tabs is copied from evidence.
- On the Retro and Rewind tabs errors stay red and the primary keeps its yellow (`anti-loop-mode`).
- It is the one app page that does not use the full width (`apps/galaxy/src/page-width.test.ts`).

## Open questions

- Which is the page's one primary action? The stage's button, Approve and an outbox answer can each
  be the next step; the code does not rank them.
- The page holds a dozen tabs and as many panes, each with its own states: is it one screen of the
  library, or one per tab?
- What the play dock is for on a reading page is not said in the page's copy.
- The PRD page is narrower than the other app pages on purpose (`page-width.test.ts`): what width,
  and why, is not written next to the rule.

- Concept #1964: matching a finding to an earlier one by cause is a model judgement, and developers
  distrust a verdict that does not cite the lines it read: how the echo and each Rewind claim show
  their lines is not drawn.
- Concept #1964: only 10 of 171 shipped PRDs have a retro; whether retros are backfilled, and what
  Retro and Rewind say on a PRD without one, is open.
- Concept #1964: does the PRD page enter anti-loop mode on the Retro and Rewind tabs alone, with the
  wipe at each tab switch, or stay in it? Not settled.
- Concept #1964: the Rewind tab's place: after Retro, as drawn, or replacing it (the Visionary's
  round-1 remix) is not decided; and the Rewind tab's claim mapping (from the plan's territory table,
  the Skeptic) is not built.

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
- /omni:brainstorm, PRD 1915: .omni-loop/delivery/shipped/1915-agent-words-website/before-after.html
- /omni:think-big, concept #1964, crowned M on 2026-10-14: .omni-loop/delivery/inbox/concepts/1964-anti-loop/vision.html
