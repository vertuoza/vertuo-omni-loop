---
id: s8-02-wave-asks-nothing
prd: 7
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Should the wave stop to ask a person about a serious decision a slice made, while that person might still be at the keyboard?

## The decision, in plain words

The wave never asks. It records every decision, accepts the minor ones and lists the serious ones for a person to answer on the pull request.

## The options, in plain words

A. Never ask; record and report (built).
B. Take an optional policy input, and ask about high and human-action items when it says so.
C. Ask when run directly by a person, never under /omni:yolo.

## What I had to decide

Upstream vertuo-parallel-wave carried a consultation policy: under vertuo-deliver it asked about high and human-action items in the prompt and settled the answers on the spot. PRD 7 ships only /omni:yolo, which asks nothing; /omni:deliver is out of scope (spec §4).

## What I did meanwhile

The consultation policy is dropped. High and human-action items stay open and are listed in the wave's report; the gate on the feature PR is where they are answered.

## What it costs to change later

Low: a later /omni:deliver can ask after the wave returns, from the report's items, without changing this skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person running /omni:wave directly would want to be asked is not settled by the spec. (author)
