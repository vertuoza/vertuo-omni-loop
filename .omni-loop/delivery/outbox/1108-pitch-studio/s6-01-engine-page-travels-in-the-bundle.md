---
id: s6-01-engine-page-travels-in-the-bundle
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

A team that installed the kit holds a single copy of the command-line tool and nothing else. How does that copy reach the animation page it needs to film a pitch?

## The decision, in plain words

The tool carries the animation page inside itself, as text, and hands it out from a small local server while it films or previews. Nothing extra is installed or copied into the team's folder; the tool grows by about seven hundred kilobytes.

## The intro, for fun

One suitcase allowed on the plane, and the costume does not fit in the carry-on.

## The punchline, for fun

So we folded the costume into the suitcase lining.

## The options, in plain words

A. A. The tool carries the animation page inside itself and hands it out while it works (built).
B. B. The page ships as its own folder beside the tool, copied in when the kit is installed or updated.
C. C. The tool downloads the page from the kit's home the first time it needs it.

## What I had to decide

How the render and the studio reach the engine page in a repository that only carries the bundle.

## What I did meanwhile

kit/build.ts builds the engine first and defines __OMNI_PITCH_ENGINE__ with its two files' text; kit/lib/pitch/render-page.ts reads it (or kit/dist/pitch-engine/ from source) and render-server.ts serves it from memory. package.json files and kit/test/dist.test.ts are unchanged. A test runs omni pitch studio from a lone copy of the bundle and gets the page byte for byte.

## What it costs to change later

A few lines: the build's define and the page loader. Shipping the folder instead means adding it to package.json files, to the install that copies the bundle, and to kit/test/dist.test.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The bundle grows from 1.9 MB to 2.7 MB, in every repository that carries it; nobody stated a size limit.
- (author) kit/build.ts lies outside this slice's territory; the build had to change for the bundle to carry the page.
