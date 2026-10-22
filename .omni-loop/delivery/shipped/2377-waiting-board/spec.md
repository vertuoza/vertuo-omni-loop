---
prd: 2377
title: Waiting board — which pull request waits on a person to ship, since when, and whose turn it is
blocked-by: none
spec: file
phase0: server
---

## Problem

Agents build a PRD until only a person can move it: a review, a merge, an approval, an answer, a law's
owner. Today nothing shows those waits together.

- **`omni next` knows, one repository at a time, and forgets.** `decideNext`
  (`kit/lib/next/decide.ts:167-329`) parks a PRD with a reason (`waits on a reviewer: the phase-0 PR
  is open`, `waits on a person: the feature PR is ready to merge`), but only in the terminal that
  asks, for one repository, with no date and no name.
- **The bell is one person's, and only for some waits.** It lists questions, ◆ approvals and outbox
  items asked of the person (PRD 499, 1322, 1794). A pull request waiting for a review or a merge is
  in no bell, and nobody sees what waits on someone else.
- **Engineering counts pull requests, not waits.** `/app/engineering` (PRD 612) stores every pull
  request of the workspace's repositories, with its draft flag, labels and reviewers, but not who was
  asked to review it, when it was marked ready, or whether a review approved it.
- **Nothing says since when.** The escalation record (PRD 1794) dates a held law or item, but only on
  a repository that names delegates, and only for those two kinds.

So a member who wants to know "what is stuck on people, on whom, for how long", or "what should I
review now", opens PRD pages one by one.

## Solution

A new page, **Waiting**, on the Omni app (`/app/waiting`), fed by the stages sync, which records each
thing that waits on a person once, with whose turn it is and since when. The page makes no GitHub
request.

### 1. What counts as a wait

One row per wait. A PRD or a pull request has at most one open row per kind.

| kind | when | whose turn | since |
|---|---|---|---|
| `approval` | a ◆ PRD (`phase0: server`) is not yet approved on its page | the approvers of its product, as the approvals read gives them | when the PRD reached stage `prd` |
| `outbox` | a feature PR is a draft and its PRD has an open `high` or `human-action` outbox item | the PRD's owner (who opened its dossier); once its escalation record has escalated, also the people that record asks | when the first such item was seen |
| `law` | an open pull request into the default branch whose `law-locked` check is red | each owner and delegate the law names (`laws.owners`) | the escalation record's first-held time; with no record, the first sync that saw it |
| `review` | an open, ready (not draft) pull request into the default branch that no review has approved and whose latest review did not ask for changes | its requested reviewers (logins and `org/team`s); with none requested, "any approver" | when it was last marked ready for review, or last asked for review again; with neither, when it was opened |
| `merge` | an open, ready pull request into the default branch that a review approved and whose checks are green | the PRD's owner; on a pull request with no PRD, whoever approved it; with neither, "anyone who can merge" | when it was approved |

- **The pull requests counted:** phase-0 PRs, feature PRs, and the pull requests of a bug fix or a
  visual update (`labels.bug`, `labels.visual`). Sub-PRs never count: agents merge them.
- **A bug fix or visual update** has no PRD: its row names its pull request, and it shows in
  Workspace and My reviews, never in My PRDs.
- **Changes asked:** a pull request whose latest review asked for changes waits on its author, not a
  reviewer: it has no open row until a review is asked again.
- A wait ends when the sync no longer sees it: the pull request merged or closed, the review given,
  the item answered, the PRD approved.

### 2. The record: `waits`

A new table, one row per wait, written by the stages sync only, read by the members of its workspace.

| column | holds |
|---|---|
| `workspace_id`, `repo` | the tracked repository |
| `prd` | the PRD's number; null for a bug fix or visual update |
| `pr` | the pull request's number; null for an `approval` |
| `kind` | `approval`, `outbox`, `law`, `review` or `merge` |
| `turn` | whose turn: GitHub logins and `org/team`s, empty for "any approver" / "anyone who can merge" |
| `since` | when the wait began (§1), written once and never moved |
| `seen_at` | the last sync that saw it |
| `ended_at` | null while it waits; the first sync that no longer saw it |

- Kept like a stage: `since` is never moved, and an ended row is kept, never deleted, so the time
  spent waiting can be measured later. A wait seen again after it ended opens a new row.
- `turn` moves with what GitHub shows (a reviewer added, an escalation step).

### 3. The sync

The stages sync (PRD 587, every 15 minutes, incremental, at `background` priority through
`@omni/github`) computes the waits of each repository it reads.

- **No new request for most of it.** The pull request list it already reads carries
  `requested_reviewers` and `requested_teams`. The approvals, the stored outbox (`prd_outbox`) and the
  escalation record are already read.
- **Two reads more, only where they can change:** the reviews of a pull request, and its `law-locked`
  check, each read only for an open, ready pull request into the default branch that changed since the
  repository's last sync.
- **A failed read closes nothing.** A repository the sync skips, or a pull request whose reviews or
  check could not be read (the budget stepped back, GitHub refused), keeps its open rows as they are;
  only a successful read of a repository ends a wait.

### 4. The page: `/app/waiting`

In the sidebar's Work group, after PRDs, with its sprite. Three tabs, from the query
(`?tab=workspace|mine|reviews`, Workspace otherwise):

- **Workspace:** every open wait of the workspace.
- **My PRDs:** the waits of the PRDs whose dossier the person opened, those whose turn is theirs
  first: which of my PRDs to unblock, and who to nudge for the others.
- **My reviews:** every open wait whose turn names the person's GitHub login.

Each row: the PRD (its number and title, linking to its page) or the pull request of a bug fix or
visual update; the pull request (linking to GitHub); what it waits on, in words (`review`, `merge`,
`approval`, `outbox · 2 questions`, `law BR-PRODUCT-5`); whose turn, as faces from the people directory
(a team as its name; "any approver"); and how long, in working days (Monday to Friday, UTC), `today`
under one. A wait older than `limits.escalationWorkingDays` working days reads red. Oldest first. The
product filter applies, as on the other Work pages. Under the tabs, one line names any tracked
repository the sync last read more than 30 minutes ago.

Empty: `Nothing waits on a person.` (Workspace), `None of your PRDs waits on anyone.` (My PRDs),
`Nothing waits on you.` (My reviews).

### 5. The bell and the sidebar badge

- **The bell** gains a **Reviews** group after Approvals: one line per open `review`, `merge` or `law`
  wait whose turn names the person, oldest first, linking to the pull request. It adds to the bell's
  count. `approval` and `outbox` waits are already in the bell (PRD 1322, 1794) and are not counted
  twice.
- **The sidebar's Waiting entry** carries the My reviews count as its badge, none at 0.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | database | `waits` | no written convention: follows `prd_stages` ← `supabase/migrations/20261009090000_prd_stages.sql:17` (a table the stages sync writes, named for what it holds) |
| omni-loop | database | migration `<version>_waits.sql` | conventions › A new migration takes the next free version ← `.omni-loop/knowledge/playbook/conventions.md` |
| omni-loop | database check | `supabase/checks/waits.sql` | conventions › A new database check runs in CI ← `.omni-loop/knowledge/playbook/conventions.md` |
| omni-loop | route | `/app/waiting` | no written convention: follows `/app/engineering` ← `apps/galaxy/app/app/engineering/page.tsx:18` |
| omni-loop | nav | sidebar id `waiting` | `SidebarId` ← `apps/galaxy/src/nav/sidebar.ts:23` |
| omni-loop | module | `apps/galaxy/src/waiting-board/` | no written convention: follows `apps/galaxy/src/engineering/` (`load.ts`, a pure model, a screen); `src/waiting/` is the bell's list and keeps its name |
| omni-loop | module | `apps/galaxy/src/stages/sync/waits.ts` | no written convention: follows `apps/galaxy/src/stages/sync/approvals.ts` |
| omni-loop | type | `WaitingCounts.reviews` | ← `apps/galaxy/src/waiting/waiting.ts:72` |
| omni-loop | id | `prd: PrdNumber`, `pr: PrNumber` | conventions › IDs are branded ← `.omni-loop/knowledge/playbook/conventions.md` |

## Decisions

- **Page only, no terminal command.** The person chose it: the board lives on the Omni app.
- **Recorded by the sync, not read live.** The person asked for something that works, is easy to
  maintain and does not reach GitHub's limit quickly: one place decides waits, the page reads one
  table, and the sync's extra reads are bounded to changed, open, ready pull requests.
- **Five kinds.** Review and merge, ◆ approval, outbox questions and a locked law's owner: the person
  picked all four groups.
- **A team in the turn is never "mine" in this PRD.** Team membership is not stored today; a team row
  shows the team's name in Workspace and never counts in My reviews or the bell. Reading memberships is
  a later PRD.
- **Merge's turn is the PRD's owner.** Only a person merges (N-PRODUCT-15); the owner is the person who
  chose to build it. Fallbacks: whoever approved it, then "anyone who can merge".
- **Changes asked leave the board.** That pull request waits on its author (an agent's
  `/omni:pr-care` or its person), not on a reviewer.
- **The voice's objection, accepted.** persona:B-E DEv: "Another page I have to remember to open, and I
  won't. If it's my turn to review I live in GitHub, so a board I must visit is exactly the fluff I
  expect from this tool." Settled `accepted`: the bell counts the reviews, merges and laws whose turn
  is the person's, and the sidebar entry carries that count, so the board comes to them.
- **No proof video, no e2e:** the person said no to the proof; e2e is off here.

## User stories

- As a member, I open Waiting and see every pull request and PRD of the workspace that waits on a
  person, oldest first, with whose turn it is, so I know where delivery is stuck on people.
- As the owner of PRDs, I open My PRDs and see which of mine wait on me and which wait on someone I can
  nudge, so I know which one to take.
- As a reviewer, an approver or a law's owner, I see in the bell and in My reviews what waits on me,
  and for how long.

## Scope

In:

- the `waits` table, its row-level security and its database check;
- the sync computing and storing waits (§1, §3), with the two bounded reads;
- `/app/waiting`, its three tabs, the sidebar entry and its badge;
- the bell's Reviews group and its count.

Out:

- a terminal command; notifications by email, phone or Slack;
- team memberships (a team turn is never "mine");
- sub-PRs, and pull requests into any branch but the default one;
- charts or averages of time spent waiting (the kept rows make them possible later);
- changing who is asked: escalation (PRD 1794) is read, never changed.

## Test seams

Following `omni kb show testing`: tests beside the code, on fixtures; no test calls GitHub or Supabase.

- **`stages/sync/waits.ts`, pure:** a table of snapshots to waits: each of the five kinds; each turn
  and its fallbacks; sub-PRs, drafts with no open item and changes asked ignored; a bug fix with no
  PRD; `since` for each kind.
- **The waits store, on its fake:** `since` kept across runs, `turn` and `seen_at` moved, a wait no
  longer seen ended, a wait seen again after it ended opens a new row, a failed repository or pull
  request read ends nothing. Its select registered as a boundary for `pnpm schemas:verify`.
- **The GitHub reader, on a stubbed fetch:** requested reviewers read from the list; reviews and the
  check read only for open, ready, changed pull requests into the default branch.
- **`supabase/checks/waits.sql`,** a step of the `supabase` workflow's `check` job: a member reads
  their workspace's waits and no other's; no role but the service role writes.
- **`waiting-board/board.ts`, pure:** the three tabs (a team turn, a PRD not mine, a fix in My PRDs
  never), working days across a weekend, red past 2, the stale-repository line.
- **Render tests:** the page's three tabs, its empty and unreadable states; the sidebar badge; the
  bell's Reviews group, its count, and its unreadable line.

## Risks

Merging publishes a migration on production Supabase (`waits` and its policies), the arcade's new page,
sidebar entry and bell group, and the stages sync's new reads. Rollback: revert the merge; the sync
stops writing and the page and bell group are gone; a follow-up migration drops `waits`.

- **GitHub budget.** Two reads per open, ready, changed pull request into the default branch, at
  `background` priority: the shared client steps back first when the installation's budget runs low,
  and a read it skips ends nothing.
- **A stale board.** At most one sync (15 minutes) behind; a repository the sync has not read for 30
  minutes is named on the page.
- **A wrong turn.** A turn is only ever a name shown: nothing is approved, merged, answered or asked
  from the board.

The Legal entries it touches:

- **L-GDPR-1:** `turn` holds GitHub logins: `waits` is read only by the members of its workspace
  (row-level security, proved by `supabase/checks/waits.sql`).
- **L-GDPR-3:** a deleted account's login stays in ended rows only as the record of who was asked to
  decide, and when.
- **L-GDPR-4:** ended rows record decisions waited on, kept for good.

The locked laws it touches. Every locked law governs every path here (none says `Governs:`):

- BR-PRODUCT-3: an agent could wave its own work through the gate; the board applies no label. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-5: a feature could be merged with a question open; the board reads the outbox, never answers or adopts. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-6: a risky change nobody explained reaches main. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal acts on words a person no longer stands behind. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28: a stranger could tie themselves to a team. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the workspace's paid key. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's work; `waits` is read per workspace only. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left could still read through an agent. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-94: an agent could answer in a person's name. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-3: a badly ranked question slips past. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-4: a change could switch its own gate off. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-7: a broken hook blocks a person. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-8: questions sent to a server nobody chose. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-13: the install writes outside its folder. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-14: a rule quietly loses its test. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user; the board names who merges, it never merges. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: the ledger rewritten. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-17: a secret reaches the browser; the sync writes with the service key on the server only, and the page reads as the person. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

Acceptance scenarios are off in this repository: each criterion becomes ordinary tests.

1. A ready pull request into the default branch with a requested reviewer and no review shows on
   Workspace as `review`, that reviewer's face as the turn, its age counted from when it was marked
   ready; in that reviewer's My reviews and bell.
2. Once a review approves it with green checks, the row reads `merge`, the PRD's owner's turn, counted
   from the approval; once it merges, no row shows and the stored row is ended, not deleted.
3. A feature PR held by two open `high` items shows `outbox · 2 questions`, the PRD owner's turn; a ◆
   PRD not yet approved shows `approval` with its approvers.
4. A pull request held by `law-locked` shows `law <id>` with the law's owners and delegates.
5. A sub-PR, a draft with no open item, and a pull request whose latest review asked for changes show
   no row.
6. My PRDs lists only the PRDs whose dossier the person opened, theirs to act on first, and never a bug
   fix or visual update.
7. A wait older than 2 working days reads red; a Friday-to-Monday wait counts 1.
8. A repository the sync could not read keeps its rows open, and the page names it after 30 minutes.
9. A member of another workspace reads none of these rows (`supabase/checks/waits.sql`).
10. The bell's count rises by one for each `review`, `merge` or `law` wait whose turn is the person's,
    and the sidebar's Waiting entry shows that count; a team turn adds nothing.
