---
id: s2-01-headers-test-top-bar-end
prd: 438
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The check that looks at every app page's header expected the top bar to end with Game mode. Now that your avatar ends it, may this slice update that check even though the plan gave it to other slices?

## The decision, in plain words

Yes: the check now expects the theme switch and Game mode, then your avatar or the sign-in button, last. Only that one part of the check changed.

## The intro, for fun

The header inspector had a checklist that stopped at Game mode.

## The punchline, for fun

We added one line so it stops being surprised by your face.

## The options, in plain words

A. Update the app-page top bar assertion in the header test to allow the avatar or sign-in button last (built).
B. Leave the header test to s4 or a later slice and ship s2 with the header test red until then.

## What I had to decide

Whether s2 may update the one header check the new avatar broke, outside its planned files.

## What I did meanwhile

The header check expects the avatar or Sign in with GitHub after Game mode on every app page; the rest of the file is untouched.

## What it costs to change later

Reverting means restoring one assertion in the header test; no product code depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s4, which shares this test file in the same wave, expects to own this assertion too (author).
