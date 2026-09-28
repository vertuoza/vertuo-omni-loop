---
id: s4-01-installed-version-from-the-bin
prd: 347
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When the update command is started from the latest kit fetched on the fly, rather than from the copy the repository keeps, how does it know which version the repository really runs?

## The decision, in plain words

It reads the version written inside the repository's own copy of the tool, and treats a copy with no version as the oldest one, so a repository installed before versions still gets its update pull request.

## The intro, for fun

Asking the newest tool how old the repository is gives a very flattering answer.

## The punchline, for fun

So we check the birth certificate on the repository's own copy instead.

## The options, in plain words

A. Compare the target with the version the repository's bin carries, and apply in place when the running omni is the target (built).
B. Compare with the running omni's version only, as the spec words it, and have the README tell unversioned repositories to pass an explicit --to.
C. Ask the repository's bin itself for its version by running it, and treat a bin with no version command as unversioned.

## What I had to decide

Whether omni update compares the target with the version the repository's bin carries, read from the marker the build writes, rather than with the running omni's own version.

## What I did meanwhile

omni update reads the installed version from .omni-loop/bin/omni.mjs (the running version when that bin is the one running, else the marker the build stamped, null without one). When the running omni is the target but not the repository's bin, as with npx github:vertuoza/vertuo-omni-loop update, it applies itself with no download.

## What it costs to change later

A constant: the comparison lives in kit/lib/update/installed.mjs and kit/bin/commands/update.mjs. Reading the marker leans on how esbuild prints a define; if that shape changes, the bin reads as unversioned and the update opens a pull request that may change nothing but the bin.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the running version is compared with the target; taken literally, npx on an unversioned repository runs the latest bundle and reports up to date, so acceptance criterion 9 could not hold. Not asked of a person.
