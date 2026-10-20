# `kit/plugin/skills/yolo-runner/SKILL.md` (`/omni:yolo-runner`)

Not a port: the skill is new in PRD 2251 and has no upstream. It follows `/omni:yolo-fix`'s shape
(front matter, the `omni` line, Step 0, a guardrails list).

## Added

- **Follow before send:** a bounded `omni runner follow <n>` (20 seconds) is the probe for a queued or
  running job, since the kit has no command that lists a PRD's jobs. A milestone that is not an ending
  means a job to follow; an ending or nothing means send.
- **Where:** `omni runner list --json` is named for the online runners and their free slots, and the
  skill sends to any runner when it is not there or fails. Outbox item s4-01.
- **The hand-off:** one ending per row, each with the last-line command the spec names; no feature
  folder tree, since the runner built it, not this session.
- Signs nothing: it commits and opens nothing.

## Tests

`kit/test/plugin.test.ts`, `/omni:yolo-runner and the hand-offs that name it`.
