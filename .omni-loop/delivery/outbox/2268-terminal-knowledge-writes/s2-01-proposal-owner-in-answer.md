---
id: s2-01-proposal-owner-in-answer
prd: 2268
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When a member who does not own Legal or Glossary proposes a change from the terminal, how does the command know whose approval it waits for?

## The decision, in plain words

The command reads an optional owner name from the page's answer and prints 'waits for @name'. When the answer carries none, it says 'waits for the section's owner' instead of guessing a name.

## The intro, for fun

A proposal is a letter; someone has to be named on the envelope.

## The punchline, for fun

Until the page names the owner, the letter goes to 'the owner'.

## The options, in plain words

A. Read an optional owner from the answer and fall back to the generic line (built).
B. Make the route always answer the owner and require it in the kit.

## What I had to decide

The spec's answer shape is {done, id, url} and its line says 'waits for @<owner>'. The kit reads an optional owner field of the answer, so the route can add it without a kit change.

## What I did meanwhile

A proposal prints the generic line, which is still true.

## What it costs to change later

One extra optional field on the route's answer, in slice s1, if the owner's name is wanted in the line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether slice s1's route answers an owner for a proposal (author)
