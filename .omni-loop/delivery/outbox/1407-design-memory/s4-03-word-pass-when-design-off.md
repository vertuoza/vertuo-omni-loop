---
id: s4-03-word-pass-when-design-off
prd: 1407
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

Should the word check on a mockup run in a repository that has not switched design craft on?

## The decision, in plain words

No. While design craft is off, the word check prints that design is off and reads nothing, the same way the screen list does.

## The intro, for fun

A spell checker that runs when nobody asked is just a nag.

## The punchline, for fun

Off means off, for every design command alike.

## The options, in plain words

A. A. Print that design is off and read nothing, as the screen list does
B. B. Read the mockups anyway, since the check never blocks

## What I had to decide

Whether the word check stays silent while design craft is off, or reads mockups anyway because it never blocks anything.

## What I did meanwhile

With design craft off, the word check prints one line saying so and exits without reading the pages.

## What it costs to change later

Letting it run while off later is a one-line change and its test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say how the word check behaves with design craft off; this follows the screen list built in the previous wave (author)
