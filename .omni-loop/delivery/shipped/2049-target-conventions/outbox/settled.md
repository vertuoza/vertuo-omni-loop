# Settled outbox items — PRD 2049

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-docs-folder-names -->

## s1-01-docs-folder-names — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-docs-folder-names
prd: 2049
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The kit refuses to spell this repository's documentation folder in its code, yet the new command must look for that same folder in every repository it reads. How should it name it?

## The decision, in plain words

The command keeps the two folder names, the docs folder and the decisions folder inside it, as one named setting in its own code, so the guard still holds everywhere else.

## The intro, for fun

A guard that forbids one word met a feature that needs exactly that word.

## The punchline, for fun

They settled it by giving the word a name tag.

## The options, in plain words

A. A. One constant in the conventions command, built into the labels it prints; the guard is unchanged.
B. B. Exempt the conventions command in the literal guard, as the config file is.
C. C. A config key for the docs folder, defaulting to docs; a target without omni config still reads the default.

## What I had to decide

Keep the folder names as one constant in the conventions command (A), exempt that file in the literal guard (B), or make the folders a config setting with this default (C).

## What I did meanwhile

The command looks for the docs folder and its adr folder by those fixed names in every repository it reads, as the spec says.

## What it costs to change later

Changing it later is one constant (A to C), or one line in the guard test (B).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the literal guard is meant to cover folder names that every repository shares, or only this repository's own paths (author).

```

<!-- /omni-outbox-settled: s1-01-docs-folder-names -->
