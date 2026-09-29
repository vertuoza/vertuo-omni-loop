# Settled outbox items — PRD 580

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-who-runs-it-read-from-its-own-words -->

## s2-01-who-runs-it-read-from-its-own-words — adopted

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
id: s2-01-who-runs-it-read-from-its-own-words
prd: 580
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The spec says a skill run by other skills lists the skills whose words name it, but no skill's words name the dossier skills: only the dossier skills themselves say who runs them. Where should the list come from?

## The decision, in plain words

The page lists the skills a skill's own words say run it, plus any skill whose words name it, so the dossier-push page names brainstorm and plan as the acceptance criteria ask.

## The intro, for fun

Two little helper skills, and nobody admits to calling them.

## The punchline, for fun

So the helpers wrote down who calls them themselves.

## The options, in plain words

A. Read both: the skill's own words and the words of every other skill (built)
B. Read only the other skills' words, and add the dossier skills to the brainstorm and plan entries
C. Read only the skill's own words

## What I had to decide

Whether Who runs it reads a skill's own words, the other skills' words, or both.

## What I did meanwhile

Both are read; the dossier pages name brainstorm and plan.

## What it costs to change later

One line in the page model to change, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the spec meant the other direction and the brainstorm and plan entries should name the dossier skills instead (author).

```

<!-- /omni-outbox-settled: s2-01-who-runs-it-read-from-its-own-words -->
