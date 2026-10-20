---
prd: 2255
title: A stopped bug fix asks for a human answer on its job, then resumes with it
blocked-by: none
spec: file
phase0: server
---

## Problem

`/omni:bug-fix` and `/omni:mega-bug-fix` run on runners with no one watching: an API key sends them
(`POST /api/v1/bug-fixes`, `POST /api/v1/mega-bug-fixes`, PRD 2022), and vertuo-cleaner sends one per
error group. When the right behaviour is a decision, not a restoration, both skills stop by design
(`bug-fix/SKILL.md` › The stop, `mega-bug-fix/SKILL.md` › the design boundary). They post a comment on
the issue that ends with a `/omni:brainstorm` or `/omni:mega-brainstorm` line, and the job ends **Done**,
with no pull request.

Nobody is told. The Runners page shows the job as Done, like a fix that worked. The only trace is a
comment on a GitHub issue that nobody watches, and its next step needs a person at a terminal. The
automation stops at the first bug that needs a choice.

The first real case was vertuoza/vertuo-automation-plan#314, on 2026-10-20. The planning query fails
for 31 tenants. The agent found the cause and three ways to fix it: make `project` nullable, drop the
access check, or filter out the assignments the user may not see. It could not pick one alone, and
nothing in Omni asked anyone.

## Solution

**At the stop.** When either skill reaches its stop for a decision, runs on a runner (`OMNI_UNATTENDED`
set) and has an issue, it asks on its job before it ends:

1. It writes 1 to 4 questions, in the file shape `omni ask question --file` already reads
   (`kit/lib/ask/schema.ts`): each question has a header and 2 to 4 options. Each option is one fix it
   found, with a one-line description of what it changes. The last option is always
   **Design it first**, described as "Stop here and brainstorm the behaviour". A free answer is always
   possible, as on the Questions page.
2. It sends them with `omni runner ask --file <file> --issue <n> --lead <file>`. The lead is one
   paragraph saying why it stopped, in the words of the stop comment. The command reads `OMNI_JOB`,
   which the runner already gives each job (PRD 2175), and posts to
   `POST /api/runners/jobs/<job>/questions` with the runner's sign-in. It exits 0 once they are
   stored, and 1 with the server's words otherwise.
3. It posts the stop comment on the issue, as today. The comment starts with
   `<!-- omni-bug:need-human -->`, and its last line becomes `Waiting for an answer on Omni: <the
   Runners page link with ?answer=<job>>` in place of the brainstorm line.
4. It ends with exit 0.

When `omni runner ask` exits 1 (an old Omni app, a refusal), the skill posts today's stop comment, with
the brainstorm line, and ends as it does today. Run by a person in a terminal, neither skill changes.

**On the server.** A new table, `runner_job_questions`, holds one row per asking job: the job, the
workspace, the issue number, the lead, the questions, and once someone acts, the answers, who
answered or dismissed, when, and the job that resumed it. When the runner reports the job `done` and
its row is still open, the server stores the job's outcome as **`human`**, beside `answers`, `held`
and `ready` (PRD 2223).

**On the Runners page.**

- The job reads **Need human** in `--ask-plasma`, in place of Done, and its action is a
  **Need human** button.
- "Runners" in the sidebar carries a badge: the number of jobs in the workspace waiting for an answer,
  spoken "Runners: N waiting". It is read every 15 seconds, as the approvals badge is.
- A job waiting for an answer stays on the board whatever its age; the board's last 50 ended jobs do
  not count it.
- Nobody is notified: the badge and the job are the signal.

**The drawer.** The button opens a panel over the right side of the page, the way the Terminal panel
opens, and sets `?answer=<job>` on the URL, so the issue's link opens it directly. The drawer holds:

- the header `Need human · <repo> · #<issue>`, linking the issue, and a close button;
- the lead paragraph;
- each question with its options, picked one at a time (or several when `multiSelect`), and a free
  answer of at most 2,000 characters;
- **Send answers**, its one primary action, enabled once every question has an answer;
- **Dismiss**, which closes the question with no resume.

It moves the focus inside itself when it opens, keeps Tab inside it, and gives the focus back to the
button on close (Escape, the close button, a click on the dimmed page).

Any member of the workspace may answer or dismiss. **Send answers** posts to
`POST /api/runners/jobs/<job>/answers`, with the person's session only. The service checks the resume
line and the target as a person's Send does, then calls `runner_job_answer()`, which, in one
transaction:

1. locks the row and refuses it when it is no longer open (answered or dismissed);
2. queues the resume job: the line `/omni:<skill> #<issue> --answers <job>`, the same repository, the
   same target (the runner or the fleet the first job went to), sent by the person who answered;
3. stores the answers, who answered, when and the resume job.

The drawer then closes, and the resume job shows on the board, queued. A second person who sends
answers to a closed row reads `Already answered by <name>` (or `Dismissed by <name>`), and nothing is
queued. A refusal of the resume line or the target stores nothing and reads in the drawer in the
service's words.

**At the resume.** Run with `--answers <job>`, either skill:

1. reads the questions and the answers with `omni runner answers <job>`, which prints them as JSON
   from `GET /api/runners/jobs/<job>/questions` with the runner's sign-in, in the same workspace. When
   they cannot be read, it stops with that line and touches nothing;
2. posts on the issue `Decided in Omni by @<login>`, then each question and its answer, starting with
   `<!-- omni-bug:decision -->`;
3. carries on from its triage, with the answers as the behaviour wanted. The fix plan, the red test,
   the fix and the pull requests run as written, and a person still merges each pull request;
4. when the answer is **Design it first**, it stops with today's brainstorm line on the issue, and the
   job reads Done;
5. when it meets another decision, it asks again, in the same way: the resume job gets its own
   Need human.

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | db table | `runner_job_questions` | no written convention: follows `runner_job_lines` ← `supabase/migrations/20261208090000_runner_job_lines.sql:20` |
| vertuo-omni-loop | db function | `runner_job_answer(p_job, p_answers, p_by)`, `runner_job_dismiss(p_job, p_by)` | no written convention: follows `runner_claim(p_runner)` ← `supabase/migrations/20261207100000_runners.sql:94` |
| vertuo-omni-loop | db value | outcome `human`, added to `runner_jobs_outcome_check` | no written convention: follows `answers`, `held`, `ready` ← `supabase/migrations/20261217090000_runner_outcome.sql:14` |
| vertuo-omni-loop | migration file | `20261218090000_runner_job_questions.sql` | the newest on `main` is `20261217100000_archive_product.sql`; re-dated with `node scripts/migration-order.ts` when needed |
| vertuo-omni-loop | kit command | `omni runner ask`, `omni runner answers` | no written convention: follows `omni runner sender` ← `kit/bin/commands/runner.ts:26` |
| vertuo-omni-loop | route | `POST /api/runners/jobs/<id>/questions`, `GET` same, `POST /api/runners/jobs/<id>/answers`, `POST /api/runners/jobs/<id>/dismiss` | no written convention: follows `POST /api/runners/jobs/<id>/cancel` ← `apps/galaxy/app/api/runners/jobs/[id]/cancel/route.ts` |
| vertuo-omni-loop | waiting route | `GET /api/waiting/runners` | no written convention: follows `GET /api/waiting/approvals` ← `apps/galaxy/app/api/waiting/approvals/route.ts` |
| vertuo-omni-loop | skill flag | `--answers <job>` | no written convention: follows the skills' `--prd <n>` flag ← `kit/plugin/skills/mega-bug-fix/SKILL.md:3` |
| vertuo-omni-loop | comment markers | `<!-- omni-bug:need-human -->`, `<!-- omni-bug:decision -->` | no written convention: follows `<!-- omni-bug:triage -->` ← `kit/plugin/skills/bug-fix/SKILL.md:139` |
| vertuo-omni-loop | words | `Need human`, `Send answers`, `Dismiss`, `Already answered by <name>`, `Design it first` | no written convention: follows `Waiting on answers` ← `apps/galaxy/src/runners/page/model.ts:52` |

## Decisions

- **Anyone in the workspace may answer** (the person chose it over the product's approvers or a new PO
  role). The answer is posted on the issue with the answerer's login, and every pull request it leads
  to is still reviewed and merged by a person.
- **Nobody is notified** (the person chose it over notifying the approvers and the sender): the
  sidebar badge and the job are the signal.
- **The button lives on the job, on the Runners page** (chosen over a page of its own and the bug's
  page). The mega bug fix of a plan repository has no dossier to hang it on, and every job already has
  a row there.
- **The resume is a new job** (chosen over resuming the same Claude session). It runs on any runner
  that holds the repository, and the issue already holds the triage and the analysis. The old job's
  worktree is not kept.
- **Questions live on the job,** in a table of their own (approach A, chosen over reusing `ask_rounds`,
  which belong to an interactive session and its owner, and over answering by issue comment). The
  question and answer shapes are `omni ask`'s, so the drawer reuses the Questions page's parts.
- **The signal is the stored questions, not the last line.** The server sets the outcome when the job
  ends with an open row, so the skill's printed text stays free and an old runner needs no change.
- **The first answer wins, and an answer never changes** (BR-PRODUCT-12): `runner_job_answer()` takes
  the row's lock and refuses a closed row. **Dismiss** exists so a question nobody will answer leaves
  the badge.
- **The answer queues the resume in the same transaction**, so a stored answer always has its job and a
  refused resume stores no answer.
- **The voice's objection** (persona:Lead Engineer: anyone settling a choice that touches access or a
  contract, with nobody told, means the team learns of it from a pull request) was settled **none**:
  the person judged the guards enough, the decision posted on the issue with its author, and the pull
  requests a person reviews and merges.
- **The product mode of mega-bug-fix (`--product`) is out:** it has no issue and no written stop at
  the design boundary yet.

## User stories

- As anyone in the workspace, I see a badge on Runners, open the job that reads Need human, read why
  the fix stopped, pick an option and press Send answers. The fix starts again on its own.
- As the person who set up vertuo-cleaner, a bug whose fix needs a choice no longer ends silently: it
  waits on the Runners page until someone answers.
- As a reviewer of the fix's pull requests, I read on the issue who decided what, and when.
- As a member who knows nobody should act on a question, I press Dismiss and the badge goes down.

## Scope

In:
- `bug-fix` and `mega-bug-fix` (plan-repository mode) on a runner: asking at the stop for a decision,
  and the `--answers` resume;
- `omni runner ask` and `omni runner answers`;
- the table, its two functions and the `human` outcome; the routes for questions, answers, dismiss and
  the waiting count;
- the Runners page: the Need human status and button, the drawer, a waiting job kept on the board, and
  the sidebar badge;
- the draft screens `runners`, `app-shell` and the new `runner-need-human`.

Out:
- any other skill's stop, including yolo's red outbox (PRD 2223's Fix with answers stays a person's
  press from the PRD page);
- mega-bug-fix with `--product`;
- notifications by push or email;
- points for answering a job's questions (BR-PRODUCT-78 counts the Questions page's answers only);
- resuming the same Claude session.

## Test seams

Read with `omni kb show testing`. Every test runs on fixtures, with no GitHub or Supabase call:

- **The kit commands** (`kit/bin/commands/runner.test.ts`, through `main()` on an `acme/widgets`
  fixture, with a stubbed API): `runner ask` with a valid file, a file refused (more than 4
  questions, an option with no label, no `OMNI_JOB`), a 409 and a 404 from the server; `runner answers`
  printing the questions and the answers, and a row not found.
- **The contract** (`runners.contract.test.ts`): the questions, the answers (one per question, at most
  2,000 characters), the resume line, the `human` outcome.
- **The repository** (`runners.repository.test.ts`): the insert, the reads, the calls to
  `runner_job_answer()` and `runner_job_dismiss()` with every argument, a refusal by its code.
- **The service** (`runners.service.test.ts`): questions refused from another runner or for a job not
  running; the outcome `human` set at done with an open row, not at failed or cancelled; the first
  answer wins; a refused resume stores nothing; dismiss; the waiting count; a waiting job past the last
  50 still on the board.
- **The controller** (`runners.controller.test.ts`): 200, 400, 401, 403, 404 and 409 for each route;
  a kit token refused on the answers and dismiss routes.
- **The migration** (a migration test beside `runners.migration.test.ts`): the table, its RLS (members
  read, nobody writes but the service role), both functions, the outcome check, dated after the newest
  on `main`; `supabase/database.types.ts` regenerated.
- **The page** (`model.test.ts`, `render.test.ts`): the Need human words, tone and button; the drawer's
  options, free answer, Send answers disabled until every question has an answer, Already answered by,
  a refusal, Dismiss, the focus moved in and given back, Escape; the sidebar badge (`sidebar.test.ts`).
- **The skills' text** (the kit's skill tests): the stop writes the marker, runs `omni runner ask`
  and falls back to the brainstorm line on exit 1; the resume reads `omni runner answers` and writes
  the decision marker.
- A manual pass on the demo Runners page, at 1440 px and 393 px, in each theme, for the drawer.

## Risks

- **A stored shape changes:** one new table, two functions, and one more value in a check. Rolled back
  by dropping the table and the functions and restoring the check; jobs that read `human` would read
  Done again once the value is mapped back.
- **Published by merging:** the Omni app on deploy (the routes, the drawer, the badge); the kit and
  both skills on the next release. A runner picks the new skills up when its plugin updates; until
  then its jobs stop as they do today.
- **A job runs again because a person answered,** not by itself: the Runners page's refusal "No job
  runs again by itself" still holds, Send answers being the press.
- **A wrong answer is acted on:** the fix still goes through its red test, its review and a person's
  merge.

The locked laws this touches, read and never changed:

- **BR-PRODUCT-12** (an answer never changes after it is given): a stored answer is never edited, and
  a second answer is refused. If broken: the run acts on words the person no longer stands behind, and
  nobody can tell what was decided. Changing it needs @pierrederval to approve the pull request on
  GitHub.
- **BR-PRODUCT-94** (a terminal token can never mark an answer as given on the page): the answers and
  dismiss routes accept a person's session only; a runner's token may only post questions and read
  answers. If broken: an agent could answer a question in a person's name. Changing it needs
  @pierrederval to approve the pull request on GitHub.
- **N-PRODUCT-15** (only a person merges into the main branch): the resumed fix opens pull requests and
  merges none. If broken: unreviewed work reaches every user, and nobody chose to ship it. Changing it
  needs @pierrederval to approve the pull request on GitHub.
- **N-PRODUCT-3** (a question an agent raises is graded by the gate's own check before it is written)
  governs outbox items; a job's questions are not outbox items, and `omni runner ask` checks them
  against `omni ask`'s schema before sending. If broken: a badly ranked question slips past, and the
  person who answers decides without the facts they need. Changing it needs @pierrederval to approve
  the pull request on GitHub.

The other locked laws `omni kb laws` printed for these files are untouched.

## Acceptance criteria

1. A bug-fix or mega-bug-fix run on a runner that stops for a decision stores 1 to 4 questions on its
   job, the last option of each being Design it first, posts the stop comment with
   `<!-- omni-bug:need-human -->` and the job's link, and ends with exit 0.
2. That job reads **Need human** on the Runners page with a Need human button, and the sidebar's
   Runners badge counts it, also once more than 50 jobs ended after it.
3. When `omni runner ask` fails, the skill posts today's stop comment with the brainstorm line, and the
   job reads Done.
4. The button, or `?answer=<job>` on the URL, opens the drawer with the lead, the questions, their
   options and a free answer; Send answers is enabled only once every question has an answer.
5. Send answers stores the answers with who answered, queues `/omni:<skill> #<issue> --answers <job>`
   to the same target, sent by that person, and closes the drawer; the new job shows queued.
6. A second answer, or an answer after Dismiss, reads Already answered by (or Dismissed by) the person,
   and queues nothing; a refused resume stores nothing and reads its refusal in the drawer.
7. Dismiss closes the question with no job queued, and the badge goes down.
8. A runner's token is refused on the answers and dismiss routes; a member of another workspace reads
   no question.
9. The resumed run posts `Decided in Omni by @<login>` with each answer under
   `<!-- omni-bug:decision -->` on the issue, then fixes with the answers as the behaviour wanted, and
   opens pull requests it never merges; Design it first ends it with the brainstorm line.
10. A failed or cancelled job that asked shows no Need human button.
11. A run by a person in a terminal stops as it does today.
