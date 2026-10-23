---
prd: 2425
title: An API key follows and acts on the job it sent — its outcome, every pull request, its lines, its questions, relaunch, cancel and a ping
blocked-by: none
spec: file
phase0: server
areas: [ask, access]
---

## Problem

An app that sends a bug fix through the public API (`POST /api/v1/bug-fixes` or `/mega-bug-fixes`,
an `oma_` workspace key, PRD 2022) can only poll `GET /api/v1/jobs/{id}`, and that answer hides what
the job did:

- **Every stop reads the same.** A `/omni:bug-fix` that stops without a pull request exits 0, so it
  reads `status: done`, `exit_code: 0`, `reason: null`, `pr_url: null`, whether the bug was already
  fixed, was not a bug, needs a product decision, or waits on a person
  (`kit/lib/runner/runner.ts:471-480`). `runner_jobs.outcome` is `null` for a bug fix
  (`outcomeOf`, `runner.ts:450-455`) and is not in the key's job (`KeyJob`,
  `apps/galaxy/src/runners/runners.contract.ts:334-337`). What happened lives only in comments on
  the bug's issue: `Fixed by #<n>`, `Maybe: #<n>`, `Kind: tooling` (bug-fix skill, **Who fixed it**
  and **Stop rules**).
- **One pull request at most.** `pr_url` is one link parsed from the log, of the job's own
  repository only (`lastPullRequest`, `kit/lib/runner/log.ts:78-88`): a mega-bug-fix's target pull
  requests are only in its record pull request's body, and a failed job never carries one, even
  when it left a draft.
- **No lines.** The job's lines and log tail are read on the Runners page or with the kit's sign-in
  (`GET /api/runners/jobs/<id>/lines`), never with a key.
- **No answer.** A bug fix that stops for a decision on a runner asks questions on its job
  (PRD 2255). A key cannot read them, and answering or dismissing takes a browser session: any
  bearer header is a 403 (`runners.controller.ts:31-32, 106-110`).
- **A lost thread.** Answering, Send again and Resume queue a new job with no `sent_by_key`
  (`runner_job_answer`, `queue(caller, request, null)`, `runners.service.ts:320-332`): the key that
  sent the first job gets 404 on the job that carries its work on.
- **No cancel, no relaunch** with a key, and **no ping**: the app polls.

So whoever uses that app must still open the Omni page to understand, answer, relaunch or cancel a
job the app sent. The app wants to run the job end to end, without anyone opening the Omni page.

## Solution

Additive only: every field, route and refusal of today's public API keeps its meaning, so a client
built on it keeps working unchanged.

1. **The skills say how they stopped.** `/omni:bug-fix` and `/omni:mega-bug-fix` write one line
   `Outcome: <word>` in their hand-off at every end, and `Fixed by: <pull request URL>` when stop
   rule 3 proves the pull request that fixed the bug (the same proof as **Who fixed it**; a `Maybe:`
   never writes it). The words, and the end each one stands for:

   | log word | public `outcome` | when |
   |---|---|---|
   | `pr-opened` | `pr_opened` | a fix pull request is open for review |
   | `already-fixed` | `already_fixed` | the reproduction passes before the fix (stop rule 3) |
   | `need-human` | `need_human` | the job asked its questions on the runner (stop rule 2, or 4 on a runner) |
   | `needs-brainstorm` | `needs_brainstorm` | a product decision is needed: stop rule 4 off a runner, or an answer `Design it first` |
   | `not-a-bug` | `not_a_bug` | tooling or a flaky check, not a behaviour bug (stop rule 1) |
   | `stuck` | `stuck` | the attempts ran out: the pull request stays draft, labelled `omni:needs-fix` (stop rule 5) |
   | `blocked` | `blocked` | the repository lacks what the fix needs: no `commands.smoke` (stop rule 7), answers that cannot be read (stop rule 6), or a mega target that cannot be cloned or pushed to |

   The mega-bug-fix writes the same words: its stops are `/omni:bug-fix`'s, plus **All or nothing
   across targets** (`blocked`).

2. **The runner reads them.** At the end of a job, the runner reads the last `Outcome:` line, the
   `Fixed by:` line and every `PR: <link>` line of the readable log, of any repository, in order,
   and adds `outcome`, `fixedBy` and `prs` to the ending report it already sends
   (`POST /api/runners/jobs/<id>`, `JobUpdateSchema`). A word it does not know, or no `Outcome:`
   line (a skill or kit from before this PRD), reports no outcome: never an error, and the report is
   never refused for it. A failed job (exit code other than 0) reports its `prs` too, and no outcome.

3. **The server keeps them.** `runner_jobs.outcome` accepts the new words beside the yolo ones (the
   existing `human` stands for `need-human`, which the server already sets when questions are
   asked). `runner_jobs` gains `fixed_by` (a pull request URL), `prs` (the list, at most 50),
   `acting_for` and `notify_url` (§9, §10), and `cancelled_by_key` with `cancelled_for` (§7).
   `runner_job_questions` gains `closed_by_key` and `closed_for` (§6).

4. **The job a key reads.** `GET /api/v1/jobs/{id}` adds:

   | field | value |
   |---|---|
   | `outcome` | the table's public word; `null` while the job runs, when it failed (`status: failed`), and when its runner reported none |
   | `fixed_by` | the proven pull request's URL when `outcome` is `already_fixed`, else `null` |
   | `prs` | `[{url, repo, number}]`: every pull request the job opened, in order, across repositories (a mega's targets, then its record; a failed job's draft). `pr_url` keeps today's meaning |
   | `questions` | `{state: open \| answered \| dismissed}` when the job asked questions, else `null` |
   | `continues` | the id of the job this one carries on, or `null` |
   | `continued_by` | the id of the newest job that carries this one on (an answer, a relaunch, the page's automatic continuation), or `null` |
   | `acting_for` | the text sent with the action that queued this job, or `null` |
   | `cancelled_by` | `{key, acting_for}` when a key cancelled it, else `null` |
   | `log_tail` | the job's last lines as the Runners page keeps them (at most 200 lines, 16 KB), or `null` |

5. **Its lines.** `GET /api/v1/jobs/{id}/lines` answers `{"data": [{seq, text}], "next_cursor"}`,
   oldest first, paged with the cursor every list uses (`limit` 1 to 100, 50 by default), as the
   Runners page reads them. The lines keep today's retention (the workspace's 50 newest ended jobs,
   PRD 1904): a job past it answers an empty `data`, and its `log_tail` stays on the job.

6. **Its questions.** `GET /api/v1/jobs/{id}/questions` answers the round: `lead`, `questions`
   (`question`, `header`, `options` of `{label, description}`, `multiSelect`), `state`, then the
   `answers` once given and who closed it (`{key, acting_for}`, or `{login}` for a person on the
   page). A job that asked none answers 404.
   - `POST /api/v1/jobs/{id}/answers` takes `{answers, acting_for?}`, the shape and limits the page
     sends (one answer of at most 2,000 characters to each question, nothing else), and answers 202
     with the job it queued: the resume, `continues` set to `{id}`, sent by the same key.
   - `POST /api/v1/jobs/{id}/dismiss` takes `{acting_for?}`, closes the round with no answer and
     queues nothing; it answers 200 with the job.
   - The first answer or dismissal wins, from the page or from a key; the second answers 409
     (BR-PRODUCT-12).

7. **Relaunch and cancel.**
   - `POST /api/v1/jobs/{id}/cancel` takes `{acting_for?}` and does what the page's Cancel does: a
     queued or claimed job ends at once, a running one is asked to stop and its runner ends it at its
     next report. It answers 200 with the job; an ended job answers 409.
   - `POST /api/v1/jobs/{id}/relaunch` takes `{acting_for?}` and does what the page offers for that
     job: Send again for a failed or cancelled one, Resume for one stopped mid-way. It answers 202
     with the new job, `continues` set to `{id}`, sent by the same key; a job the page offers neither
     for answers 409.

8. **Which key, and the thread.** Any key of the workspace reads and acts on any job a key of that
   workspace sent, within that key's repositories when it has an allow-list (403 outside it), so a
   rotated key keeps its predecessor's jobs. A job a person sent from the Runners page, and a job of
   another workspace, answer 404, as today. Every job an answer, a relaunch or the automatic
   continuation queues from a key's job keeps its `sent_by_key` and sets `continues`, so the whole
   thread stays the key's. `runner_job_answer` and the relaunch take the key; a person's answer on
   the page to a key's job keeps the resume the key's as well.

9. **The trace: the key, never a person.** Every action a key takes is recorded as that key's: the
   job's `sent_by_key`, the round's `closed_by_key`, the job's `cancelled_by_key`. The body may carry
   `acting_for`, a free text of 1 to 80 characters, letters of any alphabet, digits, spaces and `. _ ' @ - ·`,
   naming whom the app acted for (`"Jane D."`): it is stored and shown as given, never matched to a
   member, never a sign-in, never earning points. `POST /api/v1/bug-fixes` and `/mega-bug-fixes`
   take it too. No key ever answers, dismisses, relaunches or cancels as a person, and the kit's
   sign-in (`OMNI_TOKEN`) still never answers or dismisses.

10. **The ping.** `POST /api/v1/bug-fixes` and `/mega-bug-fixes` take `notify_url`, an `https` URL
    of at most 500 characters on a public host; every job that carries the thread on inherits it.
    When the job's status, outcome or questions change, the server `POST`s
    `{"job_id", "event", "at"}` to it, `event` being `status`, `outcome` or `questions`. The ping
    carries nothing else: the app reads the job with its key to learn anything, so a forged ping can
    only make it read. Each ping waits at most 5 seconds and is tried at most 3 times within about 30
    seconds, after the change is stored; a ping that fails is logged and never fails the change. A
    host that resolves to a loopback, private or link-local address is refused with 422 when the job
    is sent, and checked again before every ping. A change the database makes alone (a stale claim a
    scheduled sweep ends) sends no ping: polling, slowly, stays the truth.

11. **The Runners page names the key.** A job's sender reads `API key <name>`, with
    `made by @<login>` under it as today, followed by ` · for <acting_for>` when given. The Need
    human drawer's closed state reads `Already answered by API key <name>` or
    `Dismissed by API key <name>`, followed by ` · for <acting_for>`. A job a key cancelled reads
    `Cancelled` with `by API key <name>` under it. The new outcomes read Done on the page, as a bug
    fix's stop does today: showing them is a later change.

12. **The guide.** `docs/guide/api.md` says how to read what a job did, its lines, answer or dismiss
    its questions, relaunch or cancel it, follow its thread and be pinged; the reference under it is
    rendered from the same schemas, and the errors table gains 409.

**The locked law this changes.** BR-PRODUCT-94 says an answer marked as given on the page is taken
only from the page's sign-in, never from a terminal token, so that an agent never answers in a
person's name. A key's answer is never marked as given on the page, nor in anyone's name: it is the
key's, and says so. The law's words hold; the controller's reading of it ("A token never answers",
`runners.controller.ts:31, 65`) widens to let a key answer or dismiss the questions of a job a key
sent. The PRD proposes one sentence for the law, which only its owner adds: *"An API key may answer
or dismiss the questions of a job a key of its workspace sent; the answer is marked as given by that
key, never on the page nor by a person."* @pierrederval decides it.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | public API | `outcome`, `fixed_by`, `prs`, `questions`, `continues`, `continued_by`, `acting_for`, `cancelled_by`, `log_tail`, `notify_url` | snake_case public fields ← `apps/galaxy/src/public-api/public-api.contract.ts:123-136` (`pr_url`, `exit_code`, `queued_at`) |
| omni-loop | public API | outcome words `pr_opened`, `already_fixed`, `need_human`, `needs_brainstorm`, `not_a_bug`, `stuck`, `blocked` | no written convention: follows the snake_case enum values of `JOB_STATUSES` ← `public-api.contract.ts:118` |
| omni-loop | public API | routes `/api/v1/jobs/{id}/lines`, `/questions`, `/answers`, `/dismiss`, `/cancel`, `/relaunch` | no written convention: follows the Runners page's own routes ← `apps/galaxy/src/runners/runners.controller.ts:25-27` and `apps/galaxy/app/api/v1/jobs/[id]/route.ts` |
| omni-loop | public API | error code `conflict` (409) | no written convention: follows `ERROR_CODES` ← `public-api.contract.ts:149` and the service's own `conflict` ← `apps/galaxy/src/runners/runners.service.ts:551` |
| omni-loop | kit log | `Outcome: <word>`, `Fixed by: <url>` | no written convention: follows `DONE_LINE` and `PR_LINE` ← `kit/lib/runner/log.ts:69-70` |
| omni-loop | runner report | `outcome`, `fixedBy`, `prs` | camelCase report fields ← `JobUpdateSchema`, `apps/galaxy/src/runners/runners.contract.ts:199-222` |
| omni-loop | database | `runner_jobs.fixed_by`, `.prs`, `.acting_for`, `.notify_url`, `.cancelled_by_key`, `.cancelled_for`; `runner_job_questions.closed_by_key`, `.closed_for` | no written convention: follows `runner_jobs.sent_by_key` ← `supabase/migrations/20261210090000_api_keys.sql:50-54` and `runner_job_questions.closed_by` ← `supabase/migrations/20261218100000_runner_job_questions.sql:39` |
| omni-loop | database | migration `<version>_api_key_job_control.sql` | conventions › A new migration takes the next free version ← `.omni-loop/knowledge/playbook/conventions.md` |
| omni-loop | database check | `supabase/checks/api_key_jobs.sql` | conventions › A new database check runs in CI ← `.omni-loop/knowledge/playbook/conventions.md` |
| omni-loop | module | `apps/galaxy/src/public-api/notify.ts` (the ping) | file named for its role ← architecture › Boundaries (ADR-0095): rules in a service, the outgoing call behind a dependency the tests replace |
| omni-loop | id | `prd: PrdNumber`, `pr: PrNumber` for `prs[].number` | conventions › Naming, IDs are branded ← `.omni-loop/knowledge/playbook/conventions.md` |

## Decisions

Taken with the person during the brainstorm:

- **Two PRDs.** This one is the job through the API. Opening the job's pull request as the calling
  app's own GitHub App, rather than the runner machine's `gh` login, is a second PRD: it needs no
  part of this one, and this one needs none of it.
- **Everything the Runners page does for one job,** through the key: read what it did (outcome,
  `fixed_by`, every pull request, lines, log tail), read and answer or dismiss its questions, follow
  its thread, relaunch and cancel it, and a ping. "Fix with answers" is a PRD job's, not a bug fix's,
  and stays out.
- **No member.** The app decided, and the trace says so: a key acts as itself, never in a person's
  name, so the key's answer stands apart from BR-PRODUCT-94's "given on the page" (never#10). The
  person chose this over naming a member by email or GitHub login.
- **The voice's objection, accepted.** persona:Lead Engineer: "I look at the board to know who
  decided what. If an answer only says API key <name>, I don't know which colleague to ask why." Settled
  `accepted`: every action takes the optional free-text `acting_for`, shown beside the key, never
  matched to a member.
- **Any key of the workspace.** Several people of the app work on the same jobs through its one key;
  any key of the workspace (within its allow-list) reads and acts on any key's job, so rotating the
  app's key keeps the jobs in flight. The person chose it over the sending key only.
- **The runner reads the outcome from the log,** as it reads `Done:` and `PR:` today: one path, the
  yolo outcome's (PRD 2223). The person chose it over a new report command or reading GitHub's issue
  comments.
- **A thin ping, per job.** `notify_url` on the job, `{job_id, event, at}`, no secret, no data; the
  person chose it over a per-key signed webhook, which would change the API keys screen.
- **No proof video, no e2e:** the person said no to the proof; e2e is off here.

Taken alone while writing, each the most reversible reading of the approved design:

- **`acting_for` is one name** for every action: 1 to 80 characters, letters of any alphabet, digits,
  spaces and `. _ ' @ - ·`, enough for a person's name or address and nothing a page could run.
- **The page shows the new outcomes as Done,** as a bug fix's stop reads today; only the key's
  attribution changes on screen.
- **A person's answer on the page to a key's job** keeps the resume the key's: the thread is the
  app's to follow.
- **`continued_by` is the newest** job carrying this one on; the chain is followed one job at a time.
- **`prs` keeps at most 50** pull requests, the first 50 in the log.

## User stories

- As an app that sent a bug fix, I read that the bug was already fixed and by which pull request, and
  show it, so nobody opens Omni to learn it.
- As an app, I read the questions a job asks, and send the answer one of my people gave, so the job
  carries on, and I follow the job that resumes it with the same key.
- As an app, I read a job's lines while it runs, and relaunch or cancel it, as my people ask.
- As an app, I am pinged when a job changes, and read it then, rather than asking every few seconds.
- As a member, I see on the Runners page that an API key answered, relaunched or cancelled a job, and
  for whom the app said it acted.

## Scope

In:

- the `Outcome:` and `Fixed by:` lines in `/omni:bug-fix` and `/omni:mega-bug-fix`, and the runner
  reading them with every `PR:` line;
- the stored outcome, `fixed_by`, `prs`, `acting_for`, `notify_url`, the cancel's and the round's
  key, the migration, its database check and the regenerated database types;
- `GET /api/v1/jobs/{id}` and its six new routes, `acting_for` and `notify_url` on both start
  routes, 409 in the error shape, the OpenAPI document;
- the thread keeping its key (answers, relaunch, automatic continuation);
- the ping;
- the Runners page's and the Need human drawer's attribution;
- `docs/guide/api.md`.

Out:

- the second PRD: the job's pull request opened as the calling app's GitHub App, with no person
  named on GitHub;
- a key owned by the workspace rather than by its maker (a key still stops when its maker leaves,
  BR-PRODUCT-64);
- a route listing jobs; keys reading jobs a person sent, or a PRD job's;
- showing the new outcomes on the Runners page;
- a durable queue or a signature for the ping.

## Test seams

Following `omni kb show testing`: tests beside the code, on fixtures; no test calls GitHub, Supabase
or the network.

- **`kit/lib/runner/log.ts`, pure:** a log to `{outcome, fixedBy, prs}`: each word; the last
  `Outcome:` winning; an unknown word and none giving no outcome; `PR:` lines of several
  repositories, in order, deduplicated, at most 50; a link only read never counted.
- **`kit/lib/runner/runner.ts`, on fakes:** a done bug fix reports its outcome, `fixedBy` and `prs`;
  a failed one its `prs` and no outcome; a yolo job's outcome unchanged.
- **The skills' text, guarded:** each stop rule of `/omni:bug-fix` and the mega's **All or nothing
  across targets** writes its `Outcome:` word; rule 3 writes `Fixed by:` only for a proven pull
  request.
- **`runners.service.ts` and `public-api.service.ts`, on the store's fake:** each new route for a
  key: its job and its thread, another key of the workspace, a key off its allow-list (403), a
  person's job and another workspace's (404), a closed round, an ended job and a job the page offers
  no relaunch for (409), a body the contract refuses (422); the resume and the relaunch keeping the
  key and setting `continues`; `acting_for` stored as given; the kit's sign-in still refused.
- **The ping, on a stubbed fetch and resolver:** the three events; 3 tries then logged; a loopback,
  private or link-local host refused at send and before a ping; nothing but `{job_id, event, at}`
  sent.
- **`supabase/checks/api_key_jobs.sql`,** a step of the `supabase` workflow's `check` job: a round a
  key closed records the key and no person; a resume from a key's job keeps `sent_by_key` and sets
  `continues`; a member of another workspace reads none of it.
- **The contract:** `pnpm schemas:verify` with the new returned columns and their readers (conventions
  › A new returned column lands with its readers); the OpenAPI document lists every new field, route
  and 409.
- **Render tests:** the sender cell with and without `acting_for`; the drawer's closed state for a
  key; a cancelled job a key cancelled.
- **Mutation** on the delivery-core files the slices change (`pnpm mutation:changed`).

## Risks

Merging publishes a migration on production Supabase (the new columns, the widened outcome check,
`runner_job_answer` and the relaunch keeping the key), six public routes and two new body fields on
the start routes, the ping, the Runners page's attribution, and a kit release whose skills write the
new lines. Rollback: revert the merge; the routes and the ping are gone, runners on the new kit write
lines nobody reads, and a follow-up migration drops the columns. The public fields are additive, so
a client reading them sees `null` again, never a broken shape.

- **A key acts where a person used to.** A key answers, dismisses, relaunches and cancels key jobs
  of its workspace. It still never merges (N-PRODUCT-15), never answers in a person's name, and the
  job still ends in a pull request a person reviews and merges.
- **The ping calls out.** The server calls a URL an app names: https only, public hosts only, checked
  again before every call, 5 seconds, nothing in the body but the job's id.
- **Old runners.** A runner on a kit from before this PRD reports no outcome: the job reads
  `outcome: null`, as today.
- **`acting_for` is a name an app gives.** It is stored text of at most 80 characters, read only by
  the workspace's members and keys, never a sign-in.

The locked laws it touches:

- BR-PRODUCT-94: an agent could answer a question in a person's name. This PRD lets a key answer or
  dismiss a key job's questions, marked as the key's, never as given on the page nor by a person,
  and proposes the sentence above for the law. Changing it needs @pierrederval to approve the pull
  request on GitHub.
- BR-PRODUCT-12: the terminal acts on words a person no longer stands behind; the first answer or
  dismissal still wins, the second is a 409. Changing it needs @pierrederval or @dervalp to approve
  the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work; a key reads its own workspace's
  key jobs only, within its allow-list. Changing it needs @pierrederval or @dervalp to approve the
  pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent; a key still
  stops when its maker leaves. Changing it needs @pierrederval or @dervalp to approve the pull request
  on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user; no route merges anything. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59 and N-PRODUCT-16 govern every migration:
  this one links no GitHub account, opens no ask session to anyone, reads no session outside its
  workspace, shows no AI key and writes no ledger row. Changing them needs @pierrederval or @dervalp
  to approve the pull request on GitHub.

## Acceptance criteria

Acceptance scenarios are off in this repository: each criterion becomes ordinary tests.

1. A bug fix sent by a key whose reproduction passes before the fix, with the fixing pull request
   proven, reads `status: done`, `outcome: already_fixed` and `fixed_by` that pull request's URL on
   `GET /api/v1/jobs/{id}`.
2. Each other stop reads its word: `pr_opened` with the pull request in `prs`, `need_human` with
   `questions.state: open`, `needs_brainstorm`, `not_a_bug`, `stuck` with the draft in `prs`, and
   `blocked`; a failed job reads `outcome: null` with its draft in `prs`; a job from an older runner
   reads `outcome: null`.
3. A mega-bug-fix that opened two target pull requests and its record lists the three in `prs`, the
   record last; `pr_url` is the record.
4. A key reads a job's lines, oldest first, page by page with `next_cursor`, and its `log_tail`.
5. A key reads the questions of a job that asked them; it answers them with `acting_for: "Jane D."`
   and gets 202 with a new job whose `continues` is the first; the first job's `continued_by` is the
   new one, which the same key reads, and the Runners page shows the round
   `Already answered by API key <name> · for Jane D.`.
6. A second answer or a dismissal after it answers 409, from a key or from the page; the kit's
   sign-in still gets 403 on answering.
7. A key cancels a queued job, which ends at once and reads `cancelled_by` with the key; cancelling
   an ended job answers 409. A key relaunches a failed job and gets 202 with a new job that the same
   key follows.
8. A second key of the same workspace reads and acts on the first key's jobs; a key off the job's
   repository answers 403; a job a person sent, and another workspace's, answer 404.
9. A job sent with `notify_url` pings it with `{job_id, event, at}` when it is claimed, when it ends
   with an outcome and when its questions close, and its resume inherits it; a `notify_url` on a
   private address answers 422 and queues nothing.
10. Every field and route of today's API answers as before for a client that sends none of the new
    fields.
