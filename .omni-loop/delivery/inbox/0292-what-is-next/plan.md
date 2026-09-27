# Plan: What is next?

PRD #292, spec beside this plan (`spec.md`). The feature branch `feat/what-is-next` merges into
`main` through the feature PR, whose body says `Closes #292`. Each slice is a sub-PR from
`feat/what-is-next--<slice>` into the feature branch, whose body says `Part of #292`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The brainstorm and the plan end with a plain "What is next?". Covers: `/omni:brainstorm` step 10's three blocks (the PRD's folder as a tree, where it is on the six stages with "you are here" on PRD and the phase-0 merge on inbox, What is next? in three steps) and `/omni:yolo <n>` alone as the last line; step 2's issue line `once the phase-0 PR is merged`; `/omni:plan` step 7 returning silently to a caller and, run alone, What is next? in two steps; the assertions in the plugin test; one **Changed** line in each porting note | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/plan/` `kit/test/plugin.test.mjs` `kit/porting/plugin--brainstorm.md` `kit/porting/plugin--plan.md` | — | 1 |

**Shared ground.** One slice, so none. `kit/test/plugin.test.mjs` is also where every other skill's
guard lives: s1 adds one `describe` block and changes no existing assertion.

## Per slice: done when

**s1**

- `/omni:brainstorm` step 10 says to end the reply, after the report, with the PRD's folder as a
  tree (`<paths.delivery>/inbox/<folder>/`, `spec.md`, `plan.md`, `before-after.html`, a few words
  each), then **Where it is** (`idea ──▶ PRD ──▶ inbox ──▶ outbox ──▶ shipped ──▶ retro`, "you are
  here" under PRD, "merging the phase-0 PR moves it here" under inbox, one line per stage), then
  **What is next?** in three numbered steps (review the phase-0 PR, the dossier link on a second
  line only when one was printed; merge that PR, and the PRD moves into the inbox; once merged,
  `/clear` or a new terminal, then run), and `/omni:yolo <n>` alone as the last line.
- Step 2's issue template reads ``Next command: `/omni:yolo <n>`, once the phase-0 PR is merged``.
- `/omni:plan` step 7: followed by `/omni:brainstorm` or `/omni:yolo`, it returns without a
  **What is next?**; run alone, it ends with **What is next?** (review the plan on the draft feature
  PR; `/clear` or a new terminal, then run) and `/omni:yolo <n>` alone as the last line.
- A new block in `kit/test/plugin.test.mjs` asserts the spec's **Test seams** on the live skills,
  and fails when an asserted phrase is removed or the last fenced line is not `/omni:yolo <n>`.
- `kit/porting/plugin--brainstorm.md` and `kit/porting/plugin--plan.md` each carry a **Changed**
  line for PRD 292.
- `pnpm test` passes, `no-literals`, `no-game-words` and the plugin guard included.
