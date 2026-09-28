---
prd: 384
title: The PRD page is easier to use
blocked-by: none
spec: file
---

# The PRD page is easier to use

**Date:** 2026-09-28 · **PRD:** #384 · **Touches:** the dossier page in the galaxy app
(`apps/galaxy/app/prd/[id]`, `apps/galaxy/src/dossier/page/`) and the single-question page
(`apps/galaxy/src/ask/page/AskQuestion.tsx`). No migration, no change to the kit.

## Problem

The PRD page (`/prd/<id>`, the dossier) is where a person follows a PRD being brainstormed and
answers what Claude asks. Used for real, it gets in the way:

- **The tabs are in the wrong order.** They read Before/after · Spec · Plan · Questions, and the page
  opens on Before/after. A PRD is made in the opposite order: the questions come first, then the
  before/after, the spec and the plan.
- **An answered question still lists every option.** The Questions tab shows every option a question
  offered, the chosen one only tagged "chosen", so a long brainstorm reads as a wall of choices
  nobody made.
- **Answering is a rabbit hole.** "Open the question" goes to `/ask/q/<round>`. Once answered there,
  the person stays on that page, and has to find their way back to the PRD by hand.
- **Even a one-click question needs its own page.** The Questions tab is read-only: every answer,
  however small, means opening the question.
- **New questions only show after a reload.** The page is rendered once on the server and never
  reads again, so during a brainstorm the person reloads by hand to see the next question, or a new
  version of the spec.

## Solution

### 1. Tabs in the order a PRD is made

- The tabs read **Questions · Before/after · Spec · Plan**, in that order, with their badges as today
  (`11/12 answered`, `v3`).
- The page opens on **Questions**, and the default tab leaves `?tab=` out of the URL, as today.
  A dossier with no question yet opens on **Before/after** instead, so nobody lands on an empty tab.
- Every existing link keeps working: `?tab=before-after`, `?tab=spec`, `?tab=plan` and
  `?tab=questions` open the tab they name.
- Outbox and Retro tabs are not part of this PRD; they come with the stage header (the next PRD).

### 2. An answered question shows its answer only

On the Questions tab:

- An **answered** question shows the question, then only the option or options that were chosen,
  each with its description, then who answered, after how long and where (the outcome line, as
  today). An answer that matches no option (an "Other" text) shows as the text written.
- An **open** question shows every option, as today.
- A question **moved to the terminal** shows the question and "moved to the terminal, no answer
  recorded", with no option list.

### 3. Back to where you came from

- The Questions tab's link to a question carries where it came from: `/ask/q/<round>?from=<dossier id>`.
- Once the person answers on `/ask/q/<round>` (sent, and the next read says it is answered), the page
  goes to **`/prd/<dossier id>?tab=questions#<round id>`** of the next round still open, or to the
  Questions tab alone when none is left.
- Opened with no `from` (a shared link, a notification), it goes to the ask page of that question's
  session, **`/ask/<session id>`**, where the terminal's next question shows.
- A `from` that is not a dossier id is ignored (it is treated as no `from`), so the parameter can
  never send the person to another site.
- Someone else answering first changes nothing: the page shows "Already answered by …" as today and
  does not move.

### 4. Answer a quick question on the list

- A round is **quick** when it is open, it holds exactly one question, that question is single
  choice (`multiSelect` false), and none of its options has a preview. Every other open round keeps
  its **Open** link and nothing else.
- A quick round, for a person **who may answer it**, shows its options as buttons on the list. One
  click sends that option as the answer, through the same path as the question page
  (`sendAnswers`, `answered_via: 'page'`). There is no "Other" on the list; the Open link stays for
  it.
- **Who may answer** is the same rule as the question page: the round's session owner, or a member
  it is shared with. It is decided on the server when the page is read, never trusted from the
  browser; the database's own rule still refuses anyone else.
- A person who may not answer it sees the options as today and "Waiting for <owner>".
- A round whose time is up (it moves to the terminal after the hook's wait) shows no buttons.
- **After the click:** the round shows as answered in place (part 2), and the page scrolls to the
  next open round. If someone came first, the round shows "Already answered by …"; if the send
  fails, the round says "Your answer did not go through" and keeps its buttons.
- The page still works with no script: the list is rendered on the server, and a quick round with
  no script shows its Open link.

### 5. The page refreshes itself

- While the tab is visible, every 2 seconds, the page asks the database one small question: how many
  rounds, how many answered, and the latest version number of each artifact. It reuses
  `src/ask/page/poll.ts`: paused while the tab is hidden, read at once when it shows, never two
  reads at a time.
- Only when that answer changes does the page re-render from the server, in place
  (`router.refresh()`): the tab, the scroll position and the version picked stay as they are.
- A version picked by hand (`?v=2`) stays shown; only its tab's badge moves to the new latest. With
  no `?v=`, the tab shows the new latest version.
- A read that fails does nothing visible and tries again at the next tick; three failures in a row
  show "Cannot reach the server. Trying again every few seconds." until a read works.
- Demo mode (no database) does not poll.

## Decisions

- **Two PRDs, not one.** The stage header, "PRD #n" as a link to its issue, an "Approve spec" link to
  the phase-0 PR, and the Outbox and Retro tabs need data the page does not keep today (no issue,
  PR, stage, outbox or retro is stored). They are the next PRD; this one needs no new data.
- **Questions is the default tab**, except for a dossier with no question.
- **`from` names a dossier, not a URL**, so the question page builds the way back itself.
- **Quick means one single-choice question with no preview.** Multi-select, several questions,
  previews and free text keep the full question page.
- **Polling, not Realtime,** as the ask pages already do (PRD 142): one small read every 2 s while
  visible, and a full server render only when something changed.

## User stories

1. As the person answering a brainstorm, I open the PRD page and land on its questions.
2. As that person, I answer a pick-one question with one click, without leaving the list.
3. As that person, I answer a bigger question on its own page, and I am brought back to the list, at
   the next open question.
4. As a reader of a finished PRD, I read each question with the answer it got, not every option it
   offered.
5. As anyone following a PRD, I see a new question, an answer or a new spec version appear without
   reloading.

## Scope

**In:** the tab order and default tab; the answered, open and moved shapes of a question on the
Questions tab; the `from` parameter and the way back from `/ask/q/<round>`; one-click answers for
quick rounds on the list, with the answer rule decided on the server; the 2-second change check and
in-place refresh on `/prd/<id>`.

**Out:** the stage header, links to the issue and the phase-0 PR, Outbox and Retro tabs (the next
PRD); answering multi-question, multi-select or preview rounds on the list; any change to the kit,
`omni dossier push` or the database schema; the `/prd` history list.

## Test seams

Following `omni kb show testing`: Vitest, beside the code, no call to GitHub or Supabase.

- **Pure functions in `src/dossier/page/view.ts`:** the tab order and the default tab (with and
  without questions, every `?tab=` value); the answered / open / moved shape of a question (chosen
  options only, an "Other" answer, a multi-select answer); `isQuick(round)` for each rule of part 4;
  the way-back target (next open round, none left, no `from`, a `from` that is not a dossier id).
- **The change check:** a pure `signature(rows)` compared tick to tick; tested with rounds added,
  answered, and a new artifact version, and with nothing changed.
- **Rendering** (`render.test.ts`, `renderToStaticMarkup`): the tab bar in order; an answered round
  with no unchosen option in the markup; a quick round with buttons for a person who may answer, and
  "Waiting for …" for one who may not; a non-quick round with its Open link only.
- **The route** (`page.test.ts`, with `store.fake.ts`): the default tab with and without rounds; the
  may-answer flag decided on the server from the session's owner and shares.
- **The question page:** the redirect target after a send, from the pure function above; the
  component's navigation is a thin call to it.

## Risks

Following `omni kb show releasing`: a merge to `main` touches no migration and no kit file, so it
publishes only the galaxy app, the next time it deploys. Rolling back is reverting the merge.

- **Load:** every open PRD page makes one small read every 2 s while visible. The read returns
  counts, not rows; a full render happens only on change.
- **A wrong answer in one click:** the buttons send at once. They show only for quick rounds and for
  a person who may answer, as on the question page; the answer is final there too.
- **Old links** with `?tab=` keep working; links with no `?tab=` now open Questions instead of
  Before/after.

## Acceptance criteria

1. On `/prd/<id>`, the tabs read Questions, Before/after, Spec, Plan, in that order.
2. A dossier with at least one question opens on Questions with no `?tab=` in the URL; a dossier with
   none opens on Before/after.
3. `?tab=before-after`, `?tab=spec`, `?tab=plan` and `?tab=questions` each open the tab they name.
4. An answered question on the Questions tab shows only its chosen option or options (with
   descriptions), or the free text given; no unchosen option is in the page.
5. An open question shows all of its options; a question moved to the terminal shows none.
6. "Open the question" links to `/ask/q/<round>?from=<dossier id>`.
7. After answering on `/ask/q/<round>?from=<dossier id>`, the browser is on
   `/prd/<dossier id>?tab=questions#<next open round>`, or `?tab=questions` alone when none is open.
8. After answering on `/ask/q/<round>` with no `from`, or with a `from` that is not a dossier id, the
   browser is on `/ask/<session id>`.
9. A quick open round shows one button per option to its session's owner and to a member it is
   shared with; clicking one records that option as the answer, `answered_via` page, and the round
   then shows as answered without a reload.
10. The same quick round shows no buttons and "Waiting for <owner>" to any other member; a round that
    is not quick, or whose time is up, shows no buttons.
11. With the PRD page open, a new question asked by Claude, an answer given elsewhere, or a newly
    pushed spec version shows within about 2 seconds, with no reload, on the same tab.
12. A version picked with `?v=` stays shown after a new version arrives; its badge shows the new
    latest.
13. Nothing polls while the tab is hidden, and nothing polls in demo mode.
