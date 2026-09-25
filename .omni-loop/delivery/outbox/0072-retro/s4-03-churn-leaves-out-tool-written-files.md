---
id: s4-03-churn-leaves-out-tool-written-files
prd: 72
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the retro leaves out files that tools write to record exact versions, and files marked as generated, but names neither those files nor what to show when the code host sends back none of the history. Which files, and what then?

## The decision, in plain words

The retro leaves out the version records of the common package tools, by name, and whatever the repository's root attributes file marks as generated. When the code host returns none of the history, the retro leaves this section out rather than show zeros, and its data file says what could not be read.

## The intro, for fun

Some files are written by machines for machines, and counting their rewrites is like grading a photocopier.

## The punchline, for fun

So those files stay out of the count, and an empty history gets no section of its own.

## The options, in plain words

A. The common version records by name and the root attributes file, no section when nothing could be read, the option built.
B. The same, with one line saying this part could not be counted when nothing was read.
C. Only the version record of the tool this repository uses, and the attributes files of every folder.

## What I had to decide

`LOCKFILES` in `kinds/churn-generated.mjs`, which `.gitattributes` `gather` reads, and what `describe` shows when GitHub returns no commit. The spec ("The facts, and what makes a finding") says churn leaves out "paths marked `linguist-generated` in `.gitattributes` at the merge SHA, and lockfiles by name", naming neither the names nor the case where nothing could be read.

## What I did meanwhile

`LOCKFILES` holds 22 names (pnpm, npm, yarn, bun, deno, Cargo, Bundler, Composer, Poetry, Pipenv, uv, PDM, Go, Mix, pub, CocoaPods, SwiftPM, NuGet, Nix, Gradle), matched by file name at any depth. Only the root `.gitattributes` at the merge is read, by git's pattern rules: a later line wins, `-linguist-generated` unsets. A pull request whose commits GitHub answers 404, a commit it answers 404 or 422, and a final diff it answers 404 are named in the section as not read; when no commit at all was read the section is left out, so the PRD 50 recording, which holds no commits, keeps its golden retro, and `retro.json` still keeps what was not read.

## What it costs to change later

One constant to extend. Reading the `.gitattributes` of every folder is one more read per folder holding one. A line saying churn could not be counted changes `describe` and the PRD 50 golden retro.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which package managers the repositories running the loop use besides pnpm.
- (author) Whether a retro should say plainly that this part could not be counted rather than leave its section out.
