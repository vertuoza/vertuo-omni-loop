---
id: s1-02-claude-check-own-secret
prd: 2537
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

Before a job starts on a Claude account that carries its own sign-in key, how does the runner know the key still works?

## The decision, in plain words

It only checks that Claude is installed and that the key is not empty: a key that no longer works shows up as a failed job, not as an account marked unusable beforehand.

## The intro, for fun

A key on the hook looks the same whether it opens the door or not.

## The punchline, for fun

We only find out by turning it, so the runner turns it on the first job.

## The options, in plain words

A. Check the key is there and not blank, the option built.
B. Prove the key with one short call to Claude when the runner starts, and mark the account not signed in when it fails.

## What I had to decide

Whether a direct Claude account with its own key is checked only for an installed Claude and a key that is not blank, or by a call that proves the key, which costs a request each time the runner starts.

## What I did meanwhile

The check runs claude --version for every account; an account with no key of its own also runs claude auth status, as the runner does today; an account with a key passes unless the key is blank, which reads not signed in.

## What it costs to change later

One branch in the check of the claude adapter.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether claude auth status reports the key a run is given in its variables rather than the machine's own sign-in; it was not tried, so it is not relied on
