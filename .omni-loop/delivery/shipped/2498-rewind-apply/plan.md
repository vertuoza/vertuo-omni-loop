# Plan: Approving a missing-rule finding proposes that rule in the repository's own knowledge

PRD #2498, its spec beside this plan (`spec.md`). The feature branch `feat/rewind-apply` merges into
`main` with `Closes #2498`; each slice is a sub-PR from `feat/rewind-apply--<slice>` into the feature
branch, with `Part of #2498`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | An approved finding can hold its outcome, written once: the pull request that proposes the rule, the rule that already says it, or the question asked; a second outcome, or one on a finding not approved, is refused | `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/galaxy/src/rewind/rewind.outcome.migration.test.ts` | — | 1 | deep |
| s2 | `omni rewind outcome <finding>` sends an outcome (`--pr`, `--already` or `--asks`) and is refused one without its value or a second one, and the approved card on the Main tab shows `Rule proposed in PR #<n>`, `Already said by <rule>` or the question | `apps/galaxy/app/api/rewind/findings/` `apps/galaxy/src/rewind/` `apps/galaxy/src/dossier/page/MainPane` `kit/bin/commands/rewind.ts` `kit/bin/rewind.test.ts` `kit/lib/rewind/` `kit/lib/ask/client.ts` `kit/lib/help/entries` | s1 | 2 | build |
| s3 | Approving a playbook or register finding queues `/omni:rewind-apply <finding>` sent by the member, and the skill settles it in the repository's own knowledge: one docs-only pull request, already said, or one question, recorded with `omni rewind outcome`; never the kit, never a locked law, never a merge | `kit/plugin/skills/rewind-apply/` `kit/test/rewind-apply-skill.test.ts` `kit/lib/runner/line` `apps/galaxy/src/runners/runners.contract` `apps/galaxy/src/runners/runners.skills.migration.test.ts` `apps/galaxy/src/rewind/` `kit/lib/help/entries` `docs/guide/` | s2 | 3 | deep |

**Shared ground.** `apps/galaxy/src/rewind/` is declared by s1 (its migration test only), s2 (the
outcome endpoint's service and the card) and s3 (the approve route's plan): waves 1, 2 and 3.
`kit/lib/help/entries` is declared by s2 (the command) and s3 (the skill): waves 2 and 3.
`kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them, and the wave rebuilds them
once.

## Per slice: done when

### s1 (deep: row-level security and a value written once)

- A migration dated after the newest on `main` adds `outcome` (`proposed`, `already` or `asks`),
  `outcome_pr` and `outcome_note` to `rewind_findings`, nullable, and its header names its rollback.
- `rewind_finding_outcome(workspace, finding, outcome, pr, note)` records the outcome once, for the
  service role or an agent link of the finding's workspace: `proposed` needs a pull request number,
  `already` and `asks` a note; a second outcome, a finding not approved, a missing value and a caller
  of another workspace are refused.
- A check under `supabase/checks/`, its own step of the `supabase` workflow, proves members read the
  columns and nobody writes them but through the function.
- `supabase/database.types.ts` holds the columns and the function.

### s2

- `omni rewind outcome <finding> --pr <n>`, `--already <rule>` and `--asks <question>` send the
  outcome and print it; exactly one of the three is required; tested through `main()` on a fixture
  repository, a refusal and a second outcome included.
- The endpoint answers only an agent link or a member of the finding's workspace, and turns a second
  outcome into its own refusal.
- On the Main tab an approved finding with an outcome shows `Rule proposed in PR #<n>` linking the
  pull request, `Already said by <rule>`, or the question; an approved knowledge finding without one
  shows `Proposing the rule…`. Component tests cover the four states.
- `omni help rewind` explains `outcome`.

### s3 (deep: the skill's judgment rules and its boundary)

- Approving a `knowledge` finding that is not a glossary term or a Legal entry queues
  `/omni:rewind-apply <finding id>` sent by the member; glossary and Legal findings still file their
  proposal; nothing queues `/omni:knowledge-add`.
- `kit/plugin/skills/rewind-apply/SKILL.md` settles one finding as the spec says: proposes (one
  playbook bullet ending `(rewind of PRD <prd>)`, or one register entry marked
  `Proposed: rewind <date>`, on `branches.knowledge` with `rewind-<prd>-<finding>`, one docs-only pull
  request into the default branch), already said, or asks; it writes only under the repository's
  `.omni-loop/knowledge/`, never the kit, never a locked law, never merges, and records its outcome
  with `omni rewind outcome`. `kit/test/rewind-apply-skill.test.ts` holds it to that, and
  `kit/test/plugin.test.ts` (N-PRODUCT-15) passes untouched.
- `rewind-apply` is a skill a runner may run (the kit's and the galaxy's lists), and `omni help` and
  the guide name it.
