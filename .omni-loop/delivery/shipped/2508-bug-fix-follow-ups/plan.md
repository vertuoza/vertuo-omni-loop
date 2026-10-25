# Plan: A bug fix's follow-ups reach the API, for the app that sent it to launch a fix on each

PRD #2508, its spec beside this plan (`spec.md`). The feature branch `feat/bug-fix-follow-ups`
merges into `main` with `Closes #2508`; each slice is a sub-PR from
`feat/bug-fix-follow-ups--<slice>` into the feature branch, with `Part of #2508`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The database keeps a job's follow-ups: `runner_jobs.follow_ups`, an array of at most five entries, `[]` by default | `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `.github/workflows/supabase.yml` | — | 1 | build |
| s2 | `/omni:bug-fix` and `/omni:mega-bug-fix` write one `Follow-up: <repos> · <summary>` line per problem the run saw and did not fix, and the runner reads them and reports `followUps` in its ending report | `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/lib/runner/` `kit/test/bug-fix-outcome` | — | 1 | build |
| s3 | The server stores a done report's `followUps`, and `GET /api/v1/jobs/{id}` returns `follow_ups`, always an array | `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/src/public-api/` | s1, s2 | 2 | build |
| s4 | The guide says what `follow_ups` is and how an app fixes one: a new issue that says `Follow-up of <issue>`, then a bug fix or a mega bug fix | `docs/guide/api.md` | s3 | 3 | light |

**Shared ground.** No prefix is declared by two slices. The report's shape is named twice: the
kit's `kit/lib/runner/api.ts` (s2) sends `followUps` and galaxy's `runners.contract.ts` (s3) reads
it; s3 waits for s2, so it reads the shape s2 settled. `supabase/database.types.ts` is s1's alone;
s3 reads it. `runners.migration.test.ts` (s3) reads the migration s1 writes; s3 waits for s1.
`kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them, and the wave rebuilds them
once.

## Per slice: done when

### s1

- A migration `<version>_bug_fix_follow_ups.sql`, dated after the newest on `main`
  (`node scripts/migration-order.ts`; conventions › A new migration takes the next free version),
  whose header names its rollback, adds `runner_jobs.follow_ups jsonb not null default '[]'` with a
  check that it is an array of at most five entries, named after `runner_jobs.prs` (spec ›
  Conventions).
- `supabase/checks/bug_fix_follow_ups.sql`, its own step of the `supabase` workflow's `check` job,
  proves: a new job reads `[]`; a sixth entry and a value that is not an array are refused; a member
  of another workspace reads none of it, and only the service role writes the column (acceptance 5).
- `supabase/database.types.ts` is what `node scripts/supabase-types.ts` writes from a fresh local
  database (conventions › The database types are generated, never written).

### s2

- `/omni:bug-fix` (**The outcome line** and step 13) and `/omni:mega-bug-fix` (**The outcome line**
  and step 10) define the `Follow-up:` line and its rules: one line per problem, plain text, the
  repositories as `owner/name` comma-separated with no space, ` · `, one sentence of what the run
  saw and never a guess or a `Maybe:`, never the bug the job fixed, no customer's, tenant's or
  person's name and no secret, at most five, at any outcome (acceptance 6).
- `kit/test/bug-fix-outcome-lines.test.ts` fails when either skill drops the line or one of its
  rules, and reads each skill's example line through `bugFixReading` (acceptance 6).
- `bugFixReading` in `kit/lib/runner/log.ts` returns `followUps: {repos, summary}[]`, tested on
  fixtures in `log.test.ts`: a valid line, two lines in order, a timestamped line, each line that
  does not read (no ` · `, a repository that is not `owner/name`, more than ten repositories, an
  empty summary) skipped, a summary over 300 characters cut to 300, a duplicate kept once, six lines
  keeping five, and `outcome`, `fixedBy` and `prs` unchanged (acceptance 2).
- On fakes, `kit/lib/runner/runner.ts` (`bugFixFields`) sends `followUps` in a done bug fix's and
  mega bug fix's ending report; a yolo job, a bug fix with none and a refused report send none; a
  server refusing the field gets the report without it, its other fields kept (acceptance 4).

### s3 (`ui: yes`)

- `JobUpdateSchema` accepts `followUps` (at most five, each `repos` 1 to 10 `owner/name`, each
  `summary` 1 to 300 characters) and refuses anything else, in `runners.contract.test.ts`.
- `reportPatch` writes them on a `done` report only, as it writes `outcome`; the repository's row
  schema and `JOB_COLUMNS` read the column, and `keyDidOf` carries it as `KeyJob.followUps`.
- `GET /api/v1/jobs/{id}` returns `follow_ups: [{repos, summary}]`, in order: both entries of a job
  with two (acceptance 1), and `[]` for a job with none, a job of another skill and a row from an
  older runner, every other field reading as before (acceptance 3), in
  `public-api.service.test.ts` and `public-api.contract.test.ts`.
- The OpenAPI document lists `follow_ups` in the job's field list (`openapi.test.ts`, acceptance 7);
  `pnpm schemas:verify` passes with the new returned column and its readers (conventions › A new
  returned column lands with its readers).

### s4 (light: the guide only)

- `docs/guide/api.md` (**Read what a job did**) lists `follow_ups` and says how an app fixes one:
  file an issue that says `Follow-up of <the first issue>`, then start a bug fix on its one
  repository, or a mega bug fix on the plan repository when it names several; each follow-up is its
  own issue, bug folder and record (acceptance 7).
- Its fixtures are fictional (`demo-org/…`), and nothing the guide names is missing from the API
  s3 built.
