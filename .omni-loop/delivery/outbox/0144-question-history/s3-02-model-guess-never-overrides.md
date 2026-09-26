---
id: s3-02-model-guess-never-overrides
prd: 144
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When the model's guess arrives after a person has already sorted the question, which one wins, and whose account records the guess?

## The decision, in plain words

A person always wins: the model's guess is kept only while nobody has sorted the question. The guess is recorded in the name of the person who asked, since the app holds no key of its own.

## The intro, for fun

The robot and a human both reach for the same label maker.

## The punchline, for fun

The human keeps it, and the robot does not even get a turn.

## The options, in plain words

A. The guess is kept only while nobody sorted the question, recorded as the asker
B. The guess always replaces whatever is there, as the last word
C. The app records the guess with a key of its own, so nobody else can write it

## What I had to decide

How the model's category is written without a database key of the app's own, and whether it may replace a person's choice.

## What I did meanwhile

Nobody can write the category columns directly. One database function lets any member set or clear a category; a second records the model's guess, callable only by the session's owner, and only while nobody has set one. The galaxy calls it with the asker's own sign-in, after the response.

## What it costs to change later

Replacing the second function, or granting the app a key of its own, is one small migration; stored categories stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The session's owner could call the second function directly and label a round as sorted by the model; the category is still one of the six, and any member can change it (author)
- The spec says nothing about a guess arriving after a person sorted the round (author)
