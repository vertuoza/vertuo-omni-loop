---
id: s4-02-limit-words
prd: 1628
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

What does Make a token say when you already hold 20 live tokens?

## The decision, in plain words

The form is greyed out and says: You hold 20 tokens already: revoke one to make another. Those are the database's own words, so the page and a refused sign-in say the same thing.

## The intro, for fun

Twenty tokens in the pocket, and the pocket is full.

## The punchline, for fun

Empty one before you stuff in another.

## The options, in plain words

A. A. The database's own sentence, the option built.
B. B. A shorter line, such as Limit of 20 reached.
C. C. No line: only the disabled button.

## What I had to decide

The limit-reached words were an open question of the profile draft; the built screen uses kit_token_make()'s refusal text, 13 words at rest, past the word pass's 7.

## What I did meanwhile

TERMINAL_LINE.limit in apps/galaxy/src/profile/terminal-tokens.ts; the draft's open question now records the choice.

## What it costs to change later

A constant: one string.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the word pass's 7-word rule is broken on purpose while the limit holds (author)
