# Plan: A mission team fixes the Omni Loop bugs missions report

PRD #3088, its spec beside this plan (`spec.md`). The feature branch `feat/omni-bug-team` goes into
`main` through one feature PR ("Closes #3088"); each slice is a sub-PR from
`feat/omni-bug-team--<slice>` into the feature branch ("Part of #3088").

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A mission brief takes a `kind`, `prds` by default or `omni-bugs`; an `omni-bugs` brief needs no scope and is refused off the Omni Loop repository; `/omni:mission --omni-bugs` writes it in one line | `kit/lib/mission/brief` `kit/plugin/skills/mission/` | — | 1 | build |
| s2 | The database keeps `missions.kind` (one running `omni-bugs` mission at most), a bug report's `state`, `attempts` (at most 3), `fix_pr`, `fixed_in` and `asked_job`, the `bug:<issue>:run:<k>` job key and the three event kinds | `supabase/migrations/` `supabase/checks/omni_bug_team.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` | — | 1 | deep |
| s3 | An `omni-bugs` mission never concludes; at each wake it takes the open bugs, most-reported first, skipping a closed issue or one with an open fix PR, up to `parallel`, sends `/omni:bug-fix #<issue>`, and reads each job's outcome into the bug's state: 3 attempts, a lost job free, a question asked once | `apps/omni-app/src/missions/bug-team` `apps/omni-app/src/missions/supervisor` `apps/omni-app/src/missions/job` `apps/omni-app/src/missions/store` | s1, s2 | 2 | deep |
| s4 | The App moves a bug to `merged`, `fixed` (with the release that holds the merge), `wont-fix` or back to `open` from the `issues`, `pull_request` and `release` webhooks, and a sweep at the team's wake catches a missed one | `apps/omni-app/src/bug-reports/` `apps/omni-app/src/webhook/` `apps/omni-app/src/jobs/` | s2 | 2 | build |
| s5 | A mission whose PRD stopped on an Omni Loop bug gets `bug-fixed` or the won't-fix event once; its PRD resumes, spending no repair, when the mission branch's pinned kit is at `fixed_in` or later, else reads `Fixed in v0.0.N: update the kit to resume`; BR-PRODUCT-139's text gains this way back | `apps/omni-app/src/missions/repair` `apps/omni-app/src/missions/supervisor` `apps/omni-app/src/missions/store` `apps/omni-app/src/missions/job` `.omni-loop/knowledge/product/rules.md` | s3, s4 | 3 | deep |
| s6 | The room shows one row per bug the team holds and the sentences of `bug-taken`, `bug-asked` and `bug-fixed`; a waiting PRD's row reads fixed, update kit, resumed or won't be fixed | `apps/galaxy/src/missions/` | s2, s5 | 4 | build |
| s7 | The guide's Missions page says what the Omni Loop bug team is, how to start it, and what a mission waiting on an Omni Loop bug does once it is fixed | `docs/guide/missions.md` | s5, s6 | 5 | light |

Shared ground: `apps/omni-app/src/missions/supervisor`, `.../store` and `.../job` are declared by s3
and s5 (s3 adds the `omni-bugs` kind's pick and outcome; s5 adds the holding PRD's resume): s5 waits
in wave 3 behind s3. The supervisor's, the store's and the job's tests (`supervisor*.test.ts`,
`store*.test.ts`, `job*.test.ts`) sit under those prefixes and are shared the same way. Every other
prefix is declared by one slice. The built files (`kit/dist/`, `apps/omni-app/api/`) are rebuilt by
each wave, never listed.

Law proofs: the brief's tests prove BR-PRODUCT-137 and BR-PRODUCT-138 (s1), and the supervisor's and
repair's tests BR-PRODUCT-139 (s3, s5). None is a locked law, so no slice carries a law mark; a slice
that changes one of these files records a high outbox item naming the rule and writes its account.
s2's migration sits beside the locked database laws (BR-PRODUCT-28, BR-PRODUCT-64, BR-PRODUCT-12,
BR-PRODUCT-29, BR-PRODUCT-39, N-PRODUCT-16, BR-PRODUCT-59) and changes none.

## Per slice: done when

### s1

- `MissionBriefSchema` reads `kind`, `prds` when absent; an `omni-bugs` brief with an empty scope
  parses, a `prds` brief with one is still refused as today.
- An `omni-bugs` brief whose repository is not the Omni Loop repository is refused with `Only the
  Omni Loop repository runs the Omni Loop bug team` (AC-10).
- `kit/plugin/skills/mission/SKILL.md` documents `--omni-bugs`: the fixed goal, no measure, the
  default mandate, and the workspace's Virtual Fleet with an Engineer (asking which one when several).

### s2 (deep: a migration and the caps the database holds)

- `supabase/migrations/20270127100000_omni_bug_team.sql` (re-dated if `main` moved): `missions.kind`
  `prds | omni-bugs` default `prds`; `mission_scope_ok` holds for `prds` only; a partial unique index
  refuses a second running `omni-bugs` mission (AC-10); `omni_bug_reports` gains `state` (open,
  fixing, pr-opened, asked, merged, fixed, wont-fix; default open), `attempts` 0 to 3 (a 4th refused,
  AC-4), `fix_pr`, `fixed_in`, `asked_job`, still service-role only; `runner_jobs_mission_key_shape`
  accepts `mission:<id>:bug:<issue>:run:<k>`; `mission_events.kind` accepts `bug-taken`, `bug-asked`,
  `bug-fixed`.
- `supabase/checks/omni_bug_team.sql` proves each rule, and that a member of another workspace reads
  no row of `omni_bug_reports` nor the team's mission (AC-9), with its step in the workflow.
- `supabase/database.types.ts` regenerated.

### s3 (deep: the team's run)

- `bug-team.ts`, pure: `pickBugs` orders open bugs by count, then age, skips closed issues and open
  fix PRs, caps at `parallel` minus the running (AC-1, AC-2); `bugAfter(outcome)` maps `pr-opened`,
  `already-fixed`, `need-human`, `needs-brainstorm`, `not-a-bug`, `stuck`, `blocked`, unreadable and
  lost to the next state and attempt, the 3rd failed attempt ending `asked` (AC-3, AC-4).
- The supervisor never concludes an `omni-bugs` mission, sends `/omni:bug-fix #<issue>` keyed
  `bug:<issue>:run:<k>` to the fleet's runners, records `bug-taken` and `bug-asked`, and never asks a
  bug twice (AC-3). The jobs carry the mission's id, so the token caps count them (PRD 3040).
- Its job input and its events hold the issue and the count only, never a workspace, repository or
  login (AC-9).

### s4

- An issue closed by a merged pull request turns its bug `merged` with `fix_pr`; a published
  release whose tag holds that merge commit turns it `fixed` with `fixed_in` (AC-5); closed as not
  planned turns it `wont-fix`; reopened turns it `open`; a fix PR closed unmerged puts it back `open`.
- The sweep, run at the team's wake, reaches the same states from the issue and the latest release
  when a webhook was missed. Ports with fakes: no test calls GitHub.

### s5 (deep: a resume across workspaces, by fingerprint only)

- A `fixed` bug gives each mission holding a PRD on it one `bug-fixed` event; at its wake, a pinned
  kit at `fixed_in` or later sends the PRD's step again with no repair spent (AC-6), an older or
  unreadable one reads `Fixed in v0.0.N: update the kit to resume`, sends nothing, and resumes once
  it catches up (AC-7). A paused or stopped mission waits for its own Resume.
- A `wont-fix` bug gives one event, `Omni Loop bug #<issue> won't be fixed: take this PRD by hand`,
  and the PRD stays stopped (AC-8).
- BR-PRODUCT-139's text in `.omni-loop/knowledge/product/rules.md` names the new way back.

### s6 (`ui: yes`)

- The team's room shows one row per bug it holds: `Fixing #<issue> · reported 7×`, `#<issue> · 4× ·
  PR #<m> to merge`, `#<issue> · asked: <why>`, as `before-after.html` 1.A draws it.
- A waiting PRD's row reads as 1.B, 1.C and 1.D draw it; the three event kinds have their sentences.
- The room's tests cover each row and sentence.

### s7 (light: docs only)

- `docs/guide/missions.md` has a section on the Omni Loop bug team and on a mission waiting on an
  Omni Loop bug.
