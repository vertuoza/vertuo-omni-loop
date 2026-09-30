---
id: s1-01-typesafe-request-shape
prd: 812
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

What exactly does TypeSafe expect in a request to Jev, and what does it send back?

## The decision, in plain words

We wrote the request and the reply the way the spec describes Jev (a state, a typed question, an answer with a confidence), without TypeSafe's own reference to check the field names against.

## The intro, for fun

Talking to a new service is like texting someone new: you hope you got the name right.

## The punchline, for fun

If the fields are off, Jev simply stays silent and today's answers keep counting.

## The options, in plain words

A. Keep the shape as built, and adjust it once a person compares it with TypeSafe's reference.
B. Have a person paste TypeSafe's reference into the spec first, and rework the client to match it before the feature merges.

## What I had to decide

The field names of the call to TypeSafe's systemone endpoint: model, state, question (type, instructions, options or levels as key and description, or a Noul's statement), and the reply's model, answer, confidence and optional probabilities.

## What I did meanwhile

The shape lives in one file of Galaxy's server code and its test; a reply outside it is read as a failed call, so a wrong guess only means Jev never decides and today's answer counts.

## What it costs to change later

One file and its test to adjust once TypeSafe's reference is read; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- TypeSafe's API reference for the systemone endpoint was not available to check the field names against (author)
