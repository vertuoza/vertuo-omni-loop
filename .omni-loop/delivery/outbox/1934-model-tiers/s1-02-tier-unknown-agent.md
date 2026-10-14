---
id: s1-02-tier-unknown-agent
prd: 1934
slice: s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

When someone asks which model a tier runs on for a coding agent the kit does not know, should the answer be an error, or simply 'use the terminal's model'?

## The decision, in plain words

It is an error that names the unknown agent, the same way an unknown tier is refused. A misspelled agent name then shows up at once instead of quietly running every slice on the terminal's model.

## The intro, for fun

A stranger asked which model to use, and the kit asked for their name first.

## The punchline, for fun

Better a polite no at the door than a silent mix-up inside.

## The options, in plain words

A. Refuse an unknown agent, exit 2, naming it (built).
B. Print inherit for an unknown agent, exit 0, as for a known agent with no row.

## What I had to decide

What the tier command does when the agent it is given is none of the agents the kit knows; the spec only says what an unknown tier does.

## What I did meanwhile

An unknown agent exits 2 with a line naming it and the agents the kit knows; a known agent with no row in the config prints inherit, as the spec says.

## What it costs to change later

One branch in one command: turning the error into inherit is a two-line change and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the exit for an unknown tier but not for an unknown agent; the wave always passes its own agent, so the case only arises from a typo (author).
