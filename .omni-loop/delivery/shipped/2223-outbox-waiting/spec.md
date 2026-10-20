---
prd: 2223
title: A red outbox waits on your answers, then fixes with them
blocked-by: none
spec: file
phase0: server
---

## Problem

When `/omni:yolo` builds every slice of a PRD but the outbox has open questions, the feature PR stays
a draft and the outbox check stays red, by design (BR-PRODUCT-5). Nothing says so plainly:

- **The runner job reads Done.** A yolo that stops on a red outbox exits 0, so the Runners page shows
  `Done` and a PR link, which is the last pull request URL in the log: often a sub-PR, not the feature
  PR. A person who sent `/omni:yolo 2213` saw Done on #2214 and could not tell it was waiting on them.
- **The PRD page hides where it stands.** While a question is open, the one button is **Answer the
  outbox**, a link with no caption, so the `3/3 slices` line disappears, and the feature PR's link never
  says it is a draft. Once the questions are answered, the button stays **Answer the outbox**: the next
  step, `/omni:yolo-fix <n>`, is nowhere on the header, and it cannot be sent to a runner from there.

The page already reads the replies `/omni:yolo-fix` will count (`summary.replies`), but the header never
looks at them.

## Solution

**On the PRD page,** at stage `building` or `outbox` while the feature PR's outbox has open items:

1. **The status line** keeps the slice count and adds where the outbox stands, each part its own
   short span: `Stage: building · 3/3 slices · 1 of 2 answered`. The count is of the
   **asked** items: those ranked `high` or `human-action`. A `medium` item is adopted unless someone
   objects, so it is never counted.
2. **The feature PR's link** reads `feature #2214 · draft` while the PR is a draft; the health chip
   stays beside it as today.
3. **The one button:**
   - while an asked item has no **counted reply**, it stays **Answer the outbox**, linking the outbox
     comment, as today;
   - once every asked item has one, it becomes **Fix with answers**: a copy button for
     `/omni:yolo-fix <n>`, with **Send to terminal** beside it, as **Build it** has. The status line
     then reads `Stage: building · 3/3 slices · answered`.
   - Under the button, one line names the answers yolo-fix will act on, in the outbox's numbering
     and in order: `Fixes with 1: A · 4: B`, linking the Outbox tab. A reply with a reason shows its
     letter only.
4. A **counted reply** is one the kit's reply reader would settle: from an author GitHub lists as an
   owner, member or collaborator, and not held as undetermined. A reply the reader only holds, or one
   from an author it does not count, leaves its item unanswered.
5. When the outbox or the replies could not be read, the header falls back to today's button and
   caption: nothing is guessed.

**On the Runners page,** a job running `/omni:yolo <n>` (or `/omni:yolo-fix <n>`) that ends with exit 0
gets an **outcome**, read by the runner from the last non-empty line of the run's final message, which
the yolo skill's hand-off always ends on:

| last line | outcome | the job reads |
| --- | --- | --- |
| `/omni:yolo-fix <n>` | `answers` | **Waiting on answers** |
| `/omni:yolo <n>` | `held` | **Held** |
| `/omni:pr-care <n>` | `ready` | **Ready** |
| anything else, or a line naming another PRD | none | **Done**, as today |

- The job's status stays `done`: the outcome is a new nullable field beside it, sent in the runner's
  report and stored on the job. A failed, cancelled or timed-out job carries none.
- A job with an outcome shows, beside its PR link, **PRD page**, linking the PRD's page on the Omni app
  (`/prd/at/<owner>/<repo>/<n>`), where the answers and the button are. The tone is the page's yellow
  (`--ask-plasma`) for `answers` and `held`, green for `ready`.
- A runner on an older kit sends no outcome: its jobs read Done, as today.

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | db column | `runner_jobs.outcome text null`, check `in ('answers', 'held', 'ready')` | no written convention: follows `runner_jobs.reason` and `release_error` ← `supabase/migrations/20261214090000_runner_released.sql` |
| vertuo-omni-loop | report field | `outcome: 'answers' \| 'held' \| 'ready' \| null` on `JobUpdateSchema` | no written convention: follows `released` / `releaseError` ← `apps/galaxy/src/runners/runners.contract.ts:136` |
| vertuo-omni-loop | kit function | `runOutcome(log, prd)` in `kit/lib/runner/log.ts` | no written convention: follows `lastPullRequest` ← `kit/lib/runner/log.ts:67` |
| vertuo-omni-loop | stage helper | `outboxStand(summary)` returning `{ asked, answered, answers }` or null | no written convention: follows `openOutboxOf` ← `apps/galaxy/src/dossier/page/stage.ts:39` |
| vertuo-omni-loop | button label | `Fix with answers` | no written convention: follows `Build it` ← `apps/galaxy/src/dossier/page/stage.ts:83` |

## Decisions

- **The switch waits on the asked items only** (the person's answer): `high` and `human-action`.
  Mediums are adopted unless someone objects, so waiting on them would hold every PRD for nothing.
- **The runner reads the hand-off's last line,** not GitHub (the person chose a new outcome over
  keeping Done). It is the one fixed signal the yolo skill already prints, and it needs no GitHub
  call from the runner. The job's status stays `done`, so no existing reader of `status` changes.
- **The PRD page link, not a better PR guess.** The PR link stays the last pull request in the log;
  the PRD page link is exact, read from the job's line, and leads to the answers.
- **The voice's objection** (persona:F-E Developer: one click sending yolo-fix to a runner must show
  which answers it acts on) was **accepted**: the `Fixes with 1: A · 4: B` line under the button.
- **A held reply does not count.** The kit holds a reply it cannot read (an undetermined answer) for
  a round; offering Fix with answers then would run a yolo-fix that settles nothing.

## User stories

- As the person who sent `/omni:yolo <n>` to a runner, I see **Waiting on answers** on the job and
  reach the PRD page in one click, so I know the run stopped on me, not on a bug.
- As the person answering, I see `1 of 2 answered` on the PRD page, and `feature #n · draft` on its link, then **Fix with answers** the
  moment I am done, and I send it to a runner from there.
- As a reviewer, I read `feature #n · draft` and know the PR is unfinished before I open it.

## Scope

In:
- the PRD page header's status line, feature PR link and one button at `building` and `outbox`;
- the runner's outcome: the kit reads it, the report carries it, the database stores it, the Runners
  page shows it with the PRD page link.

Out:
- the stage badge (`<k> questions waiting`), the Outbox tab and the outbox comment: unchanged;
- running yolo-fix by itself once answers are in: a person still presses the button;
- any change to when the feature PR leaves draft (BR-PRODUCT-5 stays as it is).

## Test seams

Read with `omni kb show testing`. All unit tests, no GitHub call:

- `outboxStand` and the stage actions (`stage.test.ts`): no open item; asked items with none, some
  and all counted; a reply only held; an uncounted author; mediums only (no switch needed: the button
  is today's); outbox or replies unread (fallback); the answers line's order and letters.
- The header render (`render.test.ts`): the status line, `· draft` on the link, Fix with answers with
  Send to terminal.
- `runOutcome` (`kit/lib/runner/log.test.ts`): each of the three lines, another PRD's number, trailing
  blank lines, no final message; `ended()` carries it on exit 0 only (`runner.test.ts`).
- The contract and the service (`runners.contract.test.ts`, `runners.service.test.ts`): outcome
  accepted, stored, read back; an unknown value refused.
- The migration (`runners.migration.test.ts`): the column, its check, the new migration dated after
  the newest on `main`.
- The Runners page model and render (`model.test.ts`, `render.test.ts`): each outcome's words, tone and
  the PRD page link; none on failed.

## Risks

- **A stored shape changes:** one nullable column on `runner_jobs`. Rolled back by dropping it; old
  runners and old rows carry null and read Done.
- **The last line changes in the yolo skill:** the outcome falls back to none (Done), never to a wrong
  word. A test pins the three lines against the skill's hand-off text.
- **Published by merging:** the Omni app (PRD page and Runners page) on deploy, and the kit's runner
  on its next release; a runner picks the outcome up once it updates.

The locked laws this touches: **BR-PRODUCT-5** (a feature stays a draft while any question is open)
is read, never changed: the button only offers yolo-fix, and the PR leaves draft as it does today.
If broken, a person could merge work whose open decisions nobody answered. Changing it needs
@pierrederval to approve the pull request on GitHub. The other locked laws `omni kb laws` printed for
these files are untouched.

## Acceptance criteria

1. At stage building or outbox, with 2 asked items and 1 counted reply, the header reads
   `Stage: building · 3/3 slices · 1 of 2 answered`, and the button is **Answer the outbox**.
2. With every asked item counted, the button is **Fix with answers**, copying `/omni:yolo-fix <n>`,
   with Send to terminal, the line `Fixes with 1: A · 4: B` under it, and the status
   `Stage: building · 3/3 slices · answered`.
3. A reply held as undetermined, or from an author the kit does not count, leaves its item unanswered.
4. With only medium items open, the button and caption are today's.
5. With the outbox or replies unread, the header is today's.
6. The feature PR link reads `feature #<n> · draft` while it is a draft, and `feature #<n>` once ready.
7. A runner job whose run ends on `/omni:yolo-fix <n>` reads **Waiting on answers**, on `/omni:yolo <n>`
   **Held**, on `/omni:pr-care <n>` **Ready**, each with a **PRD page** link; anything else reads Done.
8. A failed job never carries an outcome; a report with an unknown outcome is refused.
