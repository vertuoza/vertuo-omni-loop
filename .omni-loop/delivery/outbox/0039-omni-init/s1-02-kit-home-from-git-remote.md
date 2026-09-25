---
id: s1-02-kit-home-from-git-remote
prd: 39
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the installer is run from a developer's copy of the kit instead of the one-line install, it has to tell the person which one line to run instead. Where should it get the kit's own address from?

## The decision, in plain words

It reads the address from the copy's own link to GitHub, and the packaged installer records that same address when it is built, so the address is written in one place only: wherever the kit is really fetched from.

## The options, in plain words

A. Read the kit address from the kit checkout's origin remote, recorded in the bundle at build time (built).
B. Write the address once as a constant in the build script and inject it into the bundle, and have source read it from there too.
C. Read it from the repository field of the package description that the last slice adds.

## What I had to decide

Whether the kit's own repository address (used in the npx line the refusal prints, and later in the closing steps) is read from the kit checkout's origin remote — at build time for the bundle, at run time from source — or written as one constant in the kit.

## What I did meanwhile

kit/build.mjs reads `git remote get-url origin` of the kit checkout and records the slug in the bundle's `__OMNI_BUNDLE__` marker; from source, kit/lib/init/bundle.mjs reads the same remote at run time. The no-literals guard forbids the literal in kit/lib and kit/bin, which is why no constant was written there.

## What it costs to change later

One function (kitHome) and the define in kit/build.mjs: swapping in a constant elsewhere is a few lines, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A bundle built in a clone whose origin is a fork records the fork; whether s3's drift test should pin the slug instead is not settled here.
- (author) The spec says the App slug and marketplace names are constants in init; this slice only needed the kit address, so s3 still chooses where those live.
