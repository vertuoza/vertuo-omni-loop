---
id: s4-01-guard-found-strings
prd: 1915
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

The new check found two more places the app named Claude that the spec's list did not cover: the message the question service sends back when an agent's lead text is too long, and the example name offered when a person makes a terminal key. Should they speak of the agent too?

## The decision, in plain words

Both now speak of the agent: the message says the text the agent wrote, and the example key name reads cloud-agent, in the form and in the demo profile.

## The intro, for fun

The new check went looking for one name and found two more hiding in plain sight.

## The punchline, for fun

They now answer to the agent, like everyone else.

## The options, in plain words

A. A. Both speak of the agent: the agent wrote, cloud-agent (built).
B. B. Keep claude-cloud as the example key name, since many keys are made for Claude cloud sessions; change only the refusal.
C. C. Keep both as they were and add them to the check's list of names that stay.

## What I had to decide

Whether the refusal message and the key-name example say the agent, as the spec's after column does for the rest of the app.

## What I did meanwhile

The refusal reads "the text the agent wrote before asking", and the key-name field suggests cloud-agent.

## What it costs to change later

Two short strings and one test line; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's table lists neither string; the slice applied its rule for a string found in the same sense (author).
