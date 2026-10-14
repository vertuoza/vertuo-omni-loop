# Plan: a test's criticality is decided by the critical flows it covers

PRD #1737, its spec beside this plan. The feature branch `feat/e2e-test-criticality` goes into `main` with `Closes #1737`; each slice is a sub-PR from `feat/e2e-test-criticality--<slice>` into the feature branch with `Part of #1737`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A product's `<e2e.dir>/critical-flows.md` is parsed and refused by name when a flow lacks an id or a name or an id is used twice | `kit/lib/e2e/flows.ts` `kit/lib/e2e/flows.test.ts` | — | 1 |
| s2 | `/omni:validate-e2e` asks which flow a new test covers and whether its failure breaks it, writes `critical` or `standard` from the answers, takes `standard` under `/omni:yolo` with one medium outbox item, and the guide describes the list, the tags and the two levels | `kit/plugin/skills/validate-e2e/` `docs/guide/validate-e2e.md` `kit/test/plugin.test.ts` | — | 1 |
| s3 | `omni e2e status` prints each test's level and flow and exits 1 on a `critical` test with no flow tag or a flow not in the list, with its tests and help text | `kit/lib/e2e/recording.ts` `kit/lib/e2e/status.ts` `kit/lib/e2e/status.test.ts` `kit/bin/commands/e2e.ts` `kit/bin/commands/e2e.test.ts` `kit/lib/help/entries.ts` `kit/lib/help/entries.test.ts` | s1 | 2 |

Shared ground: none. s1 and s2 share no path and run in wave 1. s3 waits for s1 because it reads the parser s1 writes, and owns every file `omni e2e status` touches.

## Per slice: done when

**s1**
- A well-formed list yields each flow's id, name and cost, in order.
- A flow without an id, a flow without a name and an id used twice are each refused, and the refusal names the flow.
- An empty or absent file is reported as "no list", not as a parse error.

**s2**
- The skill's test-writing step asks, for each new test, which flow of the list it covers (or none) and whether its failure breaks that flow.
- The skill writes the tag `flow-<id>` and the tag `critical` for a flow and a breaking failure, and writes neither for no flow.
- A flow the list does not hold is proposed as a new entry in the sub-PR, never written silently.
- Under `/omni:yolo` the skill writes `standard`, asks nothing and records one medium outbox item carrying the question and its recommended answer.
- The guide describes the list, the two tags, the two levels and that the CI jobs that run them are PRD #1277's.
- The plugin test that reads the skill passes.

**s3**
- `omni e2e status` prints, for each tagged test, its level (`critical` or `standard`) and its flow; a file with no `critical` tag is `standard`.
- A test tagged `critical` whose `flow-<id>` is not in the list exits 1 and names the test and the missing flow.
- A test tagged `critical` with no `flow-<id>` tag exits 1 the same way.
- A list that does not parse exits 1 with s1's refusal.
- The JSON keeps every field it had and adds `level` and `flow`; the help text says so.
