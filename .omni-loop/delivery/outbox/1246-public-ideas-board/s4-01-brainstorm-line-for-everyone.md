---
id: s4-01-brainstorm-line-for-everyone
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

Should the line that turns an idea into a design session show on every card for every visitor, or only for members of the team?

## The decision, in plain words

Every visitor sees it with a copy button, as the acceptance criteria say every card shows it. It only repeats the idea's title and pitch, which the board already shows.

## The intro, for fun

A recipe card pinned on the shop window.

## The punchline, for fun

Anyone can read it; only the kitchen can cook it.

## The options, in plain words

A. Show the line on every card, to every visitor, as built.
B. Show it only to members of the workspace.
C. Show it to anyone signed in, members or voters.

## What I had to decide

Whether the Brainstorm this line shows to everyone or only to members: the spec's Members paragraph places it there, while its acceptance criteria say every card shows it.

## What I did meanwhile

BrainstormLine renders on every card in Board.tsx, member or not; Board.test.ts asserts both views.

## What it costs to change later

One condition in apps/galaxy/src/ideas/Board.tsx (wrap BrainstormLine in member ?) and one test line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the line under Members, yet its acceptance criterion and the plan's done-when say every card shows it.
