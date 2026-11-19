---
id: s3-03-cancelled-fix-set-aside
prd: 3088
slice: s3
rank: medium
bears-on: P-PRODUCT-114
raised: 2026-11-19
wave: 2
---

## The question, in plain words

The spec says a bug fix that ends with nothing the App can read spends one of its three tries and goes back in line. A bug fix a person cancelled ends that way too: should the team try it again?

## The decision, in plain words

A cancelled bug fix sets its bug aside for a person, spending no try, and the team never takes it again on its own. A person stopped it on purpose, and a mission never retries stopped work by itself.

## The intro, for fun

Someone pulled the plug on a bug fix on purpose.

## The punchline, for fun

So the team leaves the plug out until a person puts it back.

## The options, in plain words

A. A. A cancelled bug fix sets its bug aside for a person, no try spent (built).
B. B. A cancelled bug fix spends a try and its bug goes back in line, as a failure does.

## What I had to decide

Set a cancelled bug fix's bug aside for a person (A), or count it as a failed try and put the bug back in line (B).

## What I did meanwhile

A cancelled bug fix sets its bug aside, and the room says a person decides what comes next.

## What it costs to change later

One line of the team's reading of how a bug fix ended; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's rule for an ending the App cannot read was written for a failure, not for a person's cancel.
- (author) A mission of PRDs never sends a cancelled step again either: this follows it.
