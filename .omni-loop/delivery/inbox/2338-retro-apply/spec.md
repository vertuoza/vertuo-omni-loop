---
prd: 2338
title: Retro lessons lead somewhere — /omni:retro-apply
blocked-by: none
spec: file
phase0: server
---

## Problem

A retro keeps a lesson only when its judge finds it new (PRD 487), and each kept lesson opens a retro
issue whose body ends with a YAML block "for `/omni:retro-apply` to read". That skill never existed.
So a kept lesson lives in the PRD's `retro.json` and its issue, read by the next retro's judge and by
no agent that builds: nothing turns it into a rule, and nothing says no to it.

The cost is measured. "Regenerate the database types against a fresh local database, never hand-edit
them" was kept by three retros in a row (#1349 for PRD 1322, #1649 for PRD 1628, #2207 for PRD 2174),
each costing red CI rounds, until a person wrote the rule and its guard by hand (#2324). In a
comparison of this repository's loop with another product's (2026-10-21), the retro loop scored
lowest of ten dimensions: lessons are kept, then lead nowhere.

## Solution

Every lesson a retro keeps ends in one of two outcomes a person approves by merging the retro PR:
it **becomes** a playbook rule, or it **stays here**, with the reason why.

1. **The retro queues the work.** When the retro app opens or updates a retro PR with at least one
   kept lesson that has no outcome, it queues one runner job, `/omni:retro-apply --retro <retro PR>`,
   for the repository, sent by the Omni GitHub App (never in a person's name). It also writes that
   line in the retro PR's body, for a person to run in a terminal when no runner takes the job.
2. **The skill settles each lesson,** on the retro PR's own branch, one retro issue at a time. It
   reads the issue (its lesson, its YAML block) and the playbook (`omni kb show <form>`), then:
   - **Becomes:** the lesson is about how to work here and no rule states it. It appends the rule to
     the slot it belongs in, as a new bullet ending `(retro of PRD <n>, #<issue>)`, and records
     `became: playbook/<form>#<slot>` on the lesson. With `retro.guards` on, it also writes the guard
     test that would have caught it, proved red then green.
   - **Stays here:** a rule already states it (the reason cites `playbook/<form>#<slot>` or the law),
     or the lesson is not about how to work here. It records `staysHere: <why>`.
   - **Asks:** no slot fits, the lesson contradicts a written rule, or it would change a locked law.
     It records no outcome and posts one question on the retro PR, for a person to answer.
3. **The retro PR shows each outcome,** one line per lesson: a new rule quoted word for word with its
   slot, or the reason it stays here, then `Closes #<issue>`. The reviewer approves rule by rule.
4. **`omni check retro`** proves the outcomes: a `became` resolves to a filled slot, a `staysHere`
   has a reason, and on a retro PR every kept lesson has one. The retro PR stays red until then.
5. **A person merges the retro PR.** The merge applies every rule, accepts every reason and closes the
   issues. Nobody else applies a lesson.

`retro.guards`, a new key of `.omni-loop/config.yml`, off by default, says whether the skill writes
guard tests. Off, the retro PR stays documents only, and a lesson worth a guard names the guard in
its line for a person to take up.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | skill | `retro-apply` | no written convention: follows `kit/plugin/skills/yolo-fix/` (a skill named for what it does to an existing thing) |
| omni-loop | CLI | `omni check retro` | `check <area>` ← `kit/bin/commands/check.ts:20` |
| omni-loop | config | `retro.guards` | no written convention: follows `design.enabled` (a feature group, a boolean, off by default) ← `.omni-loop/config.yml:67` |
| omni-loop | record | `became`, `staysHere` on a lesson | `Became:` / `Stays here:` ← `kit/lib/outbox/check-outbox.ts:28` |
| omni-loop | id | `playbook/<form>#<slot>` | ← `kit/lib/playbook/forms.ts:369` |
| omni-loop | database | `runner_jobs.sent_by_app` | no written convention: follows `runner_jobs.continues` ← `supabase/migrations/20261220090000_fix_when_answered.sql` |

## Decisions

- **The approach** (asked): a skill run per retro, used by the retro PR itself, over writing rules
  inside the retro app or a runner acting without a retro PR.
- **The trigger** (asked): the retro app queues a runner job; the retro PR's body carries the same
  line as the fallback for a person.
- **Guards** (asked): optional per repository, `retro.guards`, off by default.
- **The voice's objection** (F-E Developer, `persona:F-E Developer`): "An agent writing new rules into
  the playbook I follow, on a branch I didn't open, means rules pile up that nobody really chose."
  Settled **accepted**: the retro PR quotes each new rule word for word, with its slot, as its own
  line, so the reviewer approves rule by rule before merging.
- **A lesson without an outcome keeps the retro PR red** (asked: section 2 approved as written).
- **Taken without asking, the most reversible option:** the job is sent by the app, recorded as
  `sent_by_app = 'omni-app'` with `sent_by` null, rather than in the name of the person who merged
  the feature PR, who did not ask for it (Never 10). A follow-up migration reverts it.
- **Taken without asking:** retros merged before this ships keep no outcome and are not checked; the
  one open retro issue (#2295) is settled by running the skill once by hand after it ships.

## User stories

- As the person who merges retro PRs, I read each kept lesson's outcome (the exact rule and its slot,
  or the reason it stays here) in the retro PR, and merging it applies them.
- As an agent building a slice, I find yesterday's lesson in the playbook form I already read, not
  in a retro file I never open.
- As a person reviewing the loop, I can tell from `omni check retro` that no kept lesson was left
  without an answer.

## Scope

In: the skill and its runner allowlisting; the retro app's queue step and PR-body line; the lesson
outcome in `retro.json` and `retro.md`, carried over by the day-14 run; `omni check retro`;
`retro.guards`; the checks workflow running the full checks on a retro PR that adds code; the
migration for an app-sent job.

Out: lessons of retros merged before this ships; product rules and invariants (the knowledge
harvest's ground, PRD 487's registers): a lesson that would change one stays here, naming why, or
asks; any change to what the judge keeps (PR #2337 gave it the playbook).

## Test seams

Following the testing form:

- **Kit, unit:** `omni check retro` over fixture retros (a `became` that resolves, one naming a blank
  or missing slot, an empty `staysHere`, a kept lesson with no outcome on a retro PR, a retro from
  before the change); the lesson-outcome schema; `retro.guards` read off by default.
- **Retro app:** its existing scenario tests and the PRD 438 recording: kept lessons queue exactly one
  job and write the line; none queue nothing; a replay queues no second job; day 14 keeps outcomes.
- **Runner:** `RUNNABLE_SKILLS` holds `retro-apply` (`kit/lib/runner/line.ts`), and its test says so.
- **Database:** the migration's check over `sent_by` / `sent_by_app` in `supabase/checks/`.
- **Skill:** its contract through the plugin's skill tests.
- **Mutation:** the new check's module gets a floor in `mutation/floor.json`.
- **By hand, once:** the skill on #2295; the retro PR shows its line and `omni check retro` is green.

## Risks

Merging publishes the kit (the skill and the check, through the plugin and `kit/dist`), the GitHub
App (the queue step) and a migration on production Supabase. Rollback: revert the merge; a follow-up
migration drops `sent_by_app` and restores `sent_by not null` once no app-sent job remains.

- A queued job whose retro PR merged or closed meanwhile: the skill refuses it in one line and writes
  nothing.
- Rules piling up: each rule is quoted and merged by a person, and the judge reads the playbook
  (#2337), so a rule already written is not kept again.

The Legal entries it touches:

- **L-AIACT-1**: the skill's commits, PR text and questions are signed as an agent's.
- **L-GDPR-2**: the job's log keeps the runner's masking of secrets.
- **L-GDPR-4**: each outcome is a decision record, kept for good in `retro.json`.

The locked laws it touches. The paths `.omni-loop/config.yml`, `.github/workflows/checks.yml` and
`mutation/floor.json` are governed by every locked law:

- BR-PRODUCT-3: an agent could wave its own work through the gate. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-5: a retro PR could be merged with a lesson nobody answered; this PRD keeps it red instead. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-6: a risky change nobody explained reaches main. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal acts on words a person no longer stands behind. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-28: a stranger could tie themselves to a team. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the workspace's paid key. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's work; the queued job targets this repository's workspace only. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left could still read through an agent. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-94: an agent could answer in a person's name; the skill asks, never answers. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-3: a badly ranked question slips past; the skill's question goes through the gate's check. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-4: a change could switch its own gate off; `omni check retro` judges the retro PR and is not changed by it. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-7: a broken hook blocks a person. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-8: questions sent to a server nobody chose. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-13: the install writes outside its folder. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-14: a rule quietly loses its test. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user; only a person merges the retro PR. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-16: the ledger rewritten. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-17: a secret reaches the browser. Changing it needs @pierrederval to approve the pull request on GitHub.

## Acceptance criteria

1. A merged feature PR whose retro keeps at least one lesson gets a retro PR whose body carries
   `/omni:retro-apply --retro <retro PR>`, and exactly one queued runner job with that line, sent by
   the app; a replay of the retro queues no second job; a retro that keeps nothing queues none.
2. `/omni:retro-apply --retro <n>` on a retro PR with an open kept lesson whose rule is new appends the
   rule to one playbook slot, ending `(retro of PRD <n>, #<issue>)`, records `became` with that slot's
   id, and the retro PR's body quotes the rule word for word with its slot and `Closes #<issue>`.
3. On a lesson a rule already states, it records `staysHere` citing that rule, and writes no rule.
4. On a lesson it cannot place, it records nothing and posts one question on the retro PR; `omni check
   retro` stays red on that PR until the lesson has an outcome.
5. `omni check retro` refuses a `became` that names a blank or missing slot, and a `staysHere` with no
   reason; it passes a retro from before this change.
6. With `retro.guards` off, the retro PR changes documents only; on, a lesson worth a guard adds a test
   the skill proved red without the rule's fix and green with it, and the retro PR runs the full checks.
7. A day-14 run keeps every outcome it finds.
8. The skill refuses, in one line and writing nothing, a retro PR already merged or closed.
