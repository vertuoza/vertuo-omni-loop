---
id: s1-01-outbox-entry-text
prd: 1217
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

An item in the list of decisions waiting for a person has no title of its own. What words should stand for it in the roadmap's human work list?

## The decision, in plain words

Its question in plain words, as the person answering reads it on the pull request. When an item has none, its plain decision is shown, then what it had to decide.

## The intro, for fun

The spec asked for each item's title, and the items never had one.

## The punchline, for fun

So the plain question stepped in, since it was written for people anyway.

## The options, in plain words

A. A. The plain question, then the plain decision, then what it had to decide (the option built).
B. B. The plain decision first, saying what was done rather than what is asked.
C. C. Add a title field to outbox items, which the spec puts out of scope.

## What I had to decide

Which part of an outbox item becomes the text of its human work entry, since items carry no title.

## What I did meanwhile

outboxWork in kit/lib/roadmap/human-work.ts uses the item's 'The question, in plain words', falling back to 'The decision, in plain words', then 'What I had to decide', then the item id, flattened onto one line. The rule-kind words also match their plural (secrets, tokens, permissions, deploys).

## What it costs to change later

One function of the kit: the next push refreshes every open entry's text, and nothing stored needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'the item's title', and an outbox item has no title section or field; the plain question is the closest reading
- (author) The spec says the rule words match whole; whether a plural counts as the whole word was not said
