---
id: s3-02-mega-pr-care-reads-hold
prd: 2746
slice: s3
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

The spec asks the multi-repository review watcher to check the hold before marking a pull request ready, but that watcher is never allowed to mark anything ready. What should it do with the hold?

## The decision, in plain words

The watcher reads the hold every round and writes what each held pull request waits for on its status comment, and still never marks anything ready. The skills that do mark ready check the hold again first.

## The intro, for fun

Asking the night guard to open the doors he has no key for.

## The punchline, for fun

He now tells you which door is still locked, and why.

## The options, in plain words

A. A. The watcher reads and reports the hold each round and never marks ready.
B. B. The watcher also marks a pull request ready once its hold is clear, lifting its guardrail for that case.

## What I had to decide

Whether the watcher keeps its rule of never marking ready, or gains the right to mark a pull request ready once its provider is served.

## What I did meanwhile

Held pull requests stay drafts and show their waiting line; the drive loop and the build skills mark them ready once the hold clears.

## What it costs to change later

Letting the watcher mark ready later is a few lines in one skill and the guardrail it lifts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's line for this skill says before gh pr ready; this skill names no gh pr ready at all, and a plugin test holds it to that (author)
