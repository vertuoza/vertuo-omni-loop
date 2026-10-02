---
id: s3-01-close-without-a-keyboard
prd: 932
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

On a phone there is no Esc key. How should someone close the app picker without picking an app?

## The decision, in plain words

A tap on the dark space around the picker closes it, the way most pop-ups work. There is no separate close button, so the keys line and the three things you can move between stay as the spec drew them.

## The intro, for fun

Every arcade has a coin slot. Few of them come with a way out.

## The punchline, for fun

Tap the dark space and the arcade lets you walk away.

## The options, in plain words

A. A tap on the backdrop closes the picker, with no close button (built).
B. Add a visible close button in a corner, which Tab also reaches.
C. Both: a close button and a tap on the backdrop.

## What I had to decide

Whether closing the picker without a keyboard needs its own visible button, or whether a tap outside is enough.

## What I did meanwhile

A tap or click on the backdrop around the picker closes it, the same as Esc. Taps on the pedestals, the toggle or the space between them never close it.

## What it costs to change later

Adding a close button later is a small change to the picker and its styles, with one more stop when you move through it with Tab.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names Esc as the only way to close and says nothing about touch screens (author).
