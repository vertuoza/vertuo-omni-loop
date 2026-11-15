# Plan: The Reviewer checks a PRD's branch before its PR goes ready

PRD #2871, specified in `spec.md` beside this plan. It is built on the feature branch
`feat/reviewer` into `main` (its pull request says `Closes #2871`), through one sub-PR per slice
from `feat/reviewer--<slice>` into the feature branch (each says `Part of #2871`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A verdict is pass or 1 to 5 findings, Zod-checked, rendered as one GitHub review and read back by its round marker; the `review` form gains `look-for`, a kit default a repository extends and never shortens | `kit/lib/review/` `kit/bin/commands/review.ts` `kit/bin/review.test.ts` `kit/bin/commands/index.ts` `kit/lib/playbook/forms.ts` `kit/lib/playbook/review.test.ts` `kit/templates/playbook/review.md` `kit/templates/omni-settings/playbook/review.md` | — | 1 | deep |
| s2 | `/omni:review <n>` reads the PRD, the rules and the default look-for, verifies each finding, posts one review, and marks ready only on its own pass | `kit/plugin/skills/review/` `kit/test/review-skill.test.ts` `kit/lib/help/entries.ts` `kit/lib/help/entries.test.ts` | s1 | 2 | deep |
| s3 | A job may end `review` or `changes`; a mission event may be `reviewed`; the Reviewer hero works alone with `review` and its six limits | `kit/lib/runner/` `kit/lib/virtual-fleet/roles.ts` `kit/lib/virtual-fleet/roles.test.ts` `supabase/migrations/` `supabase/checks/missions.sql` `supabase/database.types.ts` `apps/galaxy/src/virtual-fleets/roles-sql.test.ts` | — | 1 | deep |
| s4 | `--for-review` on `/omni:yolo`, `/omni:yolo-fix` and `/omni:ultra-yolo-fix` ships, leaves the PR a draft and ends `review`; the fix judges each Reviewer thread | `kit/plugin/skills/yolo/` `kit/plugin/skills/yolo-fix/` `kit/plugin/skills/ultra-yolo-fix/` `kit/test/for-review-skills.test.ts` | s3 | 2 | build |
| s5 | The supervisor sends the build with `--for-review`, the Reviewer on `review`, the fix on round-1 `changes`, waits on a person after round 2, once each under its key, and records `reviewed` | `apps/omni-app/src/missions/` | s3 | 2 | deep |
| s6 | The Operation room shows each `reviewed` row as `Reviewer · agent`, linking its review, with its state word | `apps/galaxy/src/missions/` | s3 | 2 | build |

Shared ground: none. `kit/lib/help/entries.ts` is s2's alone (the new skill's help entry); s4
changes no help entry. `supabase/migrations/` is s3's alone, the one migration of this PRD (the
outcome check, the event kind, the Reviewer's defaults and the update of existing Reviewer heroes).
`kit/dist/` and `apps/omni-app/api/` are generated: each slice rebuilds them only to test, and the
wave rebuilds them once after merging.

## Per slice: done when

### s1 (deep: the shape every other slice reads)

- `kit/lib/review/verdict.ts` refuses a `changes` verdict with 0 or 6 findings, a finding with no
  rule, no file or no line, and a severity other than `blocker`, `major` or `minor`;
  `verdict.test.ts` proves each refusal.
- The same verdict renders the same review body, its summary naming the round and the count
  (`Round 1 of 2: 2 findings`) under `<!-- omni-review: <round> <verdict> -->`, and the body is
  signed as an agent's (L-AIACT-1).
- `omni review post <n> --file <verdict.json>` posts one `COMMENT` review with one inline thread per
  finding, and posts nothing when the feature PR already carries that round's marker;
  `omni review read <n>` prints the latest round and verdict; `kit/bin/review.test.ts` proves both
  on a fake GitHub, never the real one.
- `kit/lib/review/look-for.ts` returns the kit default's six items in order, followed by the
  repository's `look-for` section when there is one; a repository section never removes a default
  item (`look-for.test.ts`).
- `omni kb show review` prints `look-for` with the kit default when the repository left it blank.

### s2 (deep: the review's method decides its precision)

- `kit/plugin/skills/review/SKILL.md` reads the spec, the plan, `omni kb laws --paths` on the
  changed files, the `testing`, `conventions` and `architecture` forms and `look-for`; reads the
  whole diff against the default branch and the code around it; runs a verification subagent that
  tries to disprove each finding; keeps at most five; posts through `omni review post`.
- On `pass`, it marks the PR ready only when the PRD is shipped, the PR is a draft and the outbox
  gate is green, through the `yolo.ready` hooks and `gh pr ready`; otherwise it changes nothing
  else. It never approves or requests changes, never merges, writes no code.
- Round 2 reads round 1's threads and replies, resolves or keeps each with a reason once, and raises
  new findings only on lines changed since round 1.
- It ends with the hand-off `ready` on a pass it marked ready, and `changes` on findings.
- `kit/test/review-skill.test.ts` guards those lines; `omni help review` prints its entry.

### s3 (deep: a migration on production)

- The migration widens `runner_jobs_outcome_check` with `review` and `changes`, and the
  `mission_events` kind check with `reviewed`; `virtual_hero_roles()` gives the Reviewer
  `["review"]` and its six limits; existing Reviewer heroes no person edited take the same; its
  header says how it is rolled back.
- `supabase/checks/missions.sql` proves the two values and the kind are accepted, and that members
  still read and only the service role writes.
- `kit/lib/runner/` reads the `review` and `changes` hand-off lines; its tests prove both.
- `kit/lib/virtual-fleet/roles.ts`: the Reviewer's skills are `['review']`, `review` runs
  unattended, `worksAlone` is true, its six limits read as the spec says, and `roles-sql.test.ts`
  passes against the migration.

### s4 (build)

- With `--for-review`, `/omni:yolo` step 5 runs everything up to and including `omni ship`, leaves
  the feature PR a draft and prints the `review` hand-off; without it, the step is unchanged.
- `/omni:yolo-fix --for-review` (and `/omni:ultra-yolo-fix --for-review`) reads the Reviewer's open
  threads with the outbox replies, judges each as `/omni:pr-care`'s **Review threads** does (fix,
  push back with a reason, or ask), ships, and ends `review`.
- `kit/test/for-review-skills.test.ts` guards those lines in the three skills.

### s5 (`ui: yes`) (deep: the hand-off table and its keys)

- `supervisor.test.ts`: the build is sent as `/omni:yolo <n> --for-review`; `review` sends
  `/omni:review <n>` under `…:review:1`, then `…:review:2` after a fix; `changes` in round 1 sends
  `/omni:yolo-fix <n> --for-review` under `…:fix:1`; `changes` in round 2 makes the PRD wait on a
  person (`decide the Reviewer's findings on PR #<pr>`) and nothing more is sent; `ready` waits for
  the merge; a stopped Reviewer is sent again once, then the PRD stops with why.
- Each verdict records a `reviewed` event, role `reviewer`, actor `agent`, linking the review:
  `Changes asked: 2 findings, round 1/2.` or `Passed, round 2 of 2: marked ready.`
- `mission.e2e.test.ts`: one PRD passes in round 1, another goes changes, fix, pass, on the fake
  fleet; a replay or concurrent run inserts no job twice; no model call.

### s6 (`ui: yes`)

- The room's repository reads the event kind `reviewed`, and the ledger renders it as a
  `Reviewer · agent` row with its sentence, a link to the review and the state word `Changes` or
  `Passed`; the role filter `Reviewer` shows only those rows.
- Its render test proves the row; the words pass `omni design words` as the before/after's 2.A
  after does.
