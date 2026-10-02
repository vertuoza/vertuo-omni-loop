---
form: architecture
form-version: 1
state: filled
points-to: null
evidence:
  - pnpm-workspace.yaml@ffd7b91
  - README.md@7eaaaa0
  - apps/omni-app/README.md@ed64d66
  - game/README.md@1654a62
  - kit/build.ts@3cd94b3
  - kit/test/no-literals.test.ts@2c26671
  - kit/test/dist.test.ts@e236e83
  - .omni-loop/bin/omni.mjs@f3aa720
terraformed: 2026-09-25
---

# Architecture

Use this page when deciding where code goes, and what it may depend on.

## Layout
<!-- slot: layout · required · by: terraform · verified: 2026-09-25 -->
A pnpm workspace (`pnpm-workspace.yaml`): the root package holds the kit (`kit/`) and the game
layer (`game/`); `apps/*` and `packages/*` hold the rest. The README's layout table names every
workspace package but one: `apps/omni-app`, the GitHub App that posts the outbox check.

- `kit/`: the `omni` CLI's source in `kit/bin` and `kit/lib`, the kit defaults in `kit/templates`,
  the plugin's skills in `kit/plugin`, and the committed bundle `kit/dist/omni.mjs`, which
  `pnpm kit:build` writes. This repository's own `.omni-loop/bin/omni.mjs` is a shim onto the
  source, not the bundle, so the skills run today's code here.
- `.omni-loop/`: this repository's own loop: its config, its delivery folder (each PRD's spec,
  plan and outbox) and this knowledge.

## Boundaries
<!-- slot: boundaries · required · by: human -->
- The game only reads the delivery layer: deleting `game/` and `.github/workflows/game.yml`
  removes it without touching delivery (README.md). It writes to no repository; its only outputs
  are the ledger in Supabase, one weekly comment and a backup (game/README.md).
- The kit holds no repository literal, and a kit default names no package manager:
  `kit/test/no-literals.test.ts` scans `kit/lib`, `kit/bin`, `kit/plugin` and `kit/templates`.
- `kit/dist/omni.mjs` is only ever a build of the source: `kit/test/dist.test.ts` fails when it
  differs from a fresh build.
- The GitHub App reuses the kit's gate unchanged and never runs repository code: it reads only YAML
  and Markdown, through the kit's schemas (apps/omni-app/README.md).
- The GitHub App's Inngest plan caps how long a run may sleep at 7 days (answered on #75, PRD 72):
  anything that waits longer, like the retro's second look 14 days after a merge, runs from a daily
  scheduled function, never from one long sleep.
- `kit/` holds only the kit that ships to other repositories. A check or tool about this
  repository as a whole (its TypeScript guard, its ceilings) lives in `scripts/`, never under
  `kit/`, so the kit's rule against naming the game needs no exception (settled item s11-01, PRD 942).

## Patterns
<!-- slot: patterns · optional -->
