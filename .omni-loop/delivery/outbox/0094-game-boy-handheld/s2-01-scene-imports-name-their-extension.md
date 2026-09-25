---
id: s2-01-scene-imports-name-their-extension
prd: 94
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Each group of screens now keeps its drawing and its on-screen words in two files that share a name, and the project's type checker only tells the two apart once a setting outside this slice's files is switched on. Is switching that setting on the right call?

## The decision, in plain words

I switched the setting on, so the files keep the names the plan gives them, and every place that uses one of them says which of the two it means.

## The intro, for fun

Two files walk into a folder, both answering to the same name.

## The punchline, for fun

Now everyone who calls them has to use their full names.

## The options, in plain words

A. Keep the setting on and the file names from the plan; every place that uses a group's files says which of the two it means.
B. Leave the setting off and give each group's on-screen words file a longer name, so no two files in the folder share a name.
C. Leave the setting off and give each group a folder of its own, with one file for the drawing, one for the words and one for the styles.

## What I had to decide

The plan names each group's canvas `scenes/<group>.ts` and its text layer `scenes/<group>.tsx`. With both present, an import without an extension is ambiguous, and the tools disagree on it: TypeScript resolves `./scenes/attract` to `attract.ts`, while Turbopack, webpack and esbuild try `.tsx` first, so the same line would type-check against one file and bundle the other. The imports therefore name the extension (`./scenes/attract.tsx`), which `tsc` refuses (TS5097) unless `allowImportingTsExtensions` is on. `apps/galaxy/tsconfig.json` is outside s2's territory, and no slice of the plan owns it.

## What I did meanwhile

Added `"allowImportingTsExtensions": true` to `apps/galaxy/tsconfig.json` (allowed, since `noEmit` is already on) and wrote every import of a scene module with its extension: `ArcadeApp.tsx` imports each text layer as `./scenes/<group>.tsx`, and the modules inside `scenes/` import `./common.ts`, `./common.tsx` and each other the same way. `pnpm --filter @omni/galaxy-app typecheck`, `pnpm galaxy:build` (which type-checks too), `pnpm test` and `pnpm galaxy:artifact` are green.

## What it costs to change later

A constant: one line in the tsconfig. Going the other way means renaming the seven text layers and `scenes/common.tsx` (to `scenes/<group>.screen.tsx`, say, still under each wave-3 slice's `scenes/<group>.` prefix) and dropping the extensions from about fifteen import lines. No data, no stored shape and no shared contract move. Until then, later slices must keep writing the extension on a scene import: one written without it type-checks against the canvas file but is bundled from the text layer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the files `scenes/<group>.ts` and `scenes/<group>.tsx` but does not say how an import tells the two apart, nor whether a slice may change `apps/galaxy/tsconfig.json` to allow it.
