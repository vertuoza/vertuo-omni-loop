---
prd: 2508
title: A bug fix's follow-ups reach the API, for the app that sent it to launch a fix on each
blocked-by: none
spec: file
phase0: server
areas: [access]
---

## Problem

A bug fix or a mega bug fix often finds a second problem on its way and leaves it alone, as it
should: its fix stays one cause, one pull request per target. A plan repository's issue #386 is
one. Its mega bug fix moved the REST error handler's log of bad input from error to warning, and its
hand-off ended on a paragraph the skills never asked for:

> **Not fixed, and worth a separate ticket:** the kernel's Peppol check still sends company data
> that the e-invoicing service rejects (4,110 times), and it reads every rejection as "not
> registered".

That paragraph is free text in the job's log. The public API (PRD 2425) gives an app the job's
`outcome`, `fixed_by`, `prs` and a `log_tail`, but nothing a program can read for "here is another
problem, in these repositories". So the app that sent the job, Patcho in nimbus-buddies (its
PRD 397), cannot offer the person who launched it the obvious next step, *fix that one too*, without
parsing prose a kit release may reword. The person has to read the hand-off, write a new issue and
launch a new fix by hand, and the second fix loses its link to the ticket that found it.

Today's skills (`kit/plugin/skills/bug-fix/SKILL.md` step 13, `mega-bug-fix/SKILL.md` step 10) have
no follow-up line at all: their structured lines are `Outcome:`, `Fixed by:` and `PR:`
(`kit/lib/runner/log.ts`, `bugFixReading`).

## Solution

Additive only, as PRD 2425: every field, route and refusal of today's public API keeps its meaning.
Omni files nothing and launches nothing: it says what the run found, and the app decides.

1. **The skills write their follow-ups as lines.** At their hand-off, `/omni:bug-fix` and
   `/omni:mega-bug-fix` write one line per problem the run saw and did not fix, each a line of its
   own, plain text, never bulleted or bolded, as `Outcome:` is:

   ```text
   Follow-up: demo-org/nimbus-backend-php · The kernel's Peppol check sends company data the e-invoicing service rejects (4,110 times) and reads every rejection as "not registered".
   ```

   - **The repositories:** one or more `owner/name`, comma-separated with no space, the ones the
     problem lives in, as far as the run saw. One repository is a bug fix's; several, a mega bug
     fix's. The app reads that, not the model.
   - **` · `**, then **the summary:** one sentence of what the run saw: a count, a file, a log line,
     a check. Never a guess: a `Maybe:` never becomes a follow-up.
   - **Never** the bug the job fixed, never a customer's, a tenant's or a person's name, never a
     secret: the summary is read by an app outside the workspace's page.
   - **At most five**, at any outcome (a `stuck` or `already-fixed` run may have seen one too).
   - The prose paragraph a person reads may stay: the line is for the program.
2. **The runner reads them.** `bugFixReading` gains `followUps: {repos, summary}[]`, read from every
   `Follow-up:` line of a `bug-fix` or `mega-bug-fix` job's log, in order:
   - a line that does not read (no ` · `, a repository that is not `owner/name`, more than ten
     repositories, an empty summary) is skipped;
   - a summary longer than 300 characters is cut to 300;
   - a summary seen twice is kept once, the first five kept.

   The exit-0 report sends them beside `outcome` and `fixedBy`; an empty list is left out, as
   `bugFixFields` leaves out an empty `prs`. A server that refuses the field gets the report without
   it, as `runner.ts` strips PRD 2425's fields today.
3. **The job keeps them.** A migration adds `runner_jobs.follow_ups jsonb not null default '[]'`,
   an array of at most five entries, which the database checks. `JobUpdateSchema` accepts
   `followUps` (at most five, each `repos` 1 to 10 `owner/name`, each `summary` 1 to 300
   characters); `reportPatch` writes them only on a `done` report, as it writes `outcome`.
4. **The API returns them.** `KeyJob` gains `followUps`, and `GET /api/v1/jobs/{id}` gains
   `follow_ups: [{repos: ["owner/name"], summary}]`, always an array, empty for a job with none, a
   job of another skill, or a runner on an older kit. `openapi.ts` describes it, and
   `docs/guide/api.md` (**Read what a job did**) says what it is and how an app fixes one: file an
   issue that says `Follow-up of <the first issue>`, then start a bug fix on its one repository, or
   a mega bug fix on the plan repository when it names several. Each follow-up is its own issue, its
   own bug folder and its own record: one issue never carries two fixes.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | kit log | `Follow-up: <repos> · <summary>` | no written convention: follows `OUTCOME_LINE` and `FIXED_BY_LINE` ← `kit/lib/runner/log.ts:108-109` |
| omni-loop | runner report | `followUps`, each `{repos, summary}` | camelCase report fields ← `JobUpdateSchema`, `apps/galaxy/src/runners/runners.contract.ts:222-226` (`fixedBy`, `prs`) |
| omni-loop | public API | `follow_ups`, each `{repos, summary}` | snake_case public fields ← `apps/galaxy/src/public-api/public-api.contract.ts:197-202` (`fixed_by`) |
| omni-loop | database | `runner_jobs.follow_ups` | no written convention: follows `runner_jobs.prs` and `.fixed_by` ← `supabase/migrations/20261228090000_api_key_job_control.sql:61` |
| omni-loop | database | migration `<version>_bug_fix_follow_ups.sql` | conventions › A new migration takes the next free version ← `.omni-loop/knowledge/playbook/conventions.md:45` |
| omni-loop | database check | `supabase/checks/bug_fix_follow_ups.sql` | conventions › A new database check runs in CI ← `.omni-loop/knowledge/playbook/conventions.md`, beside `supabase/checks/api_key_jobs.sql` |

## Decisions

Taken with the person during the brainstorm:

- **A follow-up is a new issue.** Launching a fix on it never reruns the first issue: a rerun of
  #386 resumes its fix plan (mega bug fix, **Resuming a stopped fix**), and `omni bug` refuses a
  second bug folder for one issue. The app files a new issue that says `Follow-up of #386`, with the
  same ticket key in its title, so the ticket gathers every pull request through its key, while Omni
  keeps one issue, one bug folder and one record per fix.
- **The app files and launches, Omni says.** The caller (Patcho, through Buddies' GitHub App) files
  the follow-up issue and starts the job with `POST /api/v1/bug-fixes` or `/mega-bug-fixes`, as it
  does for the first. Omni gains no route: no issue is filed by Omni, and no job starts without a
  person's click in the app.
- **Two PRDs.** This one is Omni's side. Patcho's offer, its button and the follow-up issue are a
  PRD of nimbus-buddies, blocked by this one.
- **The repositories travel with the line,** so the app chooses bug fix or mega bug fix by code, as
  Patcho's PRD 397 chooses from its orientation, never from the model's prose.
- **The voice's objection, accepted.** persona:B-E DEv: "If the model can write a follow-up on every
  run, we'll launch runners chasing fluff, which is what I already hold against AI tools." Settled
  `accepted`: a follow-up states what the run saw, never a guess or a `Maybe:`, at most five, and a
  person still chooses to launch each one.
- **No video.** The person said no to the proof question: nothing here shows in a browser.

Taken without asking, the most reversible option:

- **Any outcome carries follow-ups,** not only `pr-opened`: a run that stops `stuck` or
  `already-fixed` may have seen a second problem too.
- **Cut, not dropped.** A summary over 300 characters is cut to 300 rather than dropped, so a long
  sentence still reaches the app.
- **Not on Omni's pages.** The Runners page and the bug page do not show follow-ups yet; `log_tail`
  and the Runners page's lines already show the hand-off's text.

## User stories

- As the person who launched a fix from an app, I see the problems the run found and did not fix,
  each with the repositories it touches, so I can launch a fix on one in one click.
- As an app holding a workspace key, I read `follow_ups` on the job and choose bug fix or mega bug
  fix from its repositories, without parsing the hand-off's prose.
- As a back-end developer, I only see follow-ups the run backed with something it saw, never a guess.
- As a client built on PRD 2425's API, I keep working unchanged: the new field is an array I may
  ignore.

## Scope

In:

- the `Follow-up:` line and its rules in `bug-fix/SKILL.md` (**The outcome line** and step 13) and
  `mega-bug-fix/SKILL.md` (**The outcome line** and step 10);
- `kit/lib/runner/log.ts` (`bugFixReading`), `runner.ts` (`bugFixFields`), `api.ts` (`JobUpdate`);
- the migration, its database check and the generated `supabase/database.types.ts`;
- `runners.contract.ts` (`JobUpdateSchema`, `KeyJob`), `runners.service.ts` (`reportPatch`,
  `keyDidOf`), `runners.repository.ts` (row schema, `JOB_COLUMNS`);
- `public-api.contract.ts` (`JobSchema`), `public-api.service.ts` (`jobOf`), `openapi.ts`;
- `docs/guide/api.md`;
- the kit bundle rebuilt (`kit/dist/`).

Out:

- filing the follow-up issue, the offer and the button: Patcho's PRD in nimbus-buddies;
- a route that launches a follow-up, or any link between the first job and the follow-up's job
  (`continues` stays a relaunch's);
- showing follow-ups on the Runners page or the bug page;
- follow-ups from any other skill (yolo, visual fix).

## Test seams

Following `omni kb show testing`: beside the code, on fixtures, never calling GitHub or Supabase.

- **A parser:** `kit/lib/runner/log.test.ts`: a valid line, two lines in order, a timestamped line,
  each line that does not read, a long summary cut to 300, a duplicate kept once, six lines keeping
  five, and the existing `outcome`, `fixedBy` and `prs` unchanged.
- **The report:** `kit/lib/runner/runner.test.ts`: a done bug fix sends `followUps`; a yolo job, a
  bug fix with none and a refused report send none; a server refusing the field gets the report
  without it.
- **The skills:** `kit/test/bug-fix-outcome-lines.test.ts`: both skills define the `Follow-up:` line
  and its rules, and their example line reads through `bugFixReading`.
- **The API boundary:** `runners.contract.test.ts` (valid and refused `followUps`),
  `runners.service.test.ts` (`reportPatch` writes them on done only; `keyDidOf` reads them),
  `runners.repository.test.ts`, `runners.migration.test.ts`, `public-api.service.test.ts`
  (`follow_ups` mapped, and `[]` for an older row), `public-api.contract.test.ts` and
  `openapi.test.ts` (the job's field list).
- **The database:** `supabase/checks/bug_fix_follow_ups.sql` proves the default `[]` and refuses a
  sixth entry and a value that is not an array.

## Risks

Merging publishes a migration on production Supabase (one column with its default and check), one
new field on `GET /api/v1/jobs/{id}`, and a kit release whose two skills write a new line. Rollback:
revert the merge; runners on the new kit write lines nobody reads, the field is gone, and a
follow-up migration drops the column. The field is additive, so a client that read it sees it
missing again, never a broken shape.

- **Words from a run reach an app.** A summary is the model's sentence, read by an app outside the
  page. The skills forbid a customer's, a tenant's or a person's name and any secret in it, and it
  is no wider than `log_tail`, which already carries the same hand-off to the same key.
- **Fluff.** A model could write follow-ups for nothing. The skills ask for what the run saw, at
  most five, and nothing launches without a person.
- **Old runners.** A runner on a kit from before this PRD reports none: the job reads
  `follow_ups: []`.

The Legal entries it touches:

- L-GDPR-1: only a workspace's members and keys read a job; the summary forbids personal data.
- L-AIACT-1: a follow-up is an agent's words; the app that files an issue from one says so (its
  PRD 397 ends each issue « Lancé depuis Buddies par … », and the job's hand-off is signed).
- L-GDPR-2: no credential is stored; the skills forbid a secret in a summary.

The locked laws it touches:

- BR-PRODUCT-63: an agent could read another team's private work; a key still reads its own
  workspace's key jobs only, and `follow_ups` is one more field of the same job. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent; a key
  still stops when its maker leaves. Changing it needs @pierrederval or @dervalp to approve the
  pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user; nothing here merges, and a follow-up's fix ends
  in its own pull request a person merges. Changing it needs @pierrederval or @dervalp to approve
  the pull request on GitHub.
- BR-PRODUCT-12: the terminal acts on words a person no longer stands behind; no answer is read or
  written here. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59 and N-PRODUCT-16 govern every
  migration: this one links no GitHub account, opens no ask session, reads no session outside its
  workspace, shows no AI key and writes no ledger row. Changing them needs @pierrederval or @dervalp
  to approve the pull request on GitHub.

## Acceptance criteria

1. A `/omni:bug-fix` or `/omni:mega-bug-fix` job whose hand-off holds two `Follow-up:` lines ends
   with `GET /api/v1/jobs/{id}` returning `follow_ups` with both, in order, each with its
   repositories and its summary.
2. A `Follow-up:` line that does not read (no ` · `, a repository that is not `owner/name`, more
   than ten repositories, an empty summary) is not returned; a summary over 300 characters is
   returned cut to 300; a summary written twice is returned once; six lines return the first five.
3. A job with no `Follow-up:` line, a job of another skill, and a job reported by a runner on an
   older kit return `follow_ups: []`, and every other field of the job reads as before.
4. A runner reporting to a server that refuses `followUps` still ends its job, with the report's
   other fields kept.
5. The database refuses a `follow_ups` value that is not an array or holds more than five entries,
   and a new job reads `[]`.
6. Both skills define the `Follow-up:` line and its rules: the repositories, ` · `, what the run saw
   and never a guess or a `Maybe:`, never the bug it fixed, no customer's, tenant's or person's
   name and no secret, at most five; and their example line reads through `bugFixReading`.
7. The OpenAPI document and `docs/guide/api.md` list `follow_ups`, and the guide says how an app
   fixes one: a new issue that says `Follow-up of <issue>`, then a bug fix on its one repository or
   a mega bug fix on the plan repository.
