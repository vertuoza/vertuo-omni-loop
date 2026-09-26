---
id: s3-01-classifier-model
prd: 144
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

Which model should sort each question into one of the six categories, and how long may it take before the question is left unsorted?

## The decision, in plain words

A small, cheap Claude model does the sorting, and gets fifteen seconds; a slower answer leaves the question unsorted, and people can sort it by hand.

## The intro, for fun

Somebody has to put every question in the right drawer, and it does not need to be the smartest in the room.

## The punchline, for fun

A quick glance and a label: fifteen seconds, then the drawer stays shut.

## The options, in plain words

A. A small Claude model with a 15-second limit, fixed in the code
B. The same, with the model named by an environment setting so it changes without a deploy
C. A larger model, for better sorting at a higher price per question

## What I had to decide

Which OpenRouter model the classifier calls, and its time limit.

## What I did meanwhile

The classifier calls anthropic/claude-haiku-4.5 through OpenRouter, at temperature 0, with a 15-second limit; both are constants in the galaxy's classifier.

## What it costs to change later

Changing either is one constant; no data moves, and rounds sorted so far keep their category.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names OpenRouter but no model, and no time limit (author)
- Whether that model id is enabled on the OpenRouter account behind OPENROUTER_API_KEY; a model it refuses leaves every round unsorted, silently (author)
