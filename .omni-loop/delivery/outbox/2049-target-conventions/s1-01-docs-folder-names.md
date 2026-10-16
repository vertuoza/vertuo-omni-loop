---
id: s1-01-docs-folder-names
prd: 2049
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The kit refuses to spell this repository's documentation folder in its code, yet the new command must look for that same folder in every repository it reads. How should it name it?

## The decision, in plain words

The command keeps the two folder names, the docs folder and the decisions folder inside it, as one named setting in its own code, so the guard still holds everywhere else.

## The intro, for fun

A guard that forbids one word met a feature that needs exactly that word.

## The punchline, for fun

They settled it by giving the word a name tag.

## The options, in plain words

A. A. One constant in the conventions command, built into the labels it prints; the guard is unchanged.
B. B. Exempt the conventions command in the literal guard, as the config file is.
C. C. A config key for the docs folder, defaulting to docs; a target without omni config still reads the default.

## What I had to decide

Keep the folder names as one constant in the conventions command (A), exempt that file in the literal guard (B), or make the folders a config setting with this default (C).

## What I did meanwhile

The command looks for the docs folder and its adr folder by those fixed names in every repository it reads, as the spec says.

## What it costs to change later

Changing it later is one constant (A to C), or one line in the guard test (B).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the literal guard is meant to cover folder names that every repository shares, or only this repository's own paths (author).
