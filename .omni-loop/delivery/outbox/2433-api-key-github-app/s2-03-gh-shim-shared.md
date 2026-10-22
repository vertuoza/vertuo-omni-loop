---
id: s2-03-gh-shim-shared
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A job running as the GitHub App must not use the machine's own GitHub sign-in when it runs the GitHub command line tool. How should the runner put the app's tool in front of it?

## The decision, in plain words

The runner installs one small stand-in for the GitHub command line tool in a folder of its own, shared by all jobs on the machine, and puts that folder first on the job's search path. The stand-in holds no token.

## The intro, for fun

A doorman who asks the right keyholder every single time.

## The punchline, for fun

He never carries the key, so there is nothing to lose.

## The options, in plain words

A. A. One shared, token-less stand-in under the runner's config folder, installed once and kept.
B. B. One stand-in per job in the job's own folder, removed when the job ends.

## What I had to decide

Pick A to keep one shared stand-in under the runner's own config folder. Pick B to write one per job and remove it at the job's end, at the price of more files written for every job.

## What I did meanwhile

Option A is built: `~/.config/omni/runner/bin/gh` runs the real `gh` with `GH_TOKEN` read from `omni runner github-token` at call time, so it holds no secret and persists between jobs; a job with no app never sees it.

## What it costs to change later

Switching to B moves the install into the job's folder and adds a removal step in `kit/lib/runner/runner.ts`: about thirty lines, with no data to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Two runners on one machine would share the stand-in; it is stateless, so they cannot disagree.
- (author) A person's own `gh` is found by searching the path past the shim: if none is installed, the stand-in refuses with a plain line.
