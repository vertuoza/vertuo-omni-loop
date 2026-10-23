# Plan: An API key follows and acts on the job it sent

PRD #2425, its spec beside this plan (`spec.md`). The feature branch `feat/api-key-job-control`
merges into `main` with `Closes #2425`; each slice is a sub-PR from
`feat/api-key-job-control--<slice>` into the feature branch, with `Part of #2425`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The database keeps what a key's job did and who acted on it: the widened outcome, `fixed_by`, `prs`, `acting_for`, `notify_url`, the cancel's key, and a round answered or dismissed by a key, whose resume keeps the key | `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `.github/workflows/supabase.yml` | — | 1 | deep |
| s2 | `/omni:bug-fix` and `/omni:mega-bug-fix` write `Outcome: <word>` at every end and `Fixed by: <url>` on a proven pull request, and the runner reports the outcome, `fixedBy` and every `PR:` line in its ending report | `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/lib/runner/` `kit/test/bug-fix-outcome` | — | 1 | build |
| s3 | The server stores a runner's outcome, `fixedBy` and `prs`, and `GET /api/v1/jobs/{id}` tells any key of the workspace what the job did: `outcome`, `fixed_by`, `prs`, `questions`, `continues`, `continued_by`, `acting_for`, `cancelled_by`, `log_tail` | `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/src/public-api/` | s1, s2 | 2 | build |
| s4 | A key reads a job's lines with `GET /api/v1/jobs/{id}/lines`, oldest first, page by page | `apps/galaxy/src/public-api/` `apps/galaxy/app/api/v1/jobs/[id]/lines/` | s3 | 3 | build |
| s5 | The Runners page names the key: the sender reads ` · for <acting_for>` after `made by @<login>`, the Need human drawer's closed state reads `Already answered by API key <name>` or `Dismissed by API key <name>`, and a job a key cancelled reads `by API key <name>` | `apps/galaxy/src/runners/page/` | s3 | 3 | build |
| s6 | A key reads, answers and dismisses a key job's questions, the first answer winning, and every job that carries a key's job on (an answer, the page's answer, the automatic continuation) stays the key's | `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/src/runners/continue.` `apps/galaxy/src/public-api/` `apps/galaxy/app/api/v1/jobs/[id]/questions/` `apps/galaxy/app/api/v1/jobs/[id]/answers/` `apps/galaxy/app/api/v1/jobs/[id]/dismiss/` | s3 | 4 | deep |
| s7 | A key cancels a job and relaunches one, as the page's Cancel, Send again and Resume do, the new job staying the key's | `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/src/public-api/` `apps/galaxy/app/api/v1/jobs/[id]/cancel/` `apps/galaxy/app/api/v1/jobs/[id]/relaunch/` | s6 | 5 | build |
| s8 | A job sent with `notify_url` and `acting_for` pings that URL with `{job_id, event, at}` when its status, outcome or questions change, and refuses a host that is not public | `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/src/public-api/` | s6, s7 | 6 | deep |
| s9 | The guide says how a key reads what a job did, its lines, answers or dismisses its questions, relaunches or cancels it, follows its thread and is pinged, and its errors table gains 409 | `docs/guide/api.md` | s4, s6, s7, s8 | 7 | light |

**Shared ground.** `apps/galaxy/src/public-api/` is declared by s3, s4, s6, s7 and s8, in waves 2,
3, 4, 5 and 6: the public contract, its OpenAPI document (`openapi.ts`, `openapi.test.ts`) and the
fake store each of them extends. `apps/galaxy/src/runners/runners.` and
`apps/galaxy/src/runners/fixtures/` are declared by s3, s6, s7 and s8, in waves 2, 4, 5 and 6: the
runners contract, service, repository and controller, their tests (`runners.migration.test.ts` reads
`runners.contract.ts`) and the store's fake. s6 sits in wave 4, one after its blocker's wave would
put it, because it shares `apps/galaxy/src/public-api/` with s4 in wave 3. The ending report's shape
is named twice: the kit's `kit/lib/runner/api.ts` (s2) sends it and galaxy's `runners.contract.ts`
(s3) reads it; s3 waits for s2, so it reads the shape s2 settled. `supabase/database.types.ts` is
s1's alone; the galaxy slices read it. `kit/dist/` and `apps/omni-app/api/` are generated: no slice
lists them, and the wave rebuilds them once.

## Per slice: done when

### s1 (deep: the one migration every other slice reads, and the answer functions on a law path)

- A migration `<version>_api_key_job_control.sql`, dated after the newest on `main`
  (`node scripts/migration-order.ts`; conventions › A new migration takes the next free version),
  whose header names its rollback:
  - widens the `runner_jobs.outcome` check with `pr-opened`, `already-fixed`, `needs-brainstorm`,
    `not-a-bug`, `stuck` and `blocked`, beside today's values (`human` stays need-human's);
  - adds `runner_jobs.fixed_by`, `prs` (jsonb, not null, default `[]`, at most 50 entries),
    `acting_for` (1 to 80 characters), `notify_url` (`https`, at most 500 characters),
    `cancelled_by_key` (references `api_keys`) and `cancelled_for`, and
    `runner_job_questions.closed_by_key` (references `api_keys`) and `closed_for`, named after
    `sent_by_key` and `closed_by` (spec › Conventions);
  - lets `runner_job_answer` and `runner_job_dismiss` close a round for a key, with its
    `acting_for`, exactly one of a person and a key, and never writes a key's close into
    `closed_by`; `runner_job_answer` queues the resume of a key's job with the job's `sent_by_key`,
    `continues` and `notify_url`, whoever answered.
- `supabase/checks/api_key_jobs.sql`, its own step of the `supabase` workflow's `check` job, proves:
  - a round a key closed records the key and its `acting_for`, and no person;
  - a resume from a key's job keeps `sent_by_key`, sets `continues` and keeps `notify_url`, also
    when a person answered;
  - the second close of a round is refused (BR-PRODUCT-12);
  - an `acting_for` of 81 characters, a `notify_url` over `http` and a 51st pull request are
    refused;
  - a member of another workspace reads none of it, and only the service role writes the new
    columns.
- `supabase/database.types.ts` is what `node scripts/supabase-types.ts` writes from a fresh local
  database (conventions › The database types are generated, never written).

### s2

- `/omni:bug-fix` writes one `Outcome: <word>` line in its hand-off at every end: `pr-opened`,
  `already-fixed` (stop rule 3), `need-human` (stop rule 2, or 4 on a runner), `needs-brainstorm`
  (stop rule 4 off a runner, or an answer `Design it first`), `not-a-bug` (stop rule 1), `stuck`
  (stop rule 5) and `blocked` (stop rules 6 and 7). Stop rule 3 writes `Fixed by: <url>` only for
  the pull request **Who fixed it** proves; a `Maybe:` never writes it.
- `/omni:mega-bug-fix` writes the same words, and `blocked` for **All or nothing across targets**.
- A guard test, `kit/test/bug-fix-outcome-lines.test.ts`, fails when a stop rule of either skill
  names no word, or when `Fixed by:` is written anywhere but stop rule 3's proven pull request.
- A pure reader in `kit/lib/runner/log.ts` turns a log into `{outcome, fixedBy, prs}`, tested on
  fixtures: each of the seven words; the last `Outcome:` winning; an unknown word and no line giving
  no outcome; `PR:` lines of several repositories, in order, deduplicated, at most 50; a link the job
  only read never counted.
- On fakes, `kit/lib/runner/runner.ts` reports a done bug fix's and mega-bug-fix's `outcome`,
  `fixedBy` and `prs` in its ending report; a failed job its `prs` and no outcome; a yolo job's
  outcome and `prUrl` exactly as today.

### s3 (`ui: yes`)

- `JobUpdateSchema` accepts the seven words, `fixedBy` (a pull request URL) and `prs` (at most 50),
  and the service stores them; `need-human` is stored as the existing `human`; a report without them
  is stored as today.
- `GET /api/v1/jobs/{id}` adds, for a bug fix and a mega-bug-fix sent by a key, `outcome` (the
  public word of spec §1, `null` while it runs, when it failed and when its runner reported none),
  `fixed_by` (with `already_fixed` only), `prs` (`[{url, repo, number}]`, `number` a `PrNumber`),
  `questions` (`{state}` or `null`), `continues`, `continued_by`, `acting_for`, `cancelled_by`
  (`{key, acting_for}` or `null`) and `log_tail`; `pr_url` keeps today's meaning (acceptance 1 to 3).
- Any key of the workspace reads any key's job within its allow-list (403 outside it); a job a
  person sent and another workspace's answer 404 (acceptance 8, the read).
- The Runners page's job read carries `acting_for`, `cancelled_by_key`'s name and the round's
  `closed_by_key` name and `closed_for`, for s5 to show.
- The OpenAPI document lists every new field; `pnpm schemas:verify` passes with the new returned
  columns and their readers (conventions › A new returned column lands with its readers).
- Every field and route of today's API answers as before for a client that sends none of the new
  fields (acceptance 10).

### s4 (`ui: yes`)

- `GET /api/v1/jobs/{id}/lines` answers `{"data": [{seq, text}], "next_cursor"}`, oldest first,
  paged with the cursor every list uses (`limit` 1 to 100, 50 by default); a job past the retention
  of PRD 1904 answers an empty `data` and keeps its `log_tail` (acceptance 4).
- The same key rules as s3: another key of the workspace reads it, a key off the repository gets
  403, a person's job and another workspace's 404.
- The OpenAPI document lists the route.

### s5 (`ui: yes`)

- The sender cell of a key's job reads `API key <name>`, `made by @<login>` under it, then
  ` · for <acting_for>` when given, as the `runners` draft draws it; without `acting_for` it reads
  as today.
- A job a key cancelled reads `Cancelled` with `by API key <name>` under it; a job a person
  cancelled reads as today.
- The Need human drawer's closed state reads `Already answered by API key <name>` or
  `Dismissed by API key <name>`, then ` · for <acting_for>` when given, with neither button, as the
  `runner-need-human` draft draws it; a person's close reads as today.
- Render tests hold the three, with and without `acting_for`; the page's demo shows a key's job
  with one; the new outcomes still read Done.

### s6 (`ui: yes`, `law: BR-PRODUCT-94 · owner @pierrederval`, deep: who may answer for whom, and the first answer winning)

If BR-PRODUCT-94 breaks, an agent answers a question in a person's name and nobody can tell who
decided: a key's answer reads as the key's, never as given on the page nor by a person, and the
feature PR waits for @pierrederval to approve the sentence the spec proposes for the law.

- `GET /api/v1/jobs/{id}/questions` answers the round (`lead`, `questions`, `state`, the `answers`
  once given, `closed_by` as `{key, acting_for}` or `{login}`), and 404 for a job that asked none.
- `POST /api/v1/jobs/{id}/answers` takes `{answers, acting_for?}`, the page's shape and limits, and
  answers 202 with the resume job, `continues` set to `{id}`, sent by the same key; the first job's
  `continued_by` is the resume, which the same key reads (acceptance 5).
- `POST /api/v1/jobs/{id}/dismiss` takes `{acting_for?}`, closes the round with no answer, queues
  nothing and answers 200 with the job.
- A second answer or dismissal, from a key or the page, answers 409 with the error code `conflict`
  (BR-PRODUCT-12); the kit's sign-in still gets 403 on answering and dismissing (acceptance 6).
- A person's answer on the page to a key's job, and the page's automatic continuation
  (`continue.ts`) of a key's job, keep the new job's `sent_by_key` and set `continues`.
- `acting_for` takes 1 to 80 characters, letters of any alphabet, digits, spaces and
  `. _ ' @ - ·`, and is stored as given (422 otherwise); the controller's "a token never answers"
  reading widens only for a key on a job a key of its workspace sent.
- The OpenAPI document lists the three routes and the 409.

### s7 (`ui: yes`)

- `POST /api/v1/jobs/{id}/cancel` takes `{acting_for?}` and does what the page's Cancel does: a
  queued or claimed job ends at once, a running one is asked to stop; it records
  `cancelled_by_key` and `cancelled_for`, answers 200 with the job, and 409 for an ended job
  (acceptance 7).
- `POST /api/v1/jobs/{id}/relaunch` takes `{acting_for?}` and does what the page offers for that
  job, Send again for a failed or cancelled one, Resume for one stopped mid-way; it answers 202 with
  the new job, `continues` set to `{id}`, sent by the same key, its `notify_url` kept, and 409 for a
  job the page offers neither for. `runner_jobs.continues` is unique, so a job already carried on
  answers 409 too: the app relaunches the newest job of its thread (acceptance 7).
- The same key rules as s3 (acceptance 8, the actions); the OpenAPI document lists both routes.

### s8 (`ui: yes`, deep: the server calls a URL an app names)

- `POST /api/v1/bug-fixes` and `/mega-bug-fixes` take `acting_for` and `notify_url` (`https`, at
  most 500 characters); a host that resolves to a loopback, private or link-local address answers
  422 and queues nothing (acceptance 9).
- `apps/galaxy/src/public-api/notify.ts`, its fetch and resolver behind a dependency the tests
  replace (architecture › Boundaries, ADR-0095), posts `{"job_id", "event", "at"}` and nothing else
  once a change is stored: `status` when the job is claimed, runs or ends, `outcome` when it ends
  with one, `questions` when its round opens or closes.
- On a stubbed fetch and resolver: each ping waits at most 5 seconds and is tried at most 3 times
  within about 30 seconds; a ping that fails is logged and never fails the change; the host is
  checked again before every ping; a job the scheduled sweep ends sends none.
- A resume and a relaunch inherit `notify_url`, so the thread's jobs ping it too (acceptance 9).

### s9 (light: the guide only)

- `docs/guide/api.md` says how to read what a job did (`outcome`, `fixed_by`, `prs`), its lines,
  how to answer or dismiss its questions, relaunch or cancel it, follow its thread with `continues`
  and `continued_by`, and be pinged with `notify_url`, with `acting_for` on each action.
- Its errors table gains 409 `conflict`; the reference under it is rendered from the same schemas,
  and its fixtures are fictional (never#11).
