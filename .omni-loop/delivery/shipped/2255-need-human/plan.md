# Plan: A stopped bug fix asks for a human answer on its job, then resumes with it

PRD #2255, spec in `spec.md` beside this plan. The feature branch `feat/need-human` goes into `main`
with `Closes #2255`; each slice is a sub-PR from `feat/need-human--<slice>` into the feature branch,
with `Part of #2255`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A runner job stores the questions it asks, reads Need human once it ends with them open, and the first person to answer queues its resume in the same transaction | `supabase/migrations/` `supabase/database.types.ts` `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/app/api/runners/jobs/[id]/` `apps/galaxy/src/runners/page/model.` | — | 1 | deep |
| s2 | A bug fix or mega bug fix that stops for a decision on a runner asks on its job with `omni runner ask`, and its `--answers` resume reads them with `omni runner answers` | `kit/bin/commands/runner` `kit/lib/runner/api` `kit/lib/runner/questions` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/test/need-human` `kit/test/mega-bug-fix-product.test.ts` | — | 1 | build |
| s3 | The Runners page shows Need human with its button, and the drawer answers or dismisses the job's questions | `apps/galaxy/src/runners/page/` `apps/galaxy/app/app/runners/` `docs/guide/runners.md` `.omni-loop/knowledge/design/screens/runner-need-human` `.omni-loop/knowledge/design/screens/runners` | s1 | 2 | build |
| s4 | Runners in the sidebar counts the workspace's jobs waiting for an answer | `apps/galaxy/src/waiting/` `apps/galaxy/app/api/waiting/runners/` `apps/galaxy/src/nav/sidebar` `apps/galaxy/src/nav/Sidebar` `.omni-loop/knowledge/design/screens/app-shell` | s1 | 2 | build |

**Shared ground.** `apps/galaxy/src/runners/page/model.ts` and `model.test.ts`: s1 adds `human` to
the job outcomes, so it maps the new value in `OUTCOME_WORDS` and `statusTone` for the page to keep
typechecking (Need human, tone `wait`); s3 owns the rest of the page and builds on it in wave 2. No
other prefix is declared twice: s2 talks to s1's routes over HTTP through a stubbed API in its tests,
and s4 reads `runner_job_questions` through the waiting repository, not through s1's files.
`kit/dist/` and `apps/omni-app/api/` are rebuilt by the wave, never listed. s3's drawer reuses the
Questions page's question and option parts from `apps/galaxy/src/ask/` and changes nothing there.

## Per slice: done when

### s1 (deep: a migration and a locking transaction) (`ui: yes`)

It follows BR-PRODUCT-12 (a stored answer never changes) and BR-PRODUCT-94 (no terminal token marks
an answer as given) on its own new rows and routes, and changes neither law nor the tests that
enforce them (`apps/galaxy/src/ask/rounds-sql.test.ts`, `apps/galaxy/src/ask/api.test.ts`).

- A new migration, dated after the newest on `main` (`node scripts/migration-order.ts`), adds
  `runner_job_questions` (job, workspace, issue, lead, questions, answers, answered or dismissed by,
  when, resume job), its RLS (the workspace's members read, only the service role writes), adds
  `human` to `runner_jobs_outcome_check`, and creates `runner_job_answer(p_job, p_answers, p_by)` and
  `runner_job_dismiss(p_job, p_by)`. `runner_job_answer()` locks the row, refuses a closed row with
  who closed it, queues `/omni:<skill> #<issue> --answers <job>` to the first job's repository and
  target, sent by `p_by`, and stores the answers and the resume job, all in one transaction; a refused
  queue stores nothing. A migration test beside `runners.migration.test.ts` reads the table, the RLS,
  both functions and the check; `supabase/database.types.ts` is regenerated.
- The contract (`runners.contract.test.ts`): the questions in `omni ask`'s file shape (1 to 4, each
  with a header and 2 to 4 options, each a label and a description), the answers (one per question,
  at most 2,000 characters), the lead, the issue, and `human` in `JOB_OUTCOMES`.
- The repository (`runners.repository.test.ts`): the insert, the reads by job and by workspace, the
  calls to both functions with every argument, and a refusal read by its code.
- The service (`runners.service.test.ts`): questions are refused from another runner and for a job
  that is not running; a job reported `done` with an open row stores outcome `human`, and a failed or
  cancelled one does not; the first answer wins and a second reads `Already answered by <name>` (or
  `Dismissed by <name>`); the resume line and target are checked as a person's Send checks them, and a
  refusal stores nothing; dismiss closes the row with no job queued; a job waiting for an answer is
  listed on the board past the last 50 ended jobs.
- The routes `POST`/`GET /api/runners/jobs/<id>/questions` (runner sign-in, same workspace),
  `POST /api/runners/jobs/<id>/answers` and `POST /api/runners/jobs/<id>/dismiss` (a person's session
  only) answer 200, 400, 401, 403, 404 and 409 as `runners.controller.test.ts` pins; a kit or runner
  token is refused on answers and dismiss; a member of another workspace reads no question.
- `runners.client.ts` posts answers and dismissals for the page (`runners.client.test.ts`).
- `model.ts` reads a done job with outcome `human` as Need human, tone `wait` (`model.test.ts`).

### s2

- `omni runner ask --file <file> --issue <n> --lead <file>` reads `OMNI_JOB`, checks the file against
  `omni ask`'s schema (`kit/lib/ask/schema.ts`), posts to `POST /api/runners/jobs/<job>/questions`
  with the runner's sign-in, exits 0 once stored and 1 with the server's words otherwise;
  `kit/bin/commands/runner.test.ts` runs it through `main()` on an `acme/widgets` fixture with a
  stubbed API: a valid file, more than 4 questions, an option with no label, no `OMNI_JOB`, a 409 and
  a 404.
- `omni runner answers <job>` prints the questions and answers as JSON from
  `GET /api/runners/jobs/<job>/questions`, and exits 1 with one line when the row is not found.
- `bug-fix/SKILL.md` and `mega-bug-fix/SKILL.md` (plan-repository mode), at their stop for a
  decision, when `OMNI_UNATTENDED` is set and there is an issue: write 1 to 4 questions whose last
  option is Design it first ("Stop here and brainstorm the behaviour"), run `omni runner ask`, post the
  stop comment starting with `<!-- omni-bug:need-human -->` and ending
  `Waiting for an answer on Omni: <Runners link with ?answer=<job>>`, and exit 0; on exit 1, post
  today's comment with the brainstorm line. Run by a person in a terminal, the stop is unchanged.
- With `--answers <job>`, either skill reads `omni runner answers`, stops with its line when they
  cannot be read, posts `Decided in Omni by @<login>` with each answer under
  `<!-- omni-bug:decision -->`, and carries on from its triage; Design it first stops with the
  brainstorm line; another decision asks again. It opens pull requests and merges none.
- A kit test (`kit/test/need-human*.test.ts`) pins both skills' stop and resume text: the markers, the
  two commands, the fallback and the `--answers` flag.

### s3 (`ui: yes`)

- A done job with outcome `human` reads **Need human**, filled in `--ask-plasma`, with a **Need human**
  button; once answered or dismissed it reads Done; a failed or cancelled job that asked shows no
  button (`model.test.ts`, `render.test.ts`).
- The button, or `?answer=<job>` on `/app/runners`, opens the drawer over the right side of the page:
  the header `Need human · <repo> · #<issue>` linking the issue, the lead, each question with its
  options (one, or several when `multiSelect`) and a free answer of at most 2,000 characters,
  **Dismiss**, and **Send answers**, disabled until every question has an answer.
- Send answers posts the answers, closes the drawer, and the resume job shows queued; a closed row
  reads Already answered by (or Dismissed by) the person with neither button; a refused resume reads
  the service's words in the drawer; Dismiss closes it with no job queued.
- The focus moves into the drawer on open, Tab stays inside it, and Escape, the close button or a
  click on the dimmed page closes it and gives the focus back to the button (`render.test.ts`).
- The demo Runners page shows a Need human job, and a manual pass checks the drawer at 1440 px and
  393 px in Omni, Light and Dark.
- `docs/guide/runners.md` says what Need human means and how to answer; the draft screens
  `runner-need-human` and `runners` name the files that build them in `implements`.

### s4 (`ui: yes`)

- `GET /api/waiting/runners` returns the number of the workspace's open job questions, for a member's
  session only (`waiting.controller.test.ts`, `waiting.service.test.ts`, `waiting.repository.test.ts`).
- Runners in the sidebar carries the count as a badge, read every 15 seconds as the approvals badge
  is, spoken `Runners: <n> waiting`, and gone at zero (`sidebar.test.ts`, `Sidebar.render.test.ts`).
- The count drops once a question is answered or dismissed, and counts a job past the board's last 50
  ended jobs.
