---
id: s3-01-bundle-rebuilt-on-zod-4
prd: 725
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The tool other repositories install is one big file, and the new library version makes it about sixty percent larger. Is that size acceptable?

## The decision, in plain words

The file was rebuilt with the new library and grows by about two thirds, to under two megabytes. It behaves the same and prints the same settings as before.

## The intro, for fun

The library came back from its upgrade with a suitcase full of languages.

## The punchline, for fun

Nobody asked for the French error messages, but they are on board now.

## The options, in plain words

A. Keep the larger rebuilt file, which behaves the same
B. Strip the library's foreign-language messages out of the file when it is built, and rebuild
C. Switch to the library's slimmer edition and rewrite the shapes to fit it

## What I had to decide

Moving to Zod 4 changes the code the committed bundle carries, so kit/test/dist.test.ts fails until kit/dist/omni.mjs is rebuilt, and kit/dist/ is outside s3's territory. Zod 4's classic entry exports every locale, which esbuild cannot shake out: the bundle grows from 1 071 145 to 1 715 301 bytes.

## What I did meanwhile

Rebuilt kit/dist/omni.mjs with `node kit/build.ts` and committed it alone. `node kit/dist/omni.mjs config` prints the same JSON as the bundle on the feature branch did.

## What it costs to change later

Cheap: a later slice can trim the locales (an esbuild alias for zod's locales, or `zod/mini`) and rebuild; the bundle is regenerated on every release anyway.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a 1.7 MB bundle matters to anyone installing the kit (author)
- Whether s17, which owns kit/build, would rather trim the locales there (author)
