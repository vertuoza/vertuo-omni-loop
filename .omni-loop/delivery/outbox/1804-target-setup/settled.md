# Settled outbox items — PRD 1804

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-setup-not-listed-unfilled -->

## s1-01-setup-not-listed-unfilled — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-setup-not-listed-unfilled
prd: 1804
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

When the install step cannot guess how to prepare a fresh copy of the project, should its closing list still name that step as one left to fill?

## The decision, in plain words

It is asked on a terminal and takes a flag like the others, but an empty answer means no preparation is needed, so the closing list never names it as unfilled.

## The intro, for fun

Some projects need nothing installed before their tests run.

## The punchline, for fun

Nagging them about it would be like reminding a bicycle to refuel.

## The options, in plain words

A. A. Never list the setup as unfilled: null means none is needed (built).
B. B. List it like the other commands, with its --setup flag, whenever it is null.

## What I had to decide

Whether a setup left empty is listed among the commands still to fill at the end of omni init.

## What I did meanwhile

omni init lists only test, preflight and preflightFull as unfilled; a null setup is read as none needed.

## What it costs to change later

One filter condition in kit/bin/commands/init.ts and the closing-steps tests that pin the list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says init asks for the setup when it cannot detect it, but not whether the closing list names it (author).

```

<!-- /omni-outbox-settled: s1-01-setup-not-listed-unfilled -->

<!-- omni-outbox-settled: s1-02-init-help-usage-setup-flag -->

## s1-02-init-help-usage-setup-flag — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-init-help-usage-setup-flag
prd: 1804
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The help page for the install command does not yet mention its new option for the preparation step. Who adds it?

## The decision, in plain words

That help text belongs to the other slice of this feature, so this slice left it as it was; the option works and the command's own usage line names it.

## The intro, for fun

A new switch arrived on the install command this morning.

## The punchline, for fun

Its help page has not heard the news yet.

## The options, in plain words

A. A. Leave the help entry to the feature branch after the wave merges (built: nothing changed here).
B. B. Add it in s2, whose territory holds the help entries.

## What I had to decide

Whether the --setup flag is added to omni help init's usage in kit/lib/help/entries.ts, by s2 or on the feature branch after the wave.

## What I did meanwhile

omni init accepts --setup and its usage error names it; omni help init still shows the usage without it.

## What it costs to change later

One line in kit/lib/help/entries.ts, plus its help test if one pins the usage.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the help entries to s2 for the skills only; init's usage line there was not assigned to either slice (author).

```

<!-- /omni-outbox-settled: s1-02-init-help-usage-setup-flag -->
