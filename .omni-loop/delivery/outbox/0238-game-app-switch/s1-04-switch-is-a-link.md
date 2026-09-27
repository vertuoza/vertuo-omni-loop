---
id: s1-04-switch-is-a-link
prd: 238
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The box that asks whether to switch to game mode has two answers, Stay and Switch, which the spec calls buttons. Should Switch be a real button, or a link drawn as a button?

## The decision, in plain words

Switch is a link drawn as a button, because it opens another page, and a screen reader announces it as a link. Stay is a real button, because it only closes the box.

## The intro, for fun

Switch wanted to be a button, but it kept leaving for another page.

## The punchline, for fun

So it wears a button's clothes, and only a screen reader knows it is a link.

## The options, in plain words

A. A link drawn as a button, the option built.
B. A real button that opens the game when pressed.

## What I had to decide

Whether Switch in the Game mode dialog is a button or a link.

## What I did meanwhile

In src/switch/GameModeButton.tsx, Switch is an anchor to /#menu styled as the page's primary button (ask-button), and has the focus as the dialog opens; Stay is a button that closes the dialog.

## What it costs to change later

One element in the dialog, and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec calls Stay and Switch "two buttons", and its test seam says Switch "leads to /#menu"; it does not say which element Switch is.
