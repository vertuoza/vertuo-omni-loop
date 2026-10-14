---
id: s2-01-ask-lead-refusal-words
prd: 1915
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The error the ask service sends when a terminal's note before its question is malformed still said Claude, and the spec's list did not name it: should it say the agent too?

## The decision, in plain words

It now says the agent, like every other line of the ask page, so any coding agent reads the same words. Only the wording changed, nothing the terminal relies on.

## The intro, for fun

One last Claude was hiding in an error message nobody reads unless something breaks.

## The punchline, for fun

It now blames the agent, whichever agent that happens to be.

## The options, in plain words

A. A. The refusal says the agent, like the rest of /ask (built).
B. B. Keep Claude there: it is an API message, and the guard of s4 allowlists it.

## What I had to decide

Keep the refusal saying "the text the agent wrote before asking", or put Claude back.

## What I did meanwhile

The refusal reads "`lead`, when sent, must be the text the agent wrote before asking, up to 16 KB, or null."

## What it costs to change later

One string and one test line to change back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any script parses this refusal text: none in this repository does; outside it, unknown (author).
