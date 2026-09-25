---
id: s3-03-build-script-outfile-and-fixed-working-dir
prd: 39
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

To check that the committed installer file is up to date, the tests have to build a fresh copy somewhere else. May this slice change the build script, which belongs to the first slice, to allow that?

## The decision, in plain words

Yes: the build script now takes an optional output location and always builds the same way wherever it is started from, so the check compares like with like without ever overwriting the committed file.

## The options, in plain words

A. Change the build script: optional output file, working directory pinned to the repository root (built).
B. Leave the build script alone and have the drift test rebuild the committed bundle in place, then compare against the committed blob in git.
C. Duplicate the esbuild options inside the test.

## What I had to decide

Whether to change kit/build.mjs, which is outside s3's territory, so the drift test can build to a temporary file and so the bundle does not depend on the working directory.

## What I did meanwhile

kit/build.mjs takes an optional outfile argument (default kit/dist/omni.mjs) and sets esbuild's absWorkingDir to the repository root; without it, esbuild's per-module path comments changed with the cwd and a build from kit/ differed from one from the root. The s1 real-bundle test in kit/bin/init.test.mjs now builds to a scratch file instead of rewriting kit/dist/omni.mjs.

## What it costs to change later

A few lines in the build script; undoing it means the drift test must rebuild kit/dist/omni.mjs in place.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s3 does not list kit/build.mjs, though its drift test needs a build to a second file.
