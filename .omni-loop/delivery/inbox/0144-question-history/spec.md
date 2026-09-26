---
prd: 144
title: Question history — every question Claude asks, kept, sorted and shareable
blocked-by: [100]
spec: file
---

# Question history: every question Claude asks, kept, sorted and shareable

**Date:** 2026-09-26 · **PRD:** #144 · **Touches:** `supabase/`, `apps/galaxy` (ask pages and
`/api/ask/*`), `kit/lib/ask`, ADR-0002 · **Blocked by:** #100 (Workspaces), whose members are the
people a question is shared with and who read the history

This is the first of three PRDs on the question experience:

1. **This one.** Questions are kept for good, with their context, their cost, who answered and a
   category, in a history the whole workspace reads; a live question can be shared with a teammate.
2. **Slack.** A shared question pings the teammate in Slack, and may be answered there.
3. **Questions into the knowledge base.** Answered questions become an input of PRD 82's harvest.

## Problem

Ask mode (PRD 71) puts Claude's questions on a web page, and then forgets them.

- **Nothing lasts.** `public.ask_sweep()` deletes a session and its rounds 7 days after it closes
  (`supabase/migrations/20260926090000_ask_sessions.sql`). The answers people gave, often product and
  business decisions, are gone within a week, and there is nothing to build knowledge from.
- **Nothing says where a question came from.** A round holds its questions, its answers,
  `answered_via`, `created_at` and `answered_at`. It does not hold the repository, the branch, the PRD,
  the skill that asked, the model, or what the Claude session had cost by then.
- **Only the owner can see or answer.** Every access rule is "a person … their own sessions". A
  question that is really a business or product call cannot be handed to the person who should make
  it, so the engineer answers it or guesses.
- **Nothing is sorted.** There is no way to find "every business decision asked this month", or every
  UX question on PRD 94.

## Solution

### What a round records

While ask mode is on, the kit's `pre` hook sends a `context` object with each new round. Every field
is best-effort: a value the hook cannot read is `null`, and a failure never blocks or delays the
question (PRD 71's rule: the mode never blocks a person).

| field | read from | how |
|---|---|---|
| `repo` | `omni config` | `repo.slug` |
| `branch` | git, in the hook's `cwd` | `git rev-parse --abbrev-ref HEAD` |
| `prd` | the branch and the inbox | a branch matching `branches.feature` or `branches.slice` gives `{topic}`; the folder `<paths.delivery>/inbox/<nnnn>-<topic>` gives `nnnn` |
| `claudeSessionId` | the hook input | `session_id` |
| `skill` | the transcript at `transcript_path` | the last user entry carrying `<command-name>/…</command-name>`, as written (`/omni:brainstorm`) |
| `model` | the transcript | the last assistant entry's `message.model` |
| `tokens` | the transcript | `{ input, output, cacheRead, cacheWrite }`: the sum of `message.usage` over assistant entries, each message id counted once |

Only counts and names leave the machine, never transcript text. The questions and their options
already go to the page today.

The galaxy stores them, and adds:

- `cost_usd`, computed from `model` and `tokens` with one price table in the galaxy
  (`apps/galaxy/src/ask/prices.ts`). An unknown model gives `null`. The kit holds no price.
- `answered_by`, the account that answered, taken from the signed-in caller, never from the body.
  An answer the hook posts from the terminal is the session owner's.
- The time to answer is `answered_at − created_at`, computed when read. No column.
- `category`, one of six, picked by a model (below).

### Six categories

| value | label | holds |
|---|---|---|
| `business` | Business | pricing, priorities, customers, contracts, anything a business owner decides |
| `product` | Product | scope, features, behaviour, what the product does |
| `ux-ui` | UX/UI | screens, copy, flows, look |
| `architecture` | Architecture | design, data, interfaces, dependencies |
| `harness` | Harness | Omni Loop itself, CI, tooling, process |
| `other` | Other | the rest |

After a round is created, the route classifies it in the background (Next's `after()`): one call to
OpenRouter with the questions, their options and the context, and a reply that must be one of the six
values. Any failure, or any other reply, leaves `category` null, shown as **unsorted**. Nothing
retries. Any member of the workspace may set or change a round's category on the page;
`category_by` says `model` or the member's id.

### Keeping it, and who sees it

- **Kept for good.** `ask_sweep()` still closes a session idle for 12 hours, and no longer deletes
  anything. An owner may delete their own session (and its rounds) from the page.
- **A session belongs to a workspace.** `ask_sessions.workspace_id` is set when it opens: the caller's
  workspace whose `github_org` is the owner in `context.repo`, and otherwise the caller's workspace
  they joined first. A caller in no workspace is refused, as PRD 100 already does.
- **The whole workspace reads.** Any member of a session's workspace can read the session and its
  rounds.
- **Answering stays narrow.** A round can be answered by the session owner, or by a member it is
  shared with, only while the round is open.

### Sharing a live question

- On the live page, each open round has a **Share** button: pick a workspace member, and the page
  gives a link to copy, `/ask/q/<round>`. The owner pastes it where they like (Slack is the next PRD).
- The teammate sees the question under **For me**, and on the link: the answer form, the session's
  earlier rounds for context, and the time left before the hook falls back to the terminal (its
  10-minute ceiling is unchanged).
- **The first answer wins.** The owner can still answer on their page, or in the terminal after the
  fallback. The answer is written only while `status = 'open'`; whoever comes second gets
  **Already answered by X**, with X's answer.
- Sharing an answered or abandoned round shares a read-only link. Any member can open any
  `/ask/q/<round>` read-only, which is how a past question, or a whole session (`/ask/<session>`), is
  shared.

### Pages

- `/ask/<session>` (today's live page): adds, on each round, its category chip (editable), its
  context line (repo · branch · PRD #n · skill · model · tokens · $cost · time to answer) and, while
  open, **Share**. Read-only for a member who is not the owner.
- `/ask/q/<round>`: one question, live or read-only, as above.
- `/ask/history`: every round of the caller's workspaces, newest first, filtered by category, repo,
  PRD, skill, who asked and who answered, and searched by text over questions and answers. Each row
  opens `/ask/q/<round>`.
- `/ask/for-me`: the open rounds shared with the caller, with their time left, and a count on the ask
  header.

Light, dark and system themes, as PRD 71's page.

### Data

```sql
alter table public.ask_sessions
  add column workspace_id      uuid references public.workspaces on delete cascade,
  add column repo              text,
  add column branch            text,
  add column claude_session_id text;

alter table public.ask_rounds
  add column prd          integer,
  add column skill        text,
  add column model        text,
  add column tokens       jsonb,            -- {input, output, cacheRead, cacheWrite}, integers
  add column cost_usd     numeric(10, 4),
  add column answered_by  uuid references auth.users on delete set null,
  add column category     text check (category in ('business', 'product', 'ux-ui', 'architecture', 'harness', 'other')),
  add column category_by  text;             -- 'model', or a user id

create table public.ask_shares (
  round_id    uuid not null references public.ask_rounds on delete cascade,
  shared_with uuid not null references auth.users on delete cascade,
  shared_by   uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (round_id, shared_with)
);
```

Sessions opened before this PRD get the workspace of their owner's first membership, and nulls
elsewhere. The six access rules on the ask tables are rewritten to the table above.

### Contract

`POST /api/ask/sessions/:id/rounds` takes an optional `context`; `POST /api/ask/sessions` takes an
optional `context.repo`. An older kit sends neither and keeps working, its rounds carrying nulls.
ADR-0002's contract section says so. New routes: `POST /api/ask/rounds/:id/shares`,
`PATCH /api/ask/rounds/:id/category`, `DELETE /api/ask/sessions/:id`, and the reads behind
`/ask/history` and `/ask/for-me`. An answer to a round that is no longer open returns 409, with who
answered.

## Decisions

1. **One set of tables, live and history.** The history is the same `ask_sessions` and `ask_rounds`
   rows, kept. No copy, no second shape.
2. **The galaxy classifies,** in `after()`, through OpenRouter, with a new `OPENROUTER_API_KEY` in its
   environment. Not omni-app: a question's path stays inside one deployment.
3. **The kit sends counts, the galaxy prices them.** Prices change; one table in one place.
4. **Recorded only while ask mode is on.** Off stays off: the hooks are silent, and nothing leaves the
   machine.
5. **The whole workspace reads; the owner and the people shared with answer.**
6. **First answer wins,** enforced by the database update's condition, not by the page.
7. **Six fixed categories.** Editing the list per workspace is a later PRD.
8. **Kept for good.** Only the owner deletes.

## User stories

- As an engineer, I share a live product question with our product owner and carry on; they answer it
  on the link before the ten minutes are up, and Claude continues with their answer.
- As a product owner, I open **For me**, see the question with the session's earlier rounds, and
  answer it; if the engineer answered first, I see their answer instead.
- As anyone in the workspace, I open **History**, filter on Business and on PRD 94, and read every
  business decision taken on it, who took it and when.
- As an engineer, I see what the Claude session had cost when it asked, and how long the answer took.
- As anyone in the workspace, I move a question the model sorted as Architecture to Product.

## Scope

**In:** the context, cost and category of every round asked while ask mode is on; keeping them; the
workspace-wide read; sharing a round; the four pages; the contract's optional fields and new routes;
ADR-0002's contract line.

**Out:** Slack (next PRD); turning questions into knowledge (a later PRD, on PRD 82's harvest);
categories edited per workspace; recording questions while ask mode is off; sharing with someone
outside the workspace; notifications other than **For me**.

## Test seams

- **Context extraction** (`kit/lib/ask`): a pure function over the hook input, the config, git and a
  transcript file. Unit tests on fixture transcripts: tokens summed with duplicate message ids counted
  once, the last `/…` command, the last model; a missing transcript, a malformed line, a detached
  HEAD, a branch outside the loop's shapes: each gives nulls, never a throw.
- **The hook** (`kit/lib/ask/hook.test.mjs`, `kit/test/fake-ask-server.mjs`): `pre` sends `context`
  on round create; a context that throws still asks the question.
- **Prices and categories** (`apps/galaxy/src/ask`): pure units. The price of a known and an unknown
  model; the classifier's reply parsed to one of six or null, with OpenRouter stubbed.
- **The API** (`apps/galaxy/src/ask/api.test.ts`): `context` optional and validated; `answered_by`
  from the caller; share, category and delete routes, each with its refusals; the second answer's
  409 naming the first answerer.
- **The access rules** (`supabase/checks/ask.sql`, run by the `supabase` workflow on an empty database): a
  member reads another member's session; a non-member reads nothing; a shared member answers an open
  round and not an answered one; a member who is neither owner nor shared cannot answer; only the
  owner deletes; `ask_sweep()` deletes nothing.
- **Pages:** component tests for the round's states (open, shared, answered by me, answered by
  someone else, abandoned, unsorted) and for the history's filters.

No test calls Supabase, GitHub or OpenRouter outside the `supabase` workflow's local stack.

## Risks

- **What merging publishes.** A migration on the production Supabase project (the `supabase`
  workflow's `deploy` job), the kit's hook through the plugin, and the galaxy's pages. Rollback: the
  migration only adds columns and one table and rewrites the access rules; a follow-up migration
  restores PRD 100's rules, and the added columns may stay. The kit's `context` is optional, so an
  older or newer kit works against either galaxy.
- **The access rules widen, on purpose.** Rounds that were private become readable by the whole
  workspace, including those already stored. The migration's comment and the PR say so; the
  `supabase` tests prove a non-member still reads nothing.
- **The transcript's shape is Claude Code's, not ours.** A change there turns `skill`, `model` or
  `tokens` into nulls, never into a failure.
- **Cost is an estimate:** it is the session's tokens up to the question, priced by our table.
- **The model call** costs a fraction of a cent per question and can mis-sort; people fix it.
- **Blocked by PRD 100.** This PRD needs `workspaces` and `workspace_members`; it is built on the
  default branch once #101 has merged.

## Acceptance criteria

No acceptance harness in this repository (`acceptance.enabled` is false): each criterion becomes an
ordinary test, or a manual step recorded with screenshots in the last slice's sub-PR.

1. With ask mode on, a question asked from `/omni:brainstorm` on a feature branch of PRD n is stored
   with its repo, branch, PRD n, skill `/omni:brainstorm`, model, token counts and a cost.
2. A context the hook cannot read (no transcript, a detached HEAD) still asks the question, on the
   page, with those fields null.
3. Within a minute, the round carries one of the six categories, or shows as unsorted; any member can
   change it, and the round then says who set it.
4. The owner shares an open round with a member: the member sees it under **For me**, answers it on
   `/ask/q/<round>`, Claude receives that answer, and the round says who answered and after how long.
5. When the owner answers first, the member's page shows **Already answered by** the owner, with the
   answer, and the member's answer is refused.
6. A member of the workspace who is neither owner nor shared reads the session and the round, and
   cannot answer.
7. An account in another workspace reads nothing.
8. `/ask/history` lists the rounds of the caller's workspaces, filters by category, repo, PRD, skill,
   who asked and who answered, and finds a round by a word of its answer.
9. A session closed eight days ago is still there; the owner can delete it, and nobody else can.
10. An older kit, sending no `context`, still opens a session, asks and receives an answer.
