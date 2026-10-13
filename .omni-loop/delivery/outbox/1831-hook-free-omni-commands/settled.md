# Settled outbox items — PRD 1831

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-ask-switch-reaches-hooks -->

## s2-01-ask-switch-reaches-hooks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-ask-switch-reaches-hooks
prd: 1831
slice: s2
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

Should the new switch that turns ask mode on or off from the environment also apply to Claude's own question hooks and to the status check, or only to the new ask commands?

## The decision, in plain words

The switch applies everywhere ask mode is read: the new ask commands, Claude's question hooks and the status check, so a person sees one answer to whether ask mode is on.

## The intro, for fun

One switch, three doors: does it open all of them?

## The punchline, for fun

We wired it to every door, so nobody gets locked in the hallway.

## The options, in plain words

A. A. The switch applies to the ask commands, Claude's hooks and the status check alike (built)
B. B. The switch applies to the new ask commands only; Claude's hooks and the status check read the local file alone

## What I had to decide

Keep the switch everywhere (A), or limit it to the new ask commands (B).

## What I did meanwhile

With the switch set to on, a Claude session's questions also go to the page even without running omni ask on; set to off, they stay in the terminal whatever was switched on before.

## What it costs to change later

Option B is a one-line change in the ask command: the hooks and status would read the local file alone again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says OMNI_ASK switches the mode but does not say whether that reaches the Claude hooks (author)

```

<!-- /omni-outbox-settled: s2-01-ask-switch-reaches-hooks -->
