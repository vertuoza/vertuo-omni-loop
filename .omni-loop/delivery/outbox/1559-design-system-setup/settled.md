# Settled outbox items — PRD 1559

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-config-command-shows-design-system-default -->

## s1-01-config-command-shows-design-system-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-config-command-shows-design-system-default
prd: 1559
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

To show the usual design file name when a repository names none, we changed the settings command, a place this slice was not given: is that the right place?

## The decision, in plain words

The settings command now shows the default design file path when none is set, while the stored settings stay exactly as before.

## The intro, for fun

The plan said the default lives where the setting is read, so we went to where it is read.

## The punchline, for fun

One line stepped outside the fence, and the fence still stands.

## The options, in plain words

A. A. The settings command fills in the default design file path when it prints (built).
B. B. The parsed settings carry the default themselves, and the law's test of the design section is updated to match.
C. C. The settings command prints nothing for an unset design file path, and only the skills apply the default.

## What I had to decide

Keep the settings command showing the default design file path, or move the default somewhere else.

## What I did meanwhile

Asking the settings for the design file path prints DESIGN.md when the repository names none; every other setting prints as before.

## What it costs to change later

Undoing it is a one-line change to the settings command and drops one function from the config module.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice's territory names the config module but not the settings command; no other place makes the command answer DESIGN.md without changing the parsed shape a law's test pins (author).

```

<!-- /omni-outbox-settled: s1-01-config-command-shows-design-system-default -->
