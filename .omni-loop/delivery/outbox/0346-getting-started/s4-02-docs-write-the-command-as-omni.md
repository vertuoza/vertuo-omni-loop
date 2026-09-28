---
id: s4-02-docs-write-the-command-as-omni
prd: 346
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The kit's command is a file run with Node, so a newcomer cannot type it by its short name. How should the pages write it?

## The decision, in plain words

The pages write the short name, and the Install page gives a one-line shortcut that makes the short name work in the terminal, with the long form to type when the shortcut is not set.

## The intro, for fun

Every page says the short name, and the terminal had never heard of it.

## The punchline, for fun

One line of shortcut, and the terminal and the pages finally agree.

## The options, in plain words

A. Short name on every page, and a shortcut on the Install page.
B. The long form on every page, with no shortcut.
C. Have the kit install a real command by the short name, and drop the shortcut.

## What I had to decide

Whether the shortcut is the right answer for a newcomer, or the pages should spell out the long form everywhere.

## What I did meanwhile

Install explains the shortcut once; every other page uses the short name.

## What it costs to change later

Low: wording on two pages. Spelling out the long form everywhere is a find-and-replace, but the docs guard only checks the short form.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec writes the short name without saying how a person types it; the kit installs no command by that name on the laptop (author)
