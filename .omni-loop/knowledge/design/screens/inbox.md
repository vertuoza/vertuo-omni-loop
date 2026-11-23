---
screen: inbox
status: draft
kind: page
mock: inbox.html
implements: [apps/galaxy/src/ask/page/WorkspaceHistory.tsx, apps/galaxy/src/ask/page/history.css, apps/galaxy/app/app/inbox/page.tsx, apps/galaxy/app/app/inbox/done/page.tsx, apps/galaxy/app/app/inbox/workspace/page.tsx, apps/galaxy/src/inbox/InboxScreen.tsx, apps/galaxy/src/inbox/InboxScreen.header.tsx, apps/galaxy/src/inbox/InboxScreen.open.tsx, apps/galaxy/src/inbox/InboxScreen.panel.tsx, apps/galaxy/src/inbox/InboxScreen.done.tsx, apps/galaxy/src/inbox/InboxScreen.signin.tsx, apps/galaxy/src/inbox/inbox.css]
reads: [apps/galaxy/src/inbox/inbox.ts, apps/galaxy/src/inbox/InboxScreen.model.ts, apps/galaxy/src/inbox/keys.ts, apps/galaxy/src/inbox/inbox.controller.ts, apps/galaxy/src/waiting/, apps/galaxy/src/ask/page/AskQuestion.tsx, apps/galaxy/src/ask/page/RoundForm.tsx, apps/galaxy/src/waiting-board/, apps/galaxy/src/nav/]
routes: [/app/inbox, /app/inbox/done, /app/inbox/workspace]
supersedes: questions
---

## Purpose

Everything that waits on the person, in one place, opening on their Questions: the first question that
blocks an agent is open and ready to answer the moment they click Inbox.

## Regions

- The header: the title Inbox, `<n> wait on you`, and the Alerts button (Desktop alerts, Chime).
- The tabs: Open with its count, Done, Workspace.
- On Open, the kind chips: All, Questions, Approvals, Outbox, Reviews, Shared with me.
- The list, in sections shown only when they hold an item, oldest first: Questions, Your decisions,
  Your reviews, then Anyone can answer and Updates, marked not counted.
- A row: its kind's sprite, a context line, the ask in one or two lines, its age (a late one in red) and
  up to two chips (Blocking, Shared, Approval, human-action, Review, Merge, Anyone).
- From 1280 px, the panel beside the list: the open item whole; for a question, today's answer form,
  its options, Other and the one primary action, Send answer.
- Below 1280 px: the list full width; a question opens in place, its options and Send at least 44 px tall.

- The Done tab (visual update #3169): a 200 px sidebar of the categories on the left, `All` first, each a
  link with its count under the other filters, the chosen one marked; beside it one line of the search,
  More filters (Repository, PRD, Skill, Asked by, Answered by, each only when it offers a choice, and
  Apply) and the count (`<n> questions`, or `<n> of <all> · Clear filters`); then the rows grouped under
  day titles (Today, Yesterday, then the date), each row the context line, the question, `→ the answer`,
  who asked and answered, the age and the category badge. Below 900 px the categories become one line
  that scrolls.

## States

- Landing: the first question open; with none, the first decision.
- Answered: the row reads ✓ Answered, leaves, and the next question opens.
- Zero: the check sprite at 3×, `Nothing waits on you.`, and a link to the Workspace tab.
- A part that could not be read: `<Part> couldn't be read — retrying.` in its section, its last rows kept.
- Signed out: the Inbox's own sign-in card; signing in comes back to /app (item s5-05).

## Words

`Inbox`, `<n> wait on you`, `Nothing waits on you.`, `Open`, `Done`, `Workspace`, `Questions`,
`Your decisions`, `Your reviews`, `Anyone can answer`, `Updates`, `not counted`, `Blocking`,
`Send answer`, `Open full page`, `Answer it to clear it`, `Alerts`.

## Refusals

- A pick alone never sends: only Send or ⌘↵ does, since an answer never changes (BR-PRODUCT-12, BL-ASK-1).
- The page approves, answers on a pull request and merges nothing itself: it links to where that is done.
- `e` never clears a wait; only an Update.
- Runner jobs anyone can answer and Updates never count in the Inbox's number.

## Open questions

- The Done tab still lists rounds that are waiting; whether they leave Done is a logic change, not a visual one.
- This screen's mockup draws the Open tab; the Done tab's is the pick in `.omni-loop/delivery/visual/3169-done-tab-sidebar/before-after.html`.

- The Done tab's rows for approvals and merges: their exact words.
- The `menu-inbox` sprite, pending its owner's approval.

## Source

/omni:brainstorm, PRD omni-loop-22: its before/after page, on the PRD's page (omni dossier get omni-loop-22 before-after)
/omni:visual-fix #3169, pick A by @pierrederval on 2026-11-23: .omni-loop/delivery/visual/3169-done-tab-sidebar/before-after.html
