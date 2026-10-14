# Settled outbox items — PRD 1890

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s6-01-init-claude-only-line-left-out -->

## s6-01-init-claude-only-line-left-out — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-init-claude-only-line-left-out
prd: 1890
slice: s6
rank: medium
bears-on: none
raised: 2026-10-14
wave: 3
---

## The question, in plain words

The spec asks the setup's closing steps to say that the status line and the band are only in Claude Code, but that code belongs to another part of this change. Should that line be added there too?

## The decision, in plain words

The help and the install guide now say it; the setup's own closing steps do not yet.

## The intro, for fun

One sentence about the status line wanted a home in the setup's goodbye.

## The punchline, for fun

It found rooms in the help and the guide instead, and waits at the door.

## The options, in plain words

A. A. Leave the closing steps as they are: the help and the install guide carry the line.
B. B. Add the line to omni init's closing steps, shown when agents lists an agent other than Claude.

## What I had to decide

Answer A to leave the closing steps as they are (the help and the install guide carry the line), or B to add the one line to the closing steps of omni init in a follow-up slice.

## What I did meanwhile

omni help statusline and the install guide say the status line and the HUD are Claude Code's alone; omni init's closing steps say nothing about it.

## What it costs to change later

B is one line in the init's closing steps and its test: under an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the line belongs in every init or only when agents lists another agent than Claude (author).

```

<!-- /omni-outbox-settled: s6-01-init-claude-only-line-left-out -->
