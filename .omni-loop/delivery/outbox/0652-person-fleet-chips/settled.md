# Settled outbox items — PRD 652

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-people-lookup-takes-printed-name -->

## s1-01-people-lookup-takes-printed-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-people-lookup-takes-printed-name
prd: 652
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a screen asks the people directory for someone, should the screen keep the name it already shows, or should the directory choose the name?

## The decision, in plain words

The screen keeps the name it already shows, and the directory only adds the face and the fleet. Names on every screen stay exactly as they are today.

## The intro, for fun

Every face needs a name tag, and someone has to write it.

## The punchline, for fun

We let each screen keep its own pen.

## The options, in plain words

A. A: the lookups take the name the screen prints, and add only the face and the fleet (built)
B. B: the lookups return the roster's name, and screens switch to it
C. C: both: the name argument is optional, falling back to the roster's name

## What I had to decide

Whether the directory lookups take the name the screen prints (built), or return the roster's name themselves.

## What I did meanwhile

Wave-2 slices call byId(userId, name) and byLogin(login, name?) from src/people/load.ts; the name defaults to the login for byLogin.

## What it costs to change later

Changing it later is a small edit in src/people/load.ts and at each call site in wave-2 slices; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names byId(userId) and byLogin(login) without a name argument; the extra argument keeps the spec's rule that names a screen prints stay as they are (author).

```

<!-- /omni-outbox-settled: s1-01-people-lookup-takes-printed-name -->
