---
id: s2-02-one-retro-at-a-time-per-repository
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The spec asks that only one retro of the same product request runs at a time in a repository, but which request a merge belongs to is only known once the retro has started reading. How should retros be kept apart?

## The decision, in plain words

Only one retro runs at a time in each repository, whatever request it is for. Two retros of the same request can never overlap, and merges are rare enough that waiting costs little.

## The intro, for fun

Two retros walk into the same repository at once and reach for the same branch.

## The punchline, for fun

So they queue politely, one at a time, like people at a single coffee machine.

## The options, in plain words

A. One retro at a time per repository, the option built.
B. One at a time per repository and feature branch, adding the branch's name to the event the webhook sends.
C. One at a time per repository and pull request number, which lets two retros of one request race on the same branch.

## What I had to decide

The retro function's concurrency key. The spec ("Flow") gives it "its own concurrency key (repository + PRD)", but the event carries only the repository and the pull request number (the spec's own event shape); the PRD is known after the step "qualify" reads the config and the delivery folder at the merge SHA, and a concurrency key is read from the event before the run starts.

## What I did meanwhile

`CONCURRENCY` in `src/retro/retro.mjs` is `{ key: 'event.data.repository', limit: 1 }`: one retro at a time per repository, which also keeps two retros of one PRD apart. Its test pins the key.

## What it costs to change later

One constant. Keying on the repository and the feature branch's name instead would need the head ref added to the event the webhook sends, one more field and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How often two feature PRs of one repository merge within the minutes a retro takes; if often, the queue is felt.
