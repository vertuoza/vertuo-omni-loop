---
id: s4-01-bell-age-past-a-day
prd: 499
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The design says how long a question has waited in minutes or hours. It does not say what the bell shows for a question waiting more than a day, or less than a minute.

## The decision, in plain words

Under a minute the bell says just now, and past a day it counts whole days, like 3 d, so a line never grows into a long number of hours.

## The intro, for fun

A question left overnight still deserves a tidy label.

## The punchline, for fun

Nobody wants to read 49 h and do the maths.

## The options, in plain words

A. A: 'just now', 'N min', 'N h', then 'N d' past a day
B. B: hours only, however long ('49 h')
C. C: the date and time it was asked, past a day

## What I had to decide

How the bell's panel words a wait shorter than a minute or longer than a day.

## What I did meanwhile

Built: under a minute reads 'just now' (as the ask tabs already say), under an hour 'N min', under a day 'N h', beyond that 'N d'.

## What it costs to change later

One small function and its test; changing the wording is a constant, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No one was asked how long questions usually wait; a wait past a day is a guess at what a person would find readable (author)
