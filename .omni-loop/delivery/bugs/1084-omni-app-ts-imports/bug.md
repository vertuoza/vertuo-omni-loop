# Bug 1084: omni-app crashes on every webhook (Cannot find module src/env.ts)

## Triage

- **Domain:** omni-app deployment: the GitHub App's Vercel functions (`apps/omni-app/api/`)
- **Risk:** critical — every workspace loses the whole GitHub App (outbox and inbox checks, retro and knowledge PRs, stage events, webhook touches) since 2026-10-02; no workaround short of a fix.
- **Regression:** yes — #726 turned the functions into TypeScript that imports TypeScript; the `outbox` check last ran on #900 (2026-10-01).

## Reproduction

- **File:** `apps/omni-app/src/vercel-functions.test.ts`
- **Red:** `AssertionError: expected [ 'github.ts', 'inngest.ts' ] to deeply equal []`, and each function failed to load with `ERR_MODULE_NOT_FOUND` (a local `vercel build` of main gave production's exact line: `Cannot find module '…/apps/omni-app/src/env.ts' imported from …/apps/omni-app/api/github.js`).

## Fix

Vercel compiles a TypeScript function file by file and keeps every `import './x.ts'` as written, so the deployed `github.js` imported an `env.ts` that was never shipped. The function sources move to `apps/omni-app/entries/`, and `apps/omni-app/build.ts` bundles each one with esbuild into a committed, self-contained `api/<name>.mjs` (the app, the kit and the workspace packages inside; npm packages left as imports Vercel traces), the way `kit/dist/omni.mjs` is built. `vercel.json` names the bundles.

## Guard

`apps/omni-app/src/vercel-functions.test.ts`: every file under `api/` is plain JavaScript, loads in a bare Node with type stripping off, and equals a fresh build of today's source, so a TypeScript function or a stale bundle fails CI.

## Mutation

mutation: no changed core file against origin/main (ee11bcb3): nothing to mutate
