# Live run: /omni:think-big (PRD 686, slice s4)

**Not run yet.** 2026-09-29. Nothing in this file was seen live: no gate, no round, no crown, no
concept PR and no `/omni:brainstorm --concept`.

The run is a person's session. The vast brief and the two gate lines are the person's words; every
round's reactions, the crown and the area-map edits are the person's picks, and the skill never
picks for them; the concept PR into `main` is merged by a person; and `/omni:brainstorm --concept`
reads the concept from `main`, so it runs only after that merge. s4 was taken by `/omni:wave`'s
slice agent, which cannot ask anyone, may not spawn the studio's agents, and never answers, picks,
crowns or merges in a person's place, so it ran none of it. What a person does is the human-action
item `s4-01-live-run-needs-a-person` in `.omni-loop/delivery/outbox/0686-think-big/`.

| | link |
| --- | --- |
| PRD | [#686](https://github.com/vertuoza/vertuo-omni-loop/issues/686) |
| feature PR | [#689](https://github.com/vertuoza/vertuo-omni-loop/pull/689), draft, into `main` |
| this slice | [#710](https://github.com/vertuoza/vertuo-omni-loop/pull/710), draft, into `feat/think-big` |
| concept issue | none yet |
| concept PR | none yet |

## Checked ahead of the run

- **The label is missing.** `omni:concept` does not exist on vertuoza/vertuo-omni-loop, and
  `labels.autoCreate` is false here: the concept's issue and PR cannot carry it until a person
  creates it, with `omni init`'s colour (`fbbf24`) and description.
- **Only the feature branch has the pieces.** `origin/main` has no `kit/plugin/skills/think-big/`,
  no `concept` verb in `kit/bin/commands/index.mjs`, and no `labels.concept` or `branches.concept`
  in `kit/lib/config.mjs`. On `feat/think-big`, `omni config labels.concept` prints `omni:concept`,
  `omni config branches.concept` prints `docs/concept-{topic}`, and `omni concept` runs. The session
  that runs the skill follows the feature branch's SKILL.md, as the live runs of PRDs 541 and 556
  did.
- **`omni concept` in the concept worktree.** This repository's `.omni-loop/bin/omni.mjs` is a shim
  onto the checkout's own `kit/bin/omni.mjs`, and the concept worktree is cut from `origin/main`, so
  the skill's `node .omni-loop/bin/omni.mjs concept <n>` has no such verb there. The kit reads the
  repository from the working directory, so the feature branch's kit run from inside the concept
  worktree grades it: `node <feat/think-big checkout>/kit/bin/omni.mjs concept <n>`.
- **A concept on `main` before #689 merges.** `main`'s layout lists only `<number>-<topic>` folders,
  so an `inbox/concepts/` folder adds no PRD there. No reader on `main` was run against one.

## What was seen

| criterion | seen |
| --- | --- |
| the run states the scale and the kind | not yet |
| a round-1 board of six to eight concepts | not yet |
| at least one deeper round of clickable prototypes | not yet |
| a debate in which panelists answer each other by name | not yet |
| the person's pick crowned, with a vision tour and an edited area map | not yet |
| one `omni:concept` PR whose `omni concept <n>` prints `ok`, linked from the feature PR | not yet |
| the gate on a feature-sized line says so and offers `/omni:brainstorm` or a lite run | not yet |
| the gate on a tweak gives the `/omni:visual-fix` line and writes nothing | not yet |
| `/omni:brainstorm --concept <n> <wedge>` writes back the brief, the vision and the verdict first | not yet: no concept PR exists to merge |
| `/omni:brainstorm --concept <n> nope` stops naming the area ids | not yet: no concept PR exists to merge |
