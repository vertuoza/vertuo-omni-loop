---
id: s4-01-agreement-counts-only-answered-calls
prd: 812
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When the Jev page says how often Jev agreed with the old way of deciding, which calls should that rate be measured on?

## The decision, in plain words

Every call counts in the number of calls, but the agreement rate only looks at the calls where Jev and the old way both gave an answer. A call where Jev failed, had no key or answered outside the options neither agrees nor disagrees.

## The intro, for fun

Jev cannot agree with anyone while it is not answering the phone.

## The punchline, for fun

So its silent calls sit out the vote and only the calls it actually answered get counted.

## The options, in plain words

A. Rate over the calls both sides answered; failures only raise the call count (built).
B. Rate over every call, a failure counting as a disagreement.
C. Option A, plus a separate count of failed calls shown beside the rate.

## What I had to decide

Whether the agreement rate should be measured only on answered calls, or on every call with failures counted as disagreements.

## What I did meanwhile

The page shows the number of calls over 30 days and, separately, agreed out of compared, where compared is only the calls both sides answered. Answers under the confidence floor are compared too.

## What it costs to change later

Changing it is a one-line filter in the record module and its tests; nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only 'how often Jev agreed with today's path' and does not say what a failed call counts as (author).
