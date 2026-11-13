---
id: s3-04-probe-fail-raises-high-item
prd: 2746
slice: s3
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

When a provider's own check says its change will never be served as it is, should that be treated like a provider closed without merging, and ask a person?

## The decision, in plain words

Yes: a check that answers fail keeps the waiting pull request a draft and raises the same important question a closed provider does, naming both pull requests.

## The intro, for fun

The kitchen says the dish you are waiting for is off the menu.

## The punchline, for fun

The waiter asks you, rather than bringing something else.

## The options, in plain words

A. A. A probe's fail raises the same important question as a closed provider.
B. B. A probe's fail only keeps the pull request waiting, read again later like a wait.

## What I had to decide

Whether a provider check's fail asks a person, as a closed provider does, or only keeps the pull request waiting and asks again later.

## What I did meanwhile

A failing check raises one important question naming both pull requests, and the waiting pull request stays a draft.

## What it costs to change later

Turning it into a plain wait later is one sentence of the pull request skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec raises the question on a provider closed without merging; it names a probe's fail verdict without saying what follows it (author)
