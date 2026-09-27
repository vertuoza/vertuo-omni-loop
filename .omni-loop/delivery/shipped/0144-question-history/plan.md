# Plan: Question history

PRD #144, spec beside this plan (`spec.md`). The feature branch `feat/question-history` merges into
`main` through the feature PR, whose body says `Closes #144`. Each slice is a sub-PR from
`feat/question-history--<slice>` into the feature branch, whose body says `Part of #144`. Built once
PRD 100 (Workspaces) has merged into `main` and been merged into the feature branch.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every round records where it came from and what it cost: the hook's best-effort `context` (repo, branch, PRD, Claude session, skill, model, tokens) read from the config, git and the transcript; the optional `context` on the contract; the `ask_context` migration; the galaxy's price table and `cost_usd`; `answered_by` from the caller; and the context line with the time to answer on the live page | `kit/lib/ask/context` `kit/lib/ask/hook` `kit/lib/ask/client` `kit/test/fake-ask-server.mjs` `kit/bin/ask-hook.test.mjs` `kit/dist/omni.mjs` `supabase/migrations/20260927090000_ask_context` `apps/galaxy/src/ask/prices` `apps/galaxy/src/ask/api` `apps/galaxy/src/ask/store` `apps/galaxy/app/api/ask/` `apps/galaxy/src/ask/page/` `.omni-loop/knowledge/adr/0002-` | — | 1 |
| s2 | Kept for good, and read by the whole workspace: the `ask_workspace` migration (`workspace_id` from the repo's organisation or the first membership, backfilled; member read; `ask_sweep()` deletes nothing), the owner's delete, the live page read-only for a member who is not the owner, and the access checks for member, non-member and owner | `supabase/migrations/20260927100000_ask_workspace` `supabase/checks/ask.sql` `apps/galaxy/src/ask/api` `apps/galaxy/src/ask/store` `apps/galaxy/src/ask/auth` `apps/galaxy/app/api/ask/` `apps/galaxy/app/ask/[session]/` `apps/galaxy/src/ask/page/` | s1 | 2 |
| s3 | Every round carries one of six categories: the `ask_category` migration, the classifier through OpenRouter in `after()` with its reply held to the six values, `OPENROUTER_API_KEY` in the galaxy's environment, the category route, and the editable chip saying who set it | `supabase/migrations/20260927110000_ask_category` `supabase/checks/ask.sql` `apps/galaxy/src/ask/classify` `apps/galaxy/src/ask/api` `apps/galaxy/src/ask/store` `apps/galaxy/app/api/ask/` `apps/galaxy/src/ask/page/` `apps/galaxy/.env.example` `apps/galaxy/README.md` | s2 | 3 |
| s4 | A live question can be shared, and the first answer wins: the `ask_shares` migration and its answer rule, the share route, the 409 naming who answered, `/ask/q/<round>` live and read-only, `/ask/for-me` with its count on the ask header, and the Share button with its link to copy | `supabase/migrations/20260927120000_ask_shares` `supabase/checks/ask.sql` `apps/galaxy/src/ask/api` `apps/galaxy/src/ask/store` `apps/galaxy/app/api/ask/` `apps/galaxy/app/ask/q/` `apps/galaxy/app/ask/for-me/` `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/src/ask/page/` | s3 | 4 |
| s5 | The workspace's history: `/ask/history` newest first, filtered by category, repo, PRD, skill, who asked and who answered, searched by a word of a question or its answer, each row opening `/ask/q/<round>`; the kit README's line; and the manual acceptance recorded with screenshots | `apps/galaxy/src/ask/api` `apps/galaxy/src/ask/store` `apps/galaxy/app/api/ask/` `apps/galaxy/app/ask/history/` `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/src/ask/page/` `kit/README.md` | s1, s3, s4 | 5 |

**Shared ground.** Every slice reaches the ask contract, so five prefixes are shared, and the
waves run one slice at a time:

- `apps/galaxy/src/ask/api`, `apps/galaxy/src/ask/store`, `apps/galaxy/app/api/ask/` and
  `apps/galaxy/src/ask/page/` are declared by s1 to s5, in waves 1 to 5.
- `supabase/checks/ask.sql` is declared by s2, s3 and s4, in waves 2, 3 and 4: each appends its own
  checks.
- `apps/galaxy/app/ask/layout.tsx` is declared by s4 (the For me link and count) and s5 (the History
  link), in waves 4 and 5.
- `kit/dist/omni.mjs` is declared by s1 alone; rebuild it with `pnpm kit:build` from the merged
  source, never by hand.

Every migration has its own file prefix, timestamped after PRD 100's
`20260926120000_workspaces.sql`, in slice order.

The ordering has reasons behind it:
- s2 follows s1: its read-only page shows s1's context line, and its backfill reads s1's `repo`.
- s3 follows s2: the category route lets any **member** set a category, which needs s2's
  membership rule.
- s4 follows s3: the teammate's page shows the category chip, and sharing needs s2's membership.
- s5 follows s1, s3 and s4: it filters on context and category, and each row opens s4's
  `/ask/q/<round>`. It ends the PRD, so it carries the manual acceptance.

## Per slice: done when

**s1: context and cost**
- With a fixture transcript, the context extractor returns repo, branch, PRD, Claude session,
  skill (the last `/…` command), model (the last assistant model) and token counts summed with each
  message id counted once.
- A missing transcript, a malformed line, a detached HEAD, or a branch outside the loop's shapes each
  gives nulls in those fields, never a throw; the hook test proves the question is still asked.
- Against the fake server, `pre` sends `context` on round create; a session open sends
  `context.repo`.
- The API accepts a round with and without `context`, refuses a malformed one with 400, stores it,
  and sets `cost_usd` from the price table (null for an unknown model).
- `answered_by` is the caller on a page answer and the session owner on a terminal answer, never a
  value from the body.
- The live page shows the context line and the time to answer; a component test covers a round
  with every field and one with nulls.
- ADR-0002's contract section names the optional `context`; `pnpm test` is green and the bundle is
  rebuilt.

**s2: kept, and read by the workspace**
- The migration applies on an empty database after PRD 100's; a session opened with `context.repo`
  under the workspace's `github_org` gets that workspace, and otherwise the caller's first one.
- `supabase/checks/ask.sql` proves: a member reads another member's session and rounds; an account
  in another workspace reads nothing; a member who is not the owner cannot answer; only the owner
  deletes; `ask_sweep()` closes an idle session and deletes nothing, even one closed 8 days ago.
- `DELETE /api/ask/sessions/:id` deletes the owner's session and refuses anyone else.
- `/ask/<session>` renders read-only for a member who is not the owner, with no answer form, and
  keeps the delete button for the owner only.

**s3: categories**
- The migration refuses a category outside the six.
- The classifier, with OpenRouter stubbed, maps a reply to one of the six; any other reply, an error
  or a timeout gives null, and nothing retries.
- Creating a round schedules the classifier in `after()`: the create response does not wait on it.
- `PATCH /api/ask/rounds/:id/category` lets any member set one of the six (or clear it), records
  `category_by` as their id, and refuses a non-member and a value outside the six.
- The chip shows the category or **unsorted**, and who set it; the page test covers each state.
- `OPENROUTER_API_KEY` is in `apps/galaxy/.env.example` and the README's environment list; without
  it, rounds stay unsorted and nothing fails.

**s4: sharing**
- `POST /api/ask/rounds/:id/shares` lets the owner share with a member of the session's workspace,
  and refuses a non-member target, a non-owner caller and an unknown round.
- `supabase/checks/ask.sql` proves a shared member answers an open round, and cannot answer an
  answered or abandoned one, nor a round not shared with them.
- The second answer to a round gets 409 naming who answered and via which way; the first answer is
  kept.
- `/ask/q/<round>` shows the form with the session's earlier rounds and the time left for the owner
  and a shared member while open; read-only for any other member; **Already answered by X**, with the
  answer, once answered.
- `/ask/for-me` lists the open rounds shared with the caller with their time left, and the header
  shows their count.
- The Share button picks a member and shows the link, with a copy button that falls back to
  selecting the text.

**s5: history, and the acceptance**
- `/ask/history` lists the rounds of the caller's workspaces newest first, and nothing from another
  workspace.
- Each filter (category, repo, PRD, skill, who asked, who answered) narrows the list; a word of an
  answer finds its round; a test covers each filter and the search.
- Each row opens `/ask/q/<round>`; the header links to History.
- The kit README's ask mode line says questions are kept and shareable.
- The sub-PR records the manual acceptance with screenshots, in light and dark: a `/omni:brainstorm`
  question on a PRD's feature branch shows its context and cost and gets a category; a question
  shared with a second account is answered by them and Claude continues with that answer; the owner
  answering first shows **Already answered** on the teammate's page; the history filters to it; an
  older kit (without `context`) still asks and gets an answer.
