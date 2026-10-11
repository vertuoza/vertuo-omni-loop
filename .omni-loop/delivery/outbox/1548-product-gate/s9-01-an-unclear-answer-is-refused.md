---
id: s9-01-an-unclear-answer-is-refused
prd: 1548
slice: s9
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

When someone writes their own answer on the Questions tab and it says neither yes nor what to change, what happens to the question?

## The decision, in plain words

The answer is not saved and the person is asked to start with yes, say what to change, or add a line saying agreed or drifted, the same rule the terminal uses. Nothing is guessed.

## The intro, for fun

Some answers are a shrug typed out in full sentences.

## The punchline, for fun

We hand the shrug back and ask for a nod or a shake.

## The options, in plain words

A. Refuse it with a hint and keep the question open, as the terminal does (built).
B. Settle it as a change to what was built, since a wrong change only costs a rework question.
C. Ask the person to pick keep or change with two buttons beside their answer.

## What I had to decide

How the Questions tab reads an answer a person writes in their own words, when the kit's answer rules cannot tell whether it keeps or changes what was built.

## What I did meanwhile

The tab reads every answer with the kit's own rules: a letter is that option, A agrees and any other drifts; a written answer is judged as the terminal judges one, and one it cannot read is refused with a hint, the question staying open.

## What it costs to change later

A constant and one branch in the tab's service: settling such an answer as drifted, or adding two buttons for agreed and drifted, is a small change with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says an answer settles the item, but not what a written answer that reads neither way should do.
