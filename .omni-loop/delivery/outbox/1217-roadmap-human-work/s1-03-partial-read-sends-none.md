---
id: s1-03-partial-read-sends-none
prd: 1217
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

When the code host answers only part of what the roadmap push reads, should the push still send the human work it did read?

## The decision, in plain words

No: when any part cannot be read, the push sends no human work at all, so nothing is wrongly marked done. The rest of the roadmap is still sent as before.

## The intro, for fun

Half a list looks a lot like a list where half the work got done.

## The punchline, for fun

So when a read hiccups, the list keeps its last good copy instead of guessing.

## The options, in plain words

A. A. Send no human work when any read fails (the option built).
B. B. Send what was read, and let a missing key close until the next push reopens it.
C. C. Fail the whole push as unreachable.

## What I had to decide

What omni roadmap push sends as humanWork when one of its reads of comments or of a feature branch's outbox fails.

## What I did meanwhile

readRoadmapPrds returns prdWork null on any failure while reading human work, and roadmapPushBody then leaves the humanWork field out, which the spec says closes nothing. In a plan repository, outbox items are read from the plan repository's own feature branch, where every target slice's items are relayed, and each is named by its slice's repository from the plan.

## What it costs to change later

A few lines of the push: sending what was read instead is one branch, and nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a push without the field closes nothing but not what to do when a read fails part way
- (author) The spec says each target's outbox in a plan repository; items of a target slice are relayed into the plan repository's outbox, so the targets' own branches are not read
