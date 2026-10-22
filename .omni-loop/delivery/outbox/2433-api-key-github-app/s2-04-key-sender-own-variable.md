---
id: s2-04-key-sender-own-variable
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When an API key sent a job, the pull request line must name the key, not a person. How does the key's name reach the job?

## The decision, in plain words

The key's name travels in its own variable next to the existing one that names a person, so a job never mixes the two. A key name that starts with an at sign has it removed, so the line cannot read as a person's handle.

## The intro, for fun

A key has a name, and the name must never pass for a person.

## The punchline, for fun

So it wears its own badge, apart from the people.

## The options, in plain words

A. A. A separate variable for the key's name, with any leading at sign removed.
B. B. The same variable as the person's handle, holding the key's name.

## What I had to decide

Pick A to keep the key's name in its own variable. Pick B to fold it into the person's variable, which would let a key pass for a person.

## What I did meanwhile

Option A is built: `OMNI_SENT_BY_KEY` carries the name, the sender line reads `Sent through the Omni API by API key <name> on runner <runner>`, and a job without a key starts with exactly today's environment.

## What it costs to change later

Folding into the person's variable is a few lines in `kit/lib/env/read.ts` and `kit/lib/runner/sender.ts`, but it risks breaking L-AIACT-1: a pull request from an agent would read like a person's.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says only that the sender line names the key; the variable's name and the at-sign rule are the author's choice.
