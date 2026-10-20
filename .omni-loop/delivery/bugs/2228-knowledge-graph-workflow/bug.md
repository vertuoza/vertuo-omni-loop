# Bug 2228: the knowledge-graph workflow crashes on main: kit/dist/omni.mjs cannot find 'yaml'

## Triage

- **Domain:** kit CI: the knowledge graph push (PRD 1798 s7), `.github/workflows/knowledge-graph.yml`
- **Risk:** medium — this repository's knowledge graph never reaches its Omni page on a push to main and the workflow is red; workaround: run `omni kb graph push` by hand.
- **Regression:** new bug — no evidence this ever worked (every earlier run took the "OMNI_TOKEN is not set" path and exited 0)

## Reproduction

- **File:** `scripts/knowledge-graph-workflow.test.ts`
- **Red:** `× installs the workspace before omni runs, since this repository runs the kit source (#2228)`; and, run as the job ran it in a checkout with no install, `node kit/dist/omni.mjs help kb` → `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'yaml' imported from .../kit/lib/config.ts`

## Fix

`kit/dist/omni.mjs` is the launcher (PRD 420): inside a checkout whose `.omni-loop/bin/omni.mjs` is another file, it hands over to it, and in this repository that file is a shim onto the kit's TypeScript source, which needs `node_modules`. The workflow installed nothing. It now sets up pnpm, installs the workspace (`pnpm install --frozen-lockfile`) and runs `node .omni-loop/bin/omni.mjs kb graph push`, the same command the guide gives other repositories, whose bin is the dependency-free bundle and needs no install; the guide's sentence about this workflow now names that command.

## Guard

`scripts/omni-workflows.test.ts`: every job of `.github/workflows/` that runs `node .omni-loop/bin/omni.mjs` or `node kit/dist/omni.mjs` installs the workspace earlier in the same job (red on main's `knowledge-graph.yml › push`), and the workflow `docs/guide/products.md` gives another repository calls `.omni-loop/bin/omni.mjs`, never `kit/dist/`.

## Mutation

`mutation: no changed core file against origin/main (7a517ebe): nothing to mutate`
