# Settled outbox items — PRD 2578

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s4-01-flow-show-prints-modes-and-inputs -->

## s4-01-flow-show-prints-modes-and-inputs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-02
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-flow-show-prints-modes-and-inputs
prd: 2578
slice: s4
rank: medium
bears-on: none
raised: 2026-11-02
wave: 2
---

## The question, in plain words

To show a hook point with the modes it allows and what it hands a hook, as the spec asks, the command that prints a point had to change, and that command sits outside this slice's ground. Should every point print those two lines?

## The decision, in plain words

Every point now prints two more lines, the modes it allows and what it hands a hook, right under its name. The machine-readable output is unchanged.

## The intro, for fun

The spec wanted the new point to introduce itself properly, modes and all.

## The punchline, for fun

So every point got the same name tag, not just the newcomer.

## The options, in plain words

A. A. Every point prints its modes and its inputs in the text output (built).
B. B. The text output stays as it was; the modes and inputs are read from the JSON output or the catalog only.

## What I had to decide

Keep A unless a script reads the text output of omni flow show line by line: then pick B.

## What I did meanwhile

kit/bin/commands/flow.ts prints `modes` and `inputs` lines after `point` for every point; its test and the text snapshot in kit/bin/__snapshots__/flow.test.ts.snap follow. The JSON output is unchanged.

## What it costs to change later

A constant: two lines in pointText, its test and one snapshot. Removing them later is the same size.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any repository parses the text output of omni flow show (author)

```

<!-- /omni-outbox-settled: s4-01-flow-show-prints-modes-and-inputs -->
