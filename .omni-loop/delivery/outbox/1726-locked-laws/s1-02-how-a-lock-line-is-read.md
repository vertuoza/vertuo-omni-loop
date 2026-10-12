---
id: s1-02-how-a-lock-line-is-read
prd: 1726
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

How strict should the knowledge check be about a lock line that is badly written, or that sits beside other lines that contradict it?

## The decision, in plain words

Strict: a badly written lock still counts and is refused until fixed, and so is a lock on a rule still marked proposed or whose test is only promised. Owners are written without the at sign, and a copy of another repository's knowledge is never asked about the cap or the owners.

## The intro, for fun

A lock scribbled in pencil is still a lock.

## The punchline, for fun

Better a red check today than a quiet law nobody guards.

## The options, in plain words

A. A. Fail closed: a malformed lock counts and is refused; lock beside Proposed: is refused; pending is no test; owners without @.
B. B. Lenient: a malformed lock is ignored with a warning, pending counts as a test, and owners may carry @.

## What I had to decide

How a malformed or contradictory Locked: line is read and graded.

## What I did meanwhile

A malformed Locked: line reads as locked with no owner and no date, counts against the cap and is refused. Locked: beside Proposed: is refused. Enforced by: pending counts as no test. laws.owners refuses a name written with @. An imported copy skips the cap and owners checks, as it skips requireProof.

## What it costs to change later

A constant or a branch each in the register reader and the knowledge check, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists what a lock must carry but not how a malformed lock line, or a lock beside Proposed:, is read.
- (author) Whether a pending law issue counts as the test a lock needs is not settled; I read a lock as needing a real test path.
