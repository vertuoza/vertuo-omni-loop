# Settled outbox items — PRD 1646

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-inputs-in-typescript -->

## s1-01-inputs-in-typescript — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-inputs-in-typescript
prd: 1646
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The plan asked for the build rules to be written in plain JavaScript so any server could run them. This repository refuses plain JavaScript files, so which should give way?

## The decision, in plain words

The rules are written in TypeScript, which the build servers already run for the existing skip step. If a build server ever cannot run it, the step builds anyway, so nothing is skipped by mistake.

## The intro, for fun

The plan said JavaScript; the house rules said no JavaScript, thank you.

## The punchline, for fun

The house won, as houses tend to do.

## The options, in plain words

A. TypeScript, run by Node's own type stripping (what was built)
B. Plain JavaScript, with an exception added to the TypeScript guard

## What I had to decide

Keep the rules in TypeScript, or carve an exception into the repository's no-JavaScript rule.

## What I did meanwhile

The rules run as TypeScript on Vercel, the same way the existing skip step already runs the kit's TypeScript.

## What it costs to change later

Switching later is a file rename and a guard exception: an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which Node version Vercel's build image runs was not read from the dashboard; the repository requires 22.18 or later, which strips types by default (author)

```

<!-- /omni-outbox-settled: s1-01-inputs-in-typescript -->
