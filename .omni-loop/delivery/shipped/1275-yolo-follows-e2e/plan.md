# Plan: The e2e skill is followed by /omni:yolo when the spec asks

PRD #1275, spec beside this plan (`spec.md`). The feature branch `feat/yolo-follows-e2e` goes into
`main` with `Closes #1275`; each slice is a sub-PR from `feat/yolo-follows-e2e--<slice>` into the
feature branch with `Part of #1275`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A spec's front matter may hold `e2e: validate`, and `omni check inbox` refuses any other value, naming the PRD | `kit/lib/schema/front-matter.ts` `kit/lib/types.ts` `kit/lib/inbox/` | — | 1 |
| s2 | `/omni:yolo` follows `/omni:validate-e2e` after the feature PR is ready, only when the spec says `e2e: validate` and e2e is enabled, and never changes the PR's state | `kit/plugin/skills/yolo/` `kit/test/plugin.test.ts` | s1 | 2 |
| s3 | `/omni:brainstorm` asks whether to validate with e2e, only when the repository has e2e enabled, and writes the field on a yes | `kit/plugin/skills/brainstorm/` `kit/test/plugin.test.ts` | s2 | 3 |
| s4 | The guide and the help entries name the field and the automatic step | `docs/guide/` `kit/lib/help/` | s2 | 3 |

Shared ground: `kit/test/plugin.test.ts` is declared by s2 and s3, kept apart by s3 being blocked by
s2 (wave 3 after wave 2). s3 and s4 share a wave and no ground. The generated `kit/dist/` is rebuilt
by the wave, not listed.

## Per slice: done when

### s1
- A spec with `e2e: validate` reads as a record carrying it; one without it reads exactly as before.
- Any other value is refused by the schema and by `omni check inbox`, with a message naming the PRD and
  the allowed value; an unknown-field message lists the new field.
- Tests in `kit/lib/inbox/` and the schema cover the accepted, absent and refused cases.

### s2
- Step 5 of the yolo skill gains an item after the ready step, naming `/omni:validate-e2e`, run only
  when the spec says `e2e: validate` and `omni config e2e` has `enabled` true; otherwise no e2e step.
- It says that a ✗, a stop line or a failed run never changes the feature PR's draft or ready state,
  its labels or its checks, and that the run goes on to step 6.
- `kit/test/plugin.test.ts` pins that the step comes after the ready step and names each guard.

### s3
- The brainstorm skill asks one yes/no question, only when e2e is enabled in the config, and writes
  `e2e: validate` on a yes; with e2e off it asks and writes nothing.
- `kit/test/plugin.test.ts` pins the question, its condition and the field.

### s4
- `docs/guide/validate-e2e.md` explains the field, the automatic step after ready and that it never
  blocks; the `omni check` and skill help entries mention the field where they list front matter.
