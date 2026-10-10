---
id: s6-01-sweep-asks-the-model-first
prd: 1342
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When the sweep checks the old rules that have no test, who gives the answer when the company's judge is switched off?

## The decision, in plain words

A language model gives its own answer first, and the judge's answer replaces it when the judge is on. A rule the model cannot answer for is left as it is, and the switch that makes untested rules an error stays off until every rule has an answer.

## The intro, for fun

Every old rule gets a hearing, even when the judge is out to lunch.

## The punchline, for fun

Nobody is sentenced without an answer on the record.

## The options, in plain words

A. A. Ask the model first, the judge's answer counts when it gives one; an unanswered rule waits, and the switch stays off.
B. B. Treat every rule the judge does not answer as worth a law, opening an issue for each, with no model.
C. C. Leave every rule the judge does not answer untouched, with no model, so the sweep does nothing while the judge is off.

## What I had to decide

Whether the sweep needs the model key, and what happens to a rule nobody could judge.

## What I did meanwhile

The sweep asks the model the same worth-a-law question the harvest asks, then omni decide law-worth with that answer as --old. A rule the model cannot judge stays unenforced, is listed as not judged, and laws.requireProof is not set; a second run picks it up.

## What it costs to change later

One branch in the sweep command: dropping the model call or setting requireProof regardless is a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the sweep falls back to the classifier's answer but has no classifier for register entries, so a small model question stands in for it.
