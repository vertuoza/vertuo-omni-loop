---
prd: 2270
title: A runner job waiting on answers fixes by itself once they are in
blocked-by: none
spec: file
phase0: server
---

## Problem

Since PRD 2223, a runner job that stops on open questions reads **Waiting on answers** on the
Runners page. That word is written once, when the job ends, and never changes: a person who answers
every question, on GitHub or on the PRD's page, still sees Waiting on answers, and nothing moves
until someone remembers to send `/omni:yolo-fix <n>`. On PRD 271 (vertuo-crew-domain), the answers
were in and the job row still waited.

## Solution

1. **The trigger is the touch the page already gets.** Every comment on a pull request reaches the
   Omni page as a touch, and the PRD's dossier is read again from GitHub (PRD 902). Once that read
   ends, the page decides whether the PRD **continues**.
2. **It continues** when all of these hold:
   - every open outbox item ranked `high` or `human-action` has a counted reply, as PRD 2223's
     `outboxStand` reads it (a reply held as undetermined, or from an author GitHub does not list as an
     owner, member or collaborator, does not count);
   - the PRD's newest runner job in that repository ended `done` with outcome `answers`;
   - no job of that PRD in that repository is queued, claimed or running;
   - that job has not been continued already;
   - the repository's switch **Fix on a runner once answered** is on.
3. **Then the page queues `/omni:yolo-fix <n>`,** once: to the same runner or fleet the job was sent
   to, sent by the person who sent it, and linked to it as its continuation. A fix that ends on new
   questions is itself continued the same way once those are answered.
4. **The Runners page:**
   - the job that waited reads **Answered · fixing**, linking the fix job (**Answered · fixed** once
     that job ended);
   - the fix job shows `after answers · job <8 characters>` under its line, linking the job it
     continues;
   - with the switch off, the job that waited reads **Answered** once every asked item is answered,
     with a **Fix with answers** button that sends `/omni:yolo-fix <n>` to the same runner and links
     it the same way. Until then it reads Waiting on answers, as today.
5. **The PRD page:** while the fix job is queued or running, the status line says `fixing on
   <runner>` in place of `answered`.
6. **The switch:** on Settings › Repositories, per repository, **Fix on a runner once answered**, on by
   default; whoever may change the other repository switches (Public ideas, Phase 0 on the server)
   may change it.
7. **When it cannot decide,** nothing is queued: the outbox or the replies unread, or the job not
   found. The next touch, or the 15-minute sync, decides again.

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | db column | `runner_jobs.continues uuid null references runner_jobs(id)`, unique | no written convention: follows `runner_jobs.runner_id` ← `supabase/migrations/20261208090000_runner_job_lines.sql` |
| vertuo-omni-loop | db column | `repositories.fix_when_answered boolean not null default true` | no written convention: follows `repositories.public_ideas` ← `supabase/migrations/20261115090000_ideas.sql` |
| vertuo-omni-loop | module | `apps/galaxy/src/runners/continue.ts` (`shouldContinue`) | no written convention: follows `apps/galaxy/src/runners/runners.service.ts` |
| vertuo-omni-loop | words | `Answered · fixing`, `Answered · fixed`, `Answered`, `after answers · job <id>`, `fixing on <runner>` | no written convention: follows `statusWords` ← `apps/galaxy/src/runners/page/model.ts:52` |

## Decisions

- **Automatic** (the person's choice), not a button alone: the runner should notice the answers and
  run the fix.
- **The voice's objection** (persona:F-E Developer: a runner rewriting a PR the moment an answer is
  typed, with nobody pressing anything) was **accepted**: a per-repository switch, on by default, and
  off it leaves a Fix with answers button; the fix job can always be cancelled from its row.
- **The same counting rule as the PRD page** (PRD 2223's `outboxStand`), so the page and the runner
  never disagree on whether a PRD is answered.
- **Once per job,** held by the database (a unique `continues`), so two touches at once never queue
  two fixes.
- **Sent by the job's sender,** to the job's runner or fleet: the fix runs where the build ran, in the
  same person's name.

## User stories

- As the person who answered, I see the row turn to Answered · fixing and the fix running, without
  sending anything.
- As someone who wants to look first, I turn the switch off for a repository and press Fix with
  answers when I am ready.
- As a reviewer on the Runners page, I see that a fix job came after answers, and which job it
  continues.

## Scope

In: the decision after a touch's read, the continuation link, the switch, the Runners rows, the PRD
page's `fixing on` line.
Out: continuing a job that ended Held, Failed or Ready; continuing a job not sent to a runner
(`/omni:yolo` run in a terminal); asking anyone before the fix starts.

## Test seams

Read with `omni kb show testing`. Unit tests, no GitHub call:

- `shouldContinue` (`continue.test.ts`): each condition alone failing; the switch off; held and
  uncounted replies; an unread outbox; a job already continued.
- The service (`runners.service.test.ts`): the fix queued to the same runner or fleet, by the sender,
  with `continues` set; a second attempt refused by the unique column.
- The touch (`touched.test.ts`): a refreshed dossier that continues queues one fix; one that does not
  queues none.
- The migration (`runners.migration.test.ts`): both columns, the unique index, the default.
- The Runners page (`model.test.ts`, `render.test.ts`): Answered · fixing / fixed, Answered with the
  button, the fix job's `after answers` line.
- The PRD page (`stage.test.ts`): `fixing on <runner>`.
- The settings page (`repositories` tests): the switch shown and saved.

## Risks

- **A job starts without a person pressing a button:** bounded by the switch, the once-per-job column
  and Cancel. Rolled back by turning the switch off, or by reverting.
- **A stored shape changes:** two columns; dropping them rolls back.
- **Published by merging:** the Omni app on deploy. No kit change: the runner runs the queued line as
  any other.

The locked laws this touches: **BR-PRODUCT-3** (an agent never applies the override label itself) and
**BR-PRODUCT-5** (a feature stays a draft while any question is open) are read, never changed: the
fix job settles answers a person gave, and the feature PR leaves draft only through yolo-fix's own
gate. If either were broken, work could be waved through with nobody answering. Changing either needs
@pierrederval to approve the pull request on GitHub. The other locked laws are untouched.

## Acceptance criteria

1. With the switch on, once every asked item of a PRD has a counted reply and its newest runner job
   ended on Waiting on answers with nothing queued or running, exactly one `/omni:yolo-fix <n>` is
   queued to that job's runner or fleet, sent by its sender, linked as its continuation.
2. A held or uncounted reply, an unread outbox, a job already continued, or a job of that PRD queued or
   running queues nothing.
3. The job that waited reads Answered · fixing, then Answered · fixed, linking the fix; the fix job
   reads `after answers · job <id>`.
4. With the switch off, the row reads Answered with Fix with answers, which queues the same linked fix.
5. The PRD page reads `fixing on <runner>` while the fix is queued or running.
6. The switch shows on Settings › Repositories, on by default, and saves per repository.
