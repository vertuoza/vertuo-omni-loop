---
id: s1-01-server-only-exemptions
prd: 1066
slice: s1
rank: medium
bears-on: none
raised: 2026-10-04
wave: 1
---

## The question, in plain words

Which server files of the arcade may go without the server-only label: should a file that only borrows a type from the server settings, or one used only while the site is being built, still carry it?

## The decision, in plain words

Only files that run server code need the label. Files that borrow a type and nothing else, the guide's diagram reader used while the guide is compiled, and the build's own configuration go without it, because the label would break the build for them.

## The intro, for fun

A label that says server only is great, until the builder itself trips over it.

## The punchline, for fun

So the label goes on what runs on the server, and the scaffolding stays bare.

## The options, in plain words

A. A. Only files that run server code carry the label; type borrowers and build-time files go without it (what was built).
B. B. Count borrowed types too, after moving those shared types somewhere the browser may safely read.
C. C. Exempt nothing, and move the guide diagram reader out of the arcade code the browser can reach.

## What I had to decide

Whether the coming import guard (s3) counts a type-only import of the server environment, and whether build-time modules are exempt from the server-only rule.

## What I did meanwhile

Twenty-nine arcade files carry the marker. Left without it: src/ask/classify.ts, src/business/suggest.ts, src/business/draft/extract.ts, src/releases/page/source.ts and src/releases/sync-run.ts (their src/env.ts import is type-only, and classify.ts and suggest.ts are reached from 'use client' files, so the marker would fail next build); src/docs/diagrams.ts (source.config.ts loads it while fumadocs-mdx compiles the guide under plain Node, where the marker throws); next.config.ts and artifact/build.ts (build configuration and a bundling script, like apps/galaxy/scripts/). s3's guard should count only value imports for this rule and exempt those build-time files.

## What it costs to change later

Changing it later is a few lines in the guard and, at most, moving the OpenRouter env types out of src/env.ts so client-reachable files no longer name it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a type-only import counts for the rule table, and does not say whether it counts for the server-only marker rule (author).
