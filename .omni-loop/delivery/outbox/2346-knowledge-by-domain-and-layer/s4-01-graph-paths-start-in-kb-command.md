---
id: s4-01-graph-paths-start-in-kb-command
prd: 2346
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

Making the graph command look files up the same way as the laws command meant a small edit in the shared knowledge command file, which belongs to an earlier slice. Is that edit fine?

## The decision, in plain words

The command that starts a graph from file names lived in the same file as the laws command. I swapped its old path matching for the shared lookup, and kept every other line of that file as it was.

## The intro, for fun

The graph asked for directions, and the laws command already had the map.

## The punchline, for fun

One borrowed lookup, and both commands now agree on where a file lives.

## The options, in plain words

A. A. Edit the graph command's start in the shared knowledge command file, nothing else in it (built).
B. B. Leave the graph command's old path matching and add a separate flag for the lookup later.

## What I had to decide

Edit the start of the graph command in the shared knowledge command file to call the lookup, and leave the rest of that file untouched.

## What I did meanwhile

The graph command starts from the rules, invariants and laws the lookup says apply to the files, and from the decision records when no rule applies.

## What it costs to change later

Moving the call into a helper elsewhere is a small edit, since the matching itself lives in a library file of this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan puts the shared knowledge command file in another slice's territory, yet the done-when asks the graph command to resolve files as the lookup does.
