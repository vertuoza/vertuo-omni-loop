---
id: s5-04-wave-result-shape
prd: 7
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

What does the slice builder hand back to the wave when it finishes, so the wave can decide what to merge?

## The decision, in plain words

The same short summary upstream used: the slice, whether it is done, stopped or blocked, its branch and pull request, whether its checks passed, and the decisions and risks it raised.

## The options, in plain words

A. Upstream's shape, with a none value for a repository with no preflight, the option built.
B. Upstream's shape plus a list of checks that did not run.
C. Free text only, parsed by the wave.

## What I had to decide

The result shape do-work returns under --in-wave, which /omni:wave (s8) consumes: kept upstream's { slice, status, branch, prUrl, preflight, summary, risks, items }, with preflight as green | red | none.

## What I did meanwhile

Wrote that shape into the skill's Under --in-wave section; s8 reads it.

## What it costs to change later

Changing the shape in do-work and wave together; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the wave also wants the checks that did not run as a field rather than in the summary (author).
