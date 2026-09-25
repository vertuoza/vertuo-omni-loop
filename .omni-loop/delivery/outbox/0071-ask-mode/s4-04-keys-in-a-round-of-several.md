---
id: s4-04-keys-in-a-round-of-several
prd: 71
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

One round can hold up to four questions on the page at once, and the number keys pick an option. Which question should a key press answer?

## The decision, in plain words

The number keys answer the question the person is working in, or else the first question still without an answer, so a whole round can be answered with the keyboard alone. Enter sends once every question has an answer.

## The intro, for fun

Four questions, four number keys, and one very eager keyboard.

## The punchline, for fun

Each key press goes to the first question still waiting its turn.

## The options, in plain words

A. Keys answer the question in focus, else the first one without an answer, the option built.
B. Keys answer only the question in focus, and do nothing until the person picks one.
C. Show one question at a time, like the terminal does, and move on after each answer.

## What I had to decide

The spec: keys `1`–`4` pick an option and `Enter` sends. `AskUserQuestion` takes one to four questions per call and the page shows them all at once; the spec does not say which question a key acts on, nor what `Enter` does inside the Other field.

## What I did meanwhile

`activeQuestion` and `pickByKey` in `src/ask/answer-model.ts`: a key acts on the question that holds the focus, else the first without an answer (else the last); in a multi-select it toggles. While the Other field has the focus, digits are text, `Enter` sends when Send is on and Shift+Enter breaks the line. Keys held with Ctrl, Alt or Cmd are left to the browser, and the key hint hides on touch screens.

## What it costs to change later

One function and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people will expect Enter on a focused option to pick it, as in the terminal, rather than send the round once it is complete.
