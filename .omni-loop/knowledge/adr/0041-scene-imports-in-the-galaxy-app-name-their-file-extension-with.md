# ADR-0041 — Scene imports in the galaxy app name their file extension, with allowImportingTsExtensions on

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #94 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #95

## Context

The plan names each group's canvas `scenes/<group>.ts` and its text layer `scenes/<group>.tsx`. With both present, an import without an extension is ambiguous, and the tools disagree on it: TypeScript resolves `./scenes/attract` to `attract.ts`, while Turbopack, webpack and esbuild try `.tsx` first, so the same line would type-check against one file and bundle the other. The imports therefore name the extension (`./scenes/attract.tsx`), which `tsc` refuses (TS5097) unless `allowImportingTsExtensions` is on. `apps/galaxy/tsconfig.json` is outside s2's territory, and no slice of the plan owns it.

## Decision

Each scene group keeps scenes/<group>.ts and scenes/<group>.tsx, and every scene import names its extension. apps/galaxy/tsconfig.json turns on allowImportingTsExtensions so tsc accepts this.

The option chosen: A. Keep the setting on and the file names from the plan; every place that uses a group's files says which of the two it means.

## Consequences

A constant: one line in the tsconfig. Going the other way means renaming the seven text layers and `scenes/common.tsx` (to `scenes/<group>.screen.tsx`, say, still under each wave-3 slice's `scenes/<group>.` prefix) and dropping the extensions from about fifteen import lines. No data, no stored shape and no shared contract move. Until then, later slices must keep writing the extension on a scene import: one written without it type-checks against the canvas file but is bundled from the text layer.

## Source

`.omni-loop/delivery/shipped/0094-game-boy-handheld/outbox/settled.md`, entry `s2-01-scene-imports-name-their-extension`
