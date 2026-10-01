---
id: s22-03-app-imports-zod-through-the-root
prd: 725
slice: s22
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The app's retro now checks GitHub's answers with the tool's checking library, which the app's own list of dependencies does not name. Should that list name it?

## The decision, in plain words

The retro uses the library the tool already brings with it, found the same way the tool's own files the app runs find it, and the app's list of dependencies is left as it was, since changing it is outside this slice.

## The intro, for fun

The app borrowed the tool's tape measure without writing it on its own packing list.

## The punchline, for fun

It is in the same truck, so nothing is lost, yet a careful packer would add the line.

## The options, in plain words

A. Use the library through the root package, as the tool's own files the app runs already do
B. Add the library to the app's own list of dependencies in a later change
C. Re-export the library from the tool, and have the app import it from there

## What I had to decide

apps/omni-app/src/retro/github.schema.ts and retro.ts import 'zod'. apps/omni-app/package.json lists no zod; it resolves from the root package (vertuo-omni-plan), whose kit files the app already imports and which import zod themselves. The package.json is outside s22's territory.

## What I did meanwhile

Imported 'zod' directly, as the kit files the app runs do; the app's tests, typecheck and imports resolve it from the workspace root (Zod 4).

## What it costs to change later

Cheap: add zod ^4 to apps/omni-app/package.json and the lockfile in one later change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the App's Vercel build installs only the app's own dependencies, in which case the kit's zod imports would already fail today (author)
