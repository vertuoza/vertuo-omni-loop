# Plan: a fleet works alone on its mission's branch

PRD #2879, its spec beside this plan (`spec.md`). The feature branch `feat/fleet-works-alone` goes
into `main` with `Closes #2879`; each slice is a sub-PR from `feat/fleet-works-alone--<slice>` into
the feature branch with `Part of #2879`. Not built before PRD 2871 (the Reviewer) has shipped: s4
reads its verdict.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A Virtual Fleet has a level, `with-you` unless a workspace owner raised it, chosen in the New virtual fleet drawer | `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `apps/galaxy/src/virtual-fleets/` `apps/galaxy/src/dashboard/fleet/` `.omni-loop/knowledge/design/screens/fleet-new` | — | 1 | build |
| s2 | A mission inherits its fleet's level into `mandate.level`, shows it on the Missions tab, and a mission at `with-you` runs as before | `kit/lib/mission/` `kit/bin/commands/mission` `kit/bin/mission` `kit/plugin/skills/mission/` `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `apps/galaxy/src/missions/` `apps/galaxy/app/api/missions/` `.omni-loop/knowledge/design/screens/mission-start` | s1 | 2 | build |
| s3 | Starting a mission above `with-you` cuts its mission branch, and its PRDs are built on it, their pull requests checked like one into `main` | `kit/lib/config` `kit/lib/runner/` `kit/plugin/skills/yolo/` `kit/plugin/skills/wave/` `kit/plugin/skills/do-work/` `kit/plugin/skills/pr/` `kit/plugin/skills/pr-care/` `apps/omni-app/src/missions/` `apps/omni-app/src/runner` `.github/workflows/checks.yml` `scripts/checks-workflow` | s2 | 3 | build |
| s4 | A ready PRD that passes the merge gate is squash-merged into the mission branch, and the PRDs it blocked are sent | `apps/omni-app/src/missions/` `packages/github/` `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` | s3 | 4 | deep |
| s5 | The mission branch follows the default branch: rebased when clean, its generated files rebuilt by a job, a real conflict waiting on a person | `apps/omni-app/src/missions/` `packages/github/` `kit/lib/runner/` `kit/lib/generated/` | s4 | 5 | deep |
| s6 | One mission pull request carries the branch to the default branch by rebase, a PRD is shipped only once there, and one knowledge pull request covers a landing | `apps/omni-app/src/missions/` `apps/omni-app/src/knowledge-harvest/` `apps/omni-app/src/retro/` `packages/github/` | s5 | 6 | deep |
| s7 | A person drops a PRD from the mission branch with `omni mission drop`, and a red branch names the PRD to drop | `kit/bin/commands/mission` `kit/bin/mission` `kit/lib/mission/` `kit/lib/help/` `apps/omni-app/src/missions/` `apps/galaxy/app/api/missions/` `apps/galaxy/src/missions/` | s6 | 7 | build |
| s8 | The Missions tab shows the Branch line and the operation room records each join, rebase, drop and landing | `apps/galaxy/src/missions/` `.omni-loop/knowledge/design/screens/mission-start` `.omni-loop/knowledge/design/screens/fleet-room` `kit/plugin/skills/pr/` | s7 | 8 | build |
| s9 | At `alone`, the committee approves a mission's PRD by three `yes`, never what the escalation list names, and the approval is in force for that mission | `kit/plugin/skills/committee/` `kit/lib/committee/` `kit/bin/commands/committee` `kit/bin/committee` `kit/lib/help/` `kit/lib/virtual-fleet/` `kit/lib/runner/` `apps/galaxy/src/runners/` `apps/galaxy/src/repositories/skills` `apps/galaxy/src/approvals/` `apps/galaxy/src/virtual-fleets/` `apps/omni-app/src/missions/` `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` | s8 | 9 | deep |
| s10 | At `alone`, the committee settles a high outbox item by three `yes`, as answered by the fleet, and escalates the rest with its verdicts | `kit/plugin/skills/committee/` `kit/lib/committee/` `kit/lib/outbox/` `apps/omni-app/src/missions/` `apps/omni-app/src/outbox-check/` `apps/galaxy/src/missions/` | s9 | 10 | deep |
| s11 | A person overturns a fleet's decision; the mission pull request lists every decision, and the Missions tab shows only what was escalated and the trust line | `kit/bin/commands/mission` `kit/bin/mission` `kit/lib/mission/` `kit/lib/help/` `apps/omni-app/src/missions/` `apps/galaxy/src/missions/` `apps/galaxy/app/api/missions/` `.omni-loop/knowledge/design/screens/mission-start` | s10 | 11 | build |
| s12 | At `alone` with `mandate.ownPrds` above 0, the PM adds PRDs to the mission, each waiting for a person's approval | `kit/plugin/skills/brainstorm/` `kit/lib/runner/` `apps/galaxy/src/runners/` `apps/galaxy/src/repositories/skills` `apps/omni-app/src/missions/` `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` | s11 | 12 | build |
| s13 | The guide's Missions page says what each level does, what a person still does, and how to go back | `docs/guide/` `apps/galaxy/src/docs/` | s12 | 13 | light |

**Shared ground.** `apps/omni-app/src/missions/` (the supervisor and its job) is declared by s3 to
s7 and s9 to s12, and `supabase/migrations/`, `supabase/checks/` and `supabase/database.types.ts`
by s1, s2, s4, s9 and s12: each of those slices sits in a wave of its own, so two never merge side
by side, and each migration is dated after the newest on `main` when its slice is marked ready.
`kit/lib/help/` (one entry per new command or skill) is shared by s7, s9 and s11;
`apps/galaxy/src/missions/` and the `mission-start` screen by s2, s7, s8, s10 and s11;
`kit/lib/runner/` and the runner skill lists by s3, s5, s9 and s12. The waves are one chain because
nearly every slice edits the supervisor. `kit/dist/` and `apps/omni-app/api/` are generated and
listed nowhere.

## Per slice: done when

### s1 (`ui: yes`)
- A fleet reads `with-you` unless an owner raised it; a member who is not an owner is refused when
  raising it, by the database and by the page; any member lowers it (criterion 1).
- The New virtual fleet drawer offers the three levels as one choice, `Reviews with you` selected,
  as the `fleet-new` screen draws it; the two others are disabled for a member who is not an owner.
- A fleet missing a PM, an Architect or a Reviewer cannot be set to `alone` (criterion 12).

### s2 (`ui: yes`)
- `mission.md` accepts `mandate.level`, `mandate.hardToRevert` and `mandate.ownPrds`, refuses any
  other value by name, and a brief without them reads `with-you`, 0.6 and 0.
- `/omni:mission` writes the fleet's level without asking; `--level <key>` overrides it; the
  Missions tab shows each mission's level, and **Change for this mission** on a draft
  (criterion 3).
- A mission at `with-you` records the same events and opens the same pull requests as the tests of
  PRD 2842 pin (criterion 2).
- Lowering a mission to `with-you` while a PRD is on its branch is refused, saying how many to land
  or drop first (criterion 20).

### s3 (`ui: yes`)
- Start at `own-branch` cuts `mission/<number>-<topic>` from the default branch; where rebase
  merges are not allowed it is refused with the setting's name and cuts nothing (criterion 4).
- A PRD's job names the mission branch as its base; `/omni:yolo`, `/omni:wave`, `/omni:pr` and
  `/omni:pr-care` cut from it and target it, and read `repo.defaultBranch` when a job names none.
- A pull request into `mission/**` runs the `checks` workflow as one into `main` does
  (criterion 5).

### s4 (`ui: yes`; deep: the gate decides what merges with no person)
- Green checks, the Reviewer's `pass` on the head and no open high or `human-action` item: the App
  squash-merges the pull request into the mission branch. With any one missing, or a check that did
  not decide, it does not, and the mission says what the PRD waits on (criterion 6).
- A PRD on the mission branch no longer counts toward `mandate.parallel`, and a PRD it blocked is
  sent on a branch that holds its commit (criterion 7).
- Each join is recorded once, also when the run is replayed.

### s5 (`ui: yes`; deep: a force-pushed branch under open work)
- When the default branch moves, the mission branch is rebased onto it with lease and each open
  feature branch of the mission onto the new tip.
- A conflict only in generated paths sends one job that rebases and rebuilds them; any other
  conflict changes no branch, and the mission waits on a person, naming the files (criterion 8).

### s6 (`ui: yes`; deep: what counts as shipped changes)
- The mission pull request opens when the first PRD joins and lists each PRD with its commit, its
  Reviewer verdict and its page, rewritten on every join.
- Merged with Rebase and merge, it puts one commit per PRD on the default branch; each PRD is
  shipped from then, not before; the branch is rebased and the next mission pull request opened
  when PRDs remain (criterion 9).
- One knowledge pull request covers every PRD of the landing, with no id used twice
  (criterion 10).

### s7 (`ui: yes`)
- `omni mission drop <mission> <prd>` removes that PRD's commit from the mission branch, reopens
  its feature pull request, and names the later PRDs sharing its territory, dropped with it unless
  `--keep`; the default branch is never changed (criterion 11).
- When the mission branch's checks go red after a join, no further PRD joins and the mission waits
  on a person, naming that PRD and the drop line.

### s8 (`ui: yes`)
- The Missions tab shows the Branch line (PRDs on it, up to date or not, the mission pull
  request's link) and the progress as `on main` and `joined`, as the `mission-start` screen draws
  it; a mission at `with-you` shows neither.
- The operation room shows one event per join, rebase, drop and landing; a feature pull request's
  status comment names the mission branch.

### s9 (`ui: yes`; deep: the list no vote may settle)
- `/omni:committee <n> --approve` runs on a runner: the PM, the Architect and the Reviewer each
  answer `yes`, `no` or `unsure` with one sentence, without reading another's verdict.
- Three `yes` record a carried approval: the PRD's page reads `Approved by fleet <key>`, the
  mission sends the PRD, and a later change to a file the committee read voids it (criterion 13).
- Each line of the escalation list reaches a person although three members would answer `yes`
  (criterion 15); a `no`, an `unsure`, a member that fails or times out does too, verdicts
  attached (criterion 16).
- Each decision is a row of `mission_decisions`, written by the service, read by the workspace's
  members, never through a terminal token.

### s10 (`ui: yes`; `law: BR-PRODUCT-5 · owner @pierrederval`; deep: an answer no person gave)
BR-PRODUCT-5 keeps a feature a draft while any question is open: if broken, a person could merge work whose
open decisions nobody answered. This slice lets the fleet's answer close a question for the mission branch
only, so the feature pull request waits for @pierrederval's or @dervalp's approval on GitHub.
- `/omni:committee <n> --item <id>`: three `yes` settle a high item as `answered by fleet <key>`
  with the option chosen; the hero whose job raised it does not vote (criterion 14).
- The escalation list and anything but three `yes` send the item to a person with the verdicts.
- A feature pull request whose high items were all answered by the fleet may join the mission
  branch; it is never marked ready for the default branch on them.

### s11 (`ui: yes`)
- `omni mission overturn <mission> <decision>` leaves the decision as recorded, adds the person's
  beside it, voids the approval or reopens the item, and drops the PRD from the branch when it had
  joined (criterion 18).
- The mission pull request's body opens with **Approved by the fleet** and **Answered by the
  fleet**, each line with its three verdicts; the Missions tab shows only what was escalated under
  **Waiting on you**, each with why, and `<n> decisions by the fleet · <k> overturned`
  (criterion 17).

### s12 (`ui: yes`)
- With `mandate.ownPrds` at 0 no brainstorm job is sent. Above 0, the PM adds at most that many
  PRDs, each `added by the fleet`, each waiting for a person's approval and never the committee's;
  every question the brainstorm would have asked is a high item on the new PRD (criterion 19).
- Runners take `brainstorm` for a mission's job and for nothing else.

### s13 (light: the guide's words)
- `docs/guide/missions.md` names the three levels, what a person still does at each, the merge
  gate, the escalation list, drop and overturn, and how to return to `with-you`; the guide's own
  tests pass.
