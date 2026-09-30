---
id: s3-02-decided-by-line-place
prd: 812
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

Where on an outbox item does the note saying Jev made the call go?

## The decision, in plain words

The note goes as the last line of the part that says what had to be decided, written by the agent, because the tool that writes items takes no separate field for it.

## The intro, for fun

Every good decision deserves a signature, even a robot's.

## The punchline, for fun

Jev signs at the bottom of the page, like everyone else.

## The options, in plain words

A. Keep it as built: the agent ends the decision section with the note.
B. Add a dedicated field to the item tool that writes the note on its own line at the top of the item.

## What I had to decide

The spec wants `Decided by: Jev (hardToRevert 0.82) · agent said false` on the item. `omni item new` refuses unknown fields and kit/lib/policy/outbox-policy.mjs is outside this slice. The do-work skill tells the agent to end the `decide` field (## What I had to decide) with that line when Jev's answer counted.

## What I did meanwhile

The skill's Record it step says so; nothing in the kit parses the line.

## What it costs to change later

A skill wording change, or a new optional item field later: no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reader of the item would rather see the note at the top (author)
