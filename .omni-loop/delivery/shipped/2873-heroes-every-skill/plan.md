# Plan: every Virtual Hero lists all its role's skills, and runners take the ultra skills

PRD #2873, specified in `spec.md` beside this plan. It is built on the feature branch
`feat/heroes-every-skill` into `main` (`Closes #2873`), each slice a sub-PR from
`feat/heroes-every-skill--<slice>` into the feature branch (`Part of #2873`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Runners take `/omni:ultra-yolo`, `/omni:ultra-wave` and `/omni:ultra-yolo-fix`: every list of runner skills holds them (the app's, the kit's, `PRD_SKILLS`, the accounts' check, and the database's, the four it lacked added), a test holds the database's list equal to the app's, an ultra job's token covers the product's repositories the key allows and the installation holds, and an ultra line from a repository that is no product's plan repository is refused naming the plan repository | `kit/lib/runner/` `apps/galaxy/src/runners/` `supabase/migrations/20270122120000_runner_ultra_skills.sql` | — | 1 | deep |
| s2 | The ultra skills and `/omni:mega-bug-fix` run unattended on a runner: under `OMNI_JOB` each clones into `<worktrees>/targets/job-<id>/<name>`, a target the App lacks stops the job naming the repository and the fix, `/omni:ultra-yolo`'s red gate asks nothing under `OMNI_UNATTENDED`, `/omni:ultra-wave` starts at most `limits.parallelSteps` agents; the guide and help say runners take them | `kit/plugin/skills/ultra-yolo/` `kit/plugin/skills/ultra-wave/` `kit/plugin/skills/ultra-yolo-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/lib/help/` `docs/guide/` | — | 1 | build |
| s3 | Every hero lists every skill of its role: six roles with the Designer, each skill marked `runs alone` or `needs a person` from the runner's list, the count line, the migration that adds `designer`, gives `virtual_hero_roles()` the full lists and rewrites every existing hero's skills; the Heroes tab, the drawer and the operation room show it | `kit/lib/virtual-fleet/` `supabase/migrations/20270122121000_heroes_every_skill.sql` `supabase/checks/virtual_fleets.sql` `apps/galaxy/src/virtual-fleets/` `apps/galaxy/src/missions/room/` `.omni-loop/knowledge/design/screens/fleet-seats.` `.omni-loop/knowledge/design/screens/fleet-new.` `.omni-loop/knowledge/design/screens/fleet-room.` | s1 | 2 | deep |
| s4 | A mission sends the Engineer `/omni:ultra-yolo <prd>` when its PRD lives in a plan repository, and `/omni:yolo <prd>` otherwise | `apps/omni-app/src/missions/` | s1 | 2 | build |

**Shared ground.** No prefix is declared by two slices. Two migrations, one per slice, each named in
full, so s1 and s3 never write the same file; s3's is dated after s1's and both after every migration
on `main` (re-dated with `node scripts/migration-order.ts` before ready if `main` moved). s3 reads
`kit/lib/runner/line.ts` (s1's) and never edits it, which is why it waits for s1: its count line
(`Runs 10 of 13 skills alone`) needs the ultra skills in the runner's list. s4 reads the runner's
line check through the job it sends and waits for s1 for the same reason. `kit/dist/` and
`apps/omni-app/api/` are generated: no slice commits them.

## Per slice: done when

### s1 (deep: a token that spans repositories, and two lists kept equal across the app, the kit and the database)

The slice keeps BR-PRODUCT-63 (an agent link reads only its workspace's repositories) without
changing it: the token never reaches past the key's allow-list and the product's repositories.

- `RUNNER_SKILLS` and `RUNNABLE_SKILLS` hold `ultra-yolo`, `ultra-wave` and `ultra-yolo-fix`, and
  `runners.contract.test.ts` still holds them equal.
- `prdOfRunnerLine('/omni:ultra-yolo 12')` names PRD 12, and the Runners page names the PRD of an
  ultra job.
- The accounts' `takes` check accepts the three skills.
- The migration's list of fixed runner skills equals `RUNNER_SKILLS`, the four it lacked
  (`retro-apply`, `rewind`, `knowledge-add`, `rewind-apply`) included, and a test in
  `apps/galaxy/src/runners/` fails when the two differ.
- `spansProduct()` holds `mega-bug-fix` and the three ultra skills; a claimed ultra job's token is
  minted for the product's repositories the key allows and the installation holds, and no other (a
  service test with a repository the installation lacks and one the key does not allow).
- An ultra line sent from a repository that is no product's plan repository is refused with
  `/omni:<skill> runs from a product's plan repository: send it from <plan repository>`, the plan
  repository named when the product has one.
- Nothing calls GitHub or Supabase in the tests.

### s2

- Under `OMNI_JOB`, `/omni:ultra-yolo`, `/omni:ultra-yolo-fix` and `/omni:mega-bug-fix` clone their
  targets into `<worktrees>/targets/job-<id>/<name>`; without it, the folder is as today.
- On a runner, a target the token does not reach stops the job at the clone step with
  `install the Omni GitHub App on <owner/name>`, nothing pushed for that target.
- Under `OMNI_UNATTENDED`, `/omni:ultra-yolo`'s red gate offers no "answer here": the plan PR stays a
  draft with its questions posted.
- On a runner, `/omni:ultra-wave` starts at most `limits.parallelSteps` slice agents at once.
- The Runners help entry and the guide list the three ultra skills among the skills a runner runs.
- The kit's tests of the skills' text (where they exist) and `pnpm test` are green.

### s3 (deep: a migration that rewrites stored heroes)

**s3** (`ui: yes`)

- `HERO_ROLES` holds six roles in the drawer's order, `designer` last, each with the skills of the
  spec's table; `UNATTENDED_SKILLS` is gone.
- `skillMarks()` marks a skill `alone` exactly when `RUNNABLE_SKILLS` holds it, `person` otherwise; a
  test adds a skill to a copy of the list and sees its mark change.
- The count line reads `Runs 10 of 13 skills alone` for the Engineer, and `A person does this today`
  for the Reviewer.
- The migration accepts `designer` for `virtual_heroes` and `mission_events`, gives
  `virtual_hero_roles()` the six roles, and rewrites every existing hero's skills to its role's list,
  leaving its name, agent, model and limits; `supabase/checks/virtual_fleets.sql` proves each, and
  `roles-sql.test.ts` holds the kit's defaults equal to the database's.
- The Heroes tab shows each skill with its mark, `runs alone` first, and the count line; the drawer
  shows six switches, all on; the operation room reads an idle hero with a skill that runs alone as
  `Idle`, and the Reviewer as `A person does this today`: each in a render test.
- The `fleet-seats`, `fleet-new` and `fleet-room` drafts match what is built.

### s4

- The supervisor sends `/omni:ultra-yolo <prd>` for a mission PRD whose repository is a product's
  plan repository, and `/omni:yolo <prd>` for any other, each in a test of `apps/omni-app/src/missions/`.
- A replay still sends one job, as today.
