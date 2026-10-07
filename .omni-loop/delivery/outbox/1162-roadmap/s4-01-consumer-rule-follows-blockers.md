---
id: s4-01-consumer-rule-follows-blockers
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When a roadmap has a project in a repository that installs another repository's package, which earlier projects must it come after?

## The decision, in plain words

It must come after every project it waits on, directly or through others, that changes the repository it installs from. Projects that do not wait on each other may still run side by side in the same wave.

## The intro, for fun

Two repositories, one package, and a question of who goes first.

## The punchline, for fun

Only the ones holding hands have to queue.

## The options, in plain words

A. A. Only the provider projects it waits on, directly or through others (built).
B. B. Every provider project of an earlier or the same wave, whether it waits on it or not.
C. C. Only the provider projects it waits on directly.

## What I had to decide

Whether the rule binds only the projects a consumer waits on (built), or every provider project against every consumer project of the roadmap, which would force all provider work before any consumer work.

## What I did meanwhile

The check refuses a consumer project whose wave is not after a provider project it waits on; unrelated projects in the two repositories run in parallel.

## What it costs to change later

Switching to the global reading is one extra loop in the roadmap grade and its tests; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's sentence reads either way; the narrower reading was taken because the wider one would refuse the spec's own example roadmap once crew consumes ai-domain (author).
