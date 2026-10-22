---
screen: waiting-board
status: draft
kind: page
mock: waiting-board.html
implements: [apps/galaxy/app/app/waiting/page.tsx, apps/galaxy/src/waiting-board/WaitingBoard.tsx, apps/galaxy/src/waiting-board/waiting-board.css, apps/galaxy/src/waiting-board/board.ts]
reads: [apps/galaxy/src/waiting-board/load.ts, apps/galaxy/src/stages/sync/waits.ts, apps/galaxy/src/people/, apps/galaxy/src/nav/SectionTabs.tsx, apps/galaxy/src/product-filter/, apps/galaxy/src/nav/]
routes: [/app/waiting]
supersedes: null
---

## Purpose

Every PRD and pull request of the workspace that waits on a person to ship (a review, a merge, a ◆
approval, outbox questions, a locked law's owner), since when, and whose turn it is (PRD 2377). A
member reads it to see where delivery is stuck on people, which of their PRDs to unblock, and what
waits on them.

## Regions

- **The head:** `Waiting`, and how many wait on a person (`7 wait on a person`).
- **The tabs** (`SectionTabs`, `?tab=`): Workspace (the default), My PRDs, My reviews with its count.
- **The stale line,** only when a tracked repository was last synced more than 30 minutes ago:
  `<owner>/<repo> last synced <n> min ago.`
- **The table,** oldest first, four columns:
  - **PRD:** `PRD <n> · <title>` linking to its page, or `Bug fix #<n>` / `Visual update #<n>`; under
    it, the pull request (`feature #<n>`) linking to GitHub.
  - **Waits on:** `review`, `merge`, `approval`, `outbox · <n> questions`, `law <id>`.
  - **Whose turn:** a face per login (the people directory), a team by its name, or `any approver` /
    `anyone who can merge`.
  - **For:** working days (Monday to Friday, UTC), `today` under one; red past
    `limits.escalationWorkingDays`.
- The product filter, as on the other Work pages.

## States

- **Workspace empty:** `Nothing waits on a person.`
- **My PRDs empty:** `None of your PRDs waits on anyone.`
- **My reviews empty:** `Nothing waits on you.`
- **Unreadable:** the page says it could not load, as Engineering does.
- **Signed out / no workspace:** the app shell's sign-in card or notice.
- **Phone, below 900 px:** the table becomes one card per row, the four cells stacked.

## Words

Waiting · wait on a person · Workspace · My PRDs · My reviews · last synced · min ago · PRD · Waits on
· Whose turn · For · review · merge · approval · outbox · questions · law · any approver · anyone who
can merge · today · day · days · Bug fix · Visual update · Nothing waits on a person. · None of your
PRDs waits on anyone. · Nothing waits on you.

## Refusals

- It acts on nothing: no approve, merge, answer or nudge button. A turn is a name shown.
- A team is never counted as yours, in My reviews or anywhere.
- No colour of its own: the red age is `--ask-red`, every colour a token of `src/ask/theme-tokens.ts`.

## Open questions

- Its primary action is marked on the My reviews tab; is a reading page meant to carry one?
- The phone's card layout is described, not drawn.
- The new 16 px `menu-waiting` sprite is not drawn yet.

## Source

- /omni:brainstorm, PRD 2377: .omni-loop/delivery/shipped/2377-waiting-board/before-after.html
