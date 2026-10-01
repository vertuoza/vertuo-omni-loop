---
id: s4-02-core-reads-config-keys-one-by-one
prd: 725
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The core modules need the type of the whole settings file, but the slice that writes the shared types runs at the same time. Where should the core modules take that type from meanwhile?

## The decision, in plain words

They take it from what the settings reader already returns, and read the few settings they use one by one. Once the shared types land, the same code simply gets stricter.

## The intro, for fun

Two slices needed the same settings type on the same afternoon.

## The punchline, for fun

One borrowed it from the reader and promised to give it back.

## The options, in plain words

A. A: borrow the type from the settings reader now, and read the few settings used one by one
B. B: wait for the shared types slice before typing the core modules
C. C: write a separate hand-made settings type in the core modules now

## What I had to decide

Which Config type kit/lib/context.ts exports while s3 (kit/lib/types.ts, kit/lib/schema/) is in flight in the same wave, and how sections typed loosely by config.ts's untyped section() helper are read.

## What I did meanwhile

context.ts exports `Config = ReturnType<typeof loadConfig>` and `Context = ReturnType<typeof createContext>`. Because config.ts is still @ts-nocheck, its `section()` sections (paths, laws, markers…) come out as `{ [x: string]: any }`; createContext passes the four `paths` keys the layout reads one by one, and lawsFor reads `laws.source` and `laws.claudeMdHeading` into typed locals. Functions that need little take narrow structural types (`{ root: string }`, `TrailerSignature`, `LayoutPaths`, `BoardConfig`). No cast was added.

## What it costs to change later

A one-line change in context.ts to `export type { Config } from './types.ts'` (or z.infer of s3's schema) once s3 merges; the key-by-key reads keep working and can be folded back to `config.paths` when the section types are exact.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3 will type config.ts's section() helper so its sections infer exactly is not settled in the plan (author)
