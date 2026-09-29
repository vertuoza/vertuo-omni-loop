# Settled outbox items — PRD 579

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-announced-while-switches-off -->

## s2-01-announced-while-switches-off — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-announced-while-switches-off
prd: 579
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When both alert switches are off and new documents settle on a PRD, should they still count as already announced, so switching alerts on later stays quiet about them?

## The decision, in plain words

Yes: they count as announced even with the switches off, so turning alerts on later only alerts for documents that land after that.

## The intro, for fun

Alerts were off when the spec landed, so did it ever really ring?

## The punchline, for fun

We said it rang quietly, so nothing old bursts out when the switch goes on.

## The options, in plain words

A. Count them as announced with the switches off; switching on later brings no old news.
B. Count nothing while both switches are off; switching on later alerts once for every unseen settled PRD of the last 7 days.

## What I had to decide

Whether documents that settled while alerts were off stay silent after the switch goes on, or alert once then.

## What I did meanwhile

They stay silent: only documents that settle after the switch goes on raise an alert or a chime.

## What it costs to change later

One line in the announcing step: record only when a switch is on. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says what is kept and that alerts sit behind the switches, but not what happens to news that settled while both were off (author).

```

<!-- /omni-outbox-settled: s2-01-announced-while-switches-off -->
