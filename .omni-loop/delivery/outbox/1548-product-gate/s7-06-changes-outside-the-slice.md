---
id: s7-06-changes-outside-the-slice
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

This slice changed a few places outside the area it was given. Are those changes all right to keep?

## The decision, in plain words

Yes, kept, each as small as it could be: the terminal commands that answer and record questions learned to name a product PRD and to sign in, the terminal's connection to the Omni page learned the three new calls, the help names the new forms, the reader of questions accepts a product PRD's name, and the tests got a stand-in for the new routes.

## The intro, for fun

The slice was told to stay in its garden, and it mostly did.

## The punchline, for fun

It only borrowed a few tools from the shed next door.

## The options, in plain words

A. Keep the changes, the option built.
B. Move the command changes into a slice of their own.

## What I had to decide

Whether the commands, the connection to the Omni page, the help, the question reader and a test helper may change for this slice.

## What I did meanwhile

Each one changed only as far as a product PRD needs; every command and question of a repository's PRD reads and writes exactly as before, and its tests pass unchanged.

## What it costs to change later

Each change undoes on its own, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan should have listed the commands in this slice's area.
