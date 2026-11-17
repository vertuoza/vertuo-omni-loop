# Plan: A mission repairs a failed step, then stops and explains

PRD #2980, its spec beside this plan (`spec.md`). The feature branch `feat/mission-repairs` goes into
`main` through one feature PR ("Closes #2980"); each slice is a sub-PR from
`feat/mission-repairs--<slice>` into the feature branch ("Part of #2980").

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `RepairRetroSchema` checks a retro, `fingerprint()` gives one cause one fingerprint, `scrub()` builds the public report from fixed fields or refuses, and `repairLine()` reads the `omni repair:` record line | `kit/lib/repair/` | — | 1 | deep |
| s2 | `mission_repairs` and `omni_bug_reports` exist, the database refuses a 4th repair of a fingerprint in a round and a 10th in a mission, the four event kinds are allowed, and a runner job may run `/omni:repair` | `supabase/migrations/` `supabase/checks/mission_repairs.sql` `.github/workflows/supabase.yml` `supabase/database.types.ts` `apps/galaxy/src/runners/runners.contract` `apps/galaxy/src/runners/runners.repair.migration.test.ts` | — | 1 | deep |
| s3 | `/omni:repair` runs on a runner: a retro, then one of `code` (a bug fix into the mission branch), `omni-loop`, `flake` or `person`, ending on its record line; `/omni:bug-fix` takes `--base <branch>` | `kit/plugin/skills/repair/` `kit/plugin/skills/bug-fix/` `kit/porting/plugin--bug-fix.md` `kit/lib/virtual-fleet/roles` | s1 | 2 | build |
| s4 | The App files a scrubbed report on the Omni Loop repository, one issue per fingerprint and a `+1` on a repeat, retried on its job ledger when GitHub refuses, behind a port with a fake | `apps/omni-app/src/bug-reports/` `apps/omni-app/src/jobs/` | s1, s2 | 2 | build |
| s5 | A mission sends a repair where it stopped a PRD, reads its record line, lands a `code` fix into the mission branch and sends the step again, retries a flake, stops on `person`, `omni-loop`, a spent cause or a spent mission with the full explanation, and a Resume opens a new round; BR-PRODUCT-139's text says so | `apps/omni-app/src/missions/` `.omni-loop/knowledge/product/rules.md` | s2, s3, s4 | 3 | deep |
| s6 | The Operation room and the mission page read `Repairing (2 of 3) · 7 left in this mission` and the Stopped block (cause, repairs tried, proposed fix, Resume, or the Omni Loop issue it waits on), with the four ledger rows | `apps/galaxy/src/missions/` | s5 | 4 | build |
| s7 | The guide's Missions and Runners pages say how a mission repairs, its 3 and 9, and what an Omni Loop bug report holds | `docs/guide/missions.md` `docs/guide/runners.md` | s5, s6 | 5 | light |

Shared ground: none. Each prefix is declared by one slice: s2 alone adds a migration, s5 alone touches
`apps/omni-app/src/missions/` and s6 alone `apps/galaxy/src/missions/`. s3's skill writes the record
line s1's `repairLine()` reads, so s3 waits for s1; s5 calls s4's filer, so it waits for s4. The
built files (`kit/dist/`, `apps/omni-app/api/`) are rebuilt by each wave, never listed.

Law proofs: tests these slices extend prove rules: `supervisor.test.ts` and `mission.e2e.test.ts`
(BR-PRODUCT-139; s5), the runner skill tests (BR-PRODUCT-140; s2). None is a locked law, so no slice
carries a law mark, but a slice that changes one of these files records a high outbox item naming the
rule it proves and writes its account, so the feature's coverage gate finds every change accounted
for.

## Per slice: done when

### s1 (deep: the scrub guards what goes public)

- `RepairRetroSchema` (Zod) refuses a retro missing its cause, class, place, signature, evidence,
  proposed fix or fingerprint, a class other than `code`, `omni-loop`, `flake` or `person`, and an
  evidence line longer than one sentence.
- `fingerprint()` gives one fingerprint for two failures of the same test at different lines, times,
  hashes and temporary paths, and another for another test (AC-2).
- `scrub()` removes every path, repository name, login, email, URL and token-shaped string a fixture
  holds, keeps the kit version, command, class, message and fingerprint, and refuses a report that
  still holds a token-shaped string (AC-6).
- `repairLine()` reads `omni repair: {"v":1,…}` from a job's log, the last such line winning, and
  answers unreadable for a missing or malformed one.

### s2 (deep: a migration and caps held in storage)

- `20270125140000_mission_repairs.sql`, dated after the newest on the branch and on `main`, adds
  `mission_repairs` (mission, PRD, fingerprint, round, number 1 to 3, retro, fix PR, outcome) and
  `omni_bug_reports` (fingerprint unique, issue number, count), adds `repair-started`, `retro`,
  `repair-ended` and `bug-reported` to `mission_events`' kinds, and allows `/omni:repair` as a runner
  job's skill.
- `supabase/checks/mission_repairs.sql`, its own step in the `supabase` workflow, proves a 4th repair
  of one fingerprint in a round and a 10th in a mission are refused, and a member of another
  workspace reads no row (AC-4).
- `supabase/database.types.ts` is regenerated from a fresh database.

### s3

- `kit/plugin/skills/repair/SKILL.md` reads the failed job's log and saved work on the runner, writes
  a retro, and takes one way by its class: `code` follows `/omni:bug-fix --base <mission branch>`
  (`/omni:mega-bug-fix` for a PRD that spans repositories), `omni-loop` writes the scrubbed report,
  `flake` fixes nothing, `person` names the question; in the Omni Loop repository `omni-loop` is read
  as `code`. It asks nobody, and its last output is the one record line.
- `/omni:bug-fix` takes `--base <branch>`: the fix branch is cut from it and the PR targets it; with
  no `--base`, the default branch as today.
- The Engineer's skills list `/omni:repair`.

### s4 (`ui: yes`)

- A report for a new fingerprint files one issue labelled `bug` on the repository the App's setting
  names (`vertuoza/vertuo-omni-loop` by default), signed as the Omni App, and records it in
  `omni_bug_reports`; the same fingerprint again adds a `+1` comment with the kit version (AC-5).
- A report `scrub()` refuses files nothing; a GitHub refusal is retried by the job ledger.
- No test calls GitHub: the filer is a port with a fake.

### s5 (deep: the supervisor's stop rule and a law path; `ui: yes`)

- A `failed` job, a second hold and a second stop mid-way send a repair job first in line, and the PRD
  reads Repairing (1 of 3); a cancel sends nothing (AC-1).
- A `code` record lands its fix PR into the mission branch once green, then the step is sent again;
  a conflict stops the PRD and names its files.
- A `flake` sends the step once more with no fix; a `person` stops the PRD with the question (AC-9).
- An `omni-loop` record hands the report to s4's filer and stops the PRD with
  `Waits on Omni Loop bug #<issue>` (AC-5); a refused scrub stops it saying why.
- A 4th failure of a repaired cause, and the 10th would-be repair of a mission, stop the PRD with the
  cause, the repairs tried with their PRs and outcomes, the proposed fix and how to resume (AC-3,
  AC-4).
- A lost repair spends nothing; an unreadable record line spends one (AC-7). A Resume opens a new
  round: each cause gets 3 again and the mission's 9 stay counted (AC-8).
- The four events are recorded, each one sentence and one link, with the fingerprint's first 8
  characters. BR-PRODUCT-139's text in `rules.md` says when a failed PRD is sent again.
- On fake runners, a mission whose step fails at 02:00 on a broken test is repaired and reaches ready.

### s6 (`ui: yes`)

- The room's now line and the mission page read `Repairing (2 of 3) · 7 left in this mission`, the
  cause in one sentence and the fix PR linked.
- A stopped PRD shows the Stopped block: the cause, each repair tried with its PR and outcome, the
  proposed fix, `Resume` and `n of 9 left in this mission`, or `Waits on Omni Loop bug #<issue>`
  linked (AC-10).
- The ledger shows `repair-started`, `retro`, `repair-ended` and `bug-reported` with their state
  words, as the before/after page's 1.A to 1.C draw them.

### s7 (light: docs only)

- `docs/guide/missions.md` says a failed step is repaired up to 3 times per cause and 9 per mission,
  what each class does, and how Resume counts; `docs/guide/runners.md` names `/omni:repair` and what
  an Omni Loop bug report holds and never holds.
