---
id: s4-01-context-closed-on-phones
prd: 251
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

On a phone, should the plan's context above the questions start open or closed?

## The decision, in plain words

It starts closed on a narrow screen, so the first question is visible right away; one tap opens the before and after page, the spec or the brainstorm. On a wide screen it always sits open beside the questions.

## The intro, for fun

A phone screen has room for one thing at a time, so something had to wait.

## The punchline, for fun

The questions go first; the homework is one tap away.

## The options, in plain words

A. A. Start closed on a narrow screen, open beside the questions on a wide one.
B. B. Start open everywhere, so the context always shows first.
C. C. Remember what the person chose last time on this device.

## What I had to decide

The spec says that on a tall screen the context rail becomes a Context disclosure above the questions, but not whether it starts open or closed.

## What I did meanwhile

The disclosure is rendered open by the server (what a wide screen and a page without scripts show) and closes itself in the browser when the screen is narrower than 960 pixels.

## What it costs to change later

One default in one small component: flipping it is a one-line change, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people answering on a phone mostly want the before and after page in front of them first.
