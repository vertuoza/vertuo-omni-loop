---
id: s1-02-optional-setting-alone-is-half-set
prd: 1059
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When only the optional part of a feature's settings is filled in, such as the model's name without the key that pays for it, should that count as a mistake or as the feature being off?

## The decision, in plain words

It counts as a mistake: the feature is half set up, and the tool says which setting is missing. Before, the feature quietly stayed off.

## The intro, for fun

A model's name without its key is a car with no ignition.

## The punchline, for fun

Better to hear it now than to wonder why nothing was sorted.

## The options, in plain words

A. A. An optional member set alone makes the group half set: one error names the missing variables.
B. B. A group is off until one of its required members is set: an optional member alone is ignored, as before.

## What I had to decide

Whether a group whose only set variables are optional ones (OPENROUTER_MODEL without OPENROUTER_API_KEY) is half set, or off.
Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

envReader in kit/lib/env/group.ts reports it as half set, naming every variable of the group; the GitHub App and the arcade will inherit the rule in wave 2.

## What it costs to change later

Answering B is one condition in readGroup (count only required members when deciding whether a group is set) and its test: under an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says a group is null when none of its variables is set; it does not say how an optional member alone is read.
