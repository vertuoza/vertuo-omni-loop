---
id: s2-01-loop-silent-before-first-wake
prd: 1139
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When a loop has just started and has not yet said when it will wake next, how long do we wait before calling it silent?

## The decision, in plain words

We call it silent one hour after the last thing it told us, since a first round can build a whole wave before it reports back.

## The intro, for fun

A loop that never says goodnight is hard to call asleep.

## The punchline, for fun

So we give it one hour of benefit of the doubt.

## The options, in plain words

A. Silent one hour after its last push, the option built.
B. Silent five minutes after the start, like any missed wake, so the kit must send a wake with the start.
C. Never silent before the first wake: a person stops it by hand.

## What I had to decide

How long a loop with no next wake yet reads live before the Loop page shows it silent and a take-over is allowed.

## What I did meanwhile

One hour after its last push, the same rule in the database and on the page: one interval and one constant to change.

## What it costs to change later

One interval in the migration and one constant in the page's state rule.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec only defines silent as five minutes past the next wake, and says nothing of a loop before its first wake
- (author) a tick that runs longer than five minutes past its planned wake also reads silent while it works, as the spec's rule says; the kit could push a tick at the start of each action to avoid it
