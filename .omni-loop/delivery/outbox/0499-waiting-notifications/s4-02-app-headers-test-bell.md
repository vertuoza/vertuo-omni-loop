---
id: s4-02-app-headers-test-bell
prd: 499
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

May this slice change a test of every app page's top bar that lies outside its own ground, now that the top bar holds a bell?

## The decision, in plain words

Yes: the shared test of every app page's top bar now expects the bell after Game mode when someone is signed in, and leaves its closed panel out as it already does for the account menu. Nothing else in it changed.

## The intro, for fun

The top bar grew a bell, and an old test counted one button too many.

## The punchline, for fun

It now knows the bell is meant to be there.

## The options, in plain words

A. A: change the shared test to expect the bell
B. B: leave the shared test alone and hide the bell from it some other way
C. C: move the check of the bell's place out of the shared test into the bell's own tests only

## What I had to decide

Whether to widen this slice's ground by one test file that pins every app page's top bar.

## What I did meanwhile

Changed that one test: it drops the bell's closed panel before reading the bar's controls, and expects the bell (with or without a count) after Game mode on a signed-in page.

## What it costs to change later

Two lines of a test; undoing it is reverting them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this slice did not list the shared top-bar test; whether it was left out on purpose is unknown (author)
