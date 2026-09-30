---
id: s2-02-a-silent-round-has-no-objection
prd: 822
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When every persona is happy with a stage, nobody objects. How should the voice record say that a round had no objection at all?

## The decision, in plain words

A round where nobody objected keeps an empty objection and may leave its fit line empty too. The settled value none is kept for an objection that was raised but never answered.

## The intro, for fun

Sometimes the whole panel nods along and nobody grumbles.

## The punchline, for fun

The record now knows the difference between silence and a shrug.

## The options, in plain words

A. Objection null when nobody objected; settled none for an objection left unanswered (built).
B. Always an objection; settled none also means nobody objected, with empty text.
C. Leave the objection out of the round entirely when nobody objected.

## What I had to decide

Whether a round with no objection is an empty objection, or an objection whose settlement is none.

## What I did meanwhile

voice.json accepts objection null and fit null; settled none means an objection raised with no answer. The skills in s4 and the tab in s3 read it this way.

## What it costs to change later

A rule in the voice schema and its readers; changing it is a constant, since no voice.json exists yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists none among the settlements without saying whether it also means no objection (author).
