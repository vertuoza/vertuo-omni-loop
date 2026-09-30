---
id: s1-01-no-page-reads-as-no-sign-in
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When a repository has no Omni page set at all, or its sign-in has expired for good, what should the business read say to an agent?

## The decision, in plain words

Both count as having no sign-in: the agent reads one line saying so and carries on, exactly as when nobody ever signed in.

## The intro, for fun

An agent knocked on a door that was never built.

## The punchline, for fun

It was told nobody is home, and went back to work.

## The options, in plain words

A. Both are no-sign-in, the option built.
B. ask.url unset exits 2 as a configuration error, and a 401 reads as refused.

## What I had to decide

Which of the five read states covers ask.url unset in the config, and a 401 the refresh cannot fix.

## What I did meanwhile

Both answer state no-sign-in with exit 0; a 403, a 404 or another refusal answers refused. ask.url unset is not a configuration error (exit 2), so a skill line calling it never stops.

## What it costs to change later

Two branches in kit/bin/commands/business.mjs and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec lists the states but names neither case (author)
