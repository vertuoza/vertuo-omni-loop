---
id: s1-01-again-restarts-tries
prd: 2688
slice: s1
rank: medium
bears-on: none
raised: 2026-11-10
wave: 1
---

## The question, in plain words

When a check is asked again while it is running, does the new run start with all five tries, or only with the tries the old run left?

## The decision, in plain words

The new run starts fresh with all five tries, as a check asked again after it finished does, even when the old run had used its last try.

## The intro, for fun

A check gets a new push halfway through its own homework.

## The punchline, for fun

It starts the new homework with a full pencil case.

## The options, in plain words

A. Start the new run with all five tries, the option built.
B. Keep the old count, and end the check as a failure when the old run used its last try.

## What I had to decide

Whether a check that is asked again while it runs keeps counting its failed tries, or starts over for the newest state of the pull request.

## What I did meanwhile

It starts over: each newest state gets the full five tries, and the old run's tries stay in its history. The same holds when the old run was lost because its worker died.

## What it costs to change later

One line in each of two database functions, changed by a later migration that only replaces them; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the run is queued once more and due at once, and says nothing about its tries (author).
- Keeping the old count would leave a run that failed its 5th try with no try left, so it would have to end as a failure on a state nobody checked (author).
