# Settled outbox items — PRD 1679

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-kb-show-shares-the-measure-text -->

## s1-01-kb-show-shares-the-measure-text — adopted

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
id: s1-01-kb-show-shares-the-measure-text
prd: 1679
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

To count what an agent reads, the size check needs the exact page the playbook command prints. Should both share one piece of code, even though that touches the playbook command, which this slice was not meant to change?

## The decision, in plain words

Both now share one piece of code that writes a playbook page, so the size counted is always the size an agent reads. The playbook command prints exactly what it printed before.

## The intro, for fun

Two rulers measuring the same page will one day disagree.

## The punchline, for fun

So now there is one ruler, and it lives with the budgets.

## The options, in plain words

A. A. One shared function in the budgets module, used by kb show and the measure (built).
B. B. Move the shared function into the playbook module, where the form resolver lives.
C. C. Keep two copies, held equal by a test, and silence the duplication gate.

## What I had to decide

Whether kit/bin/commands/kb.ts may take its form text from formShowText in kit/lib/budgets/measure.ts, a file outside s1's territory, rather than keep its own copy of the same ten lines.

## What I did meanwhile

Moved the form-to-text code out of kb.ts into kit/lib/budgets/measure.ts as formShowText, and made kb.ts import it; kb show's output is unchanged (kit/bin/kb.test.ts green). Keeping a copy was refused by the repository's duplication gate.

## What it costs to change later

A constant: moving formShowText to kit/lib/playbook/ later is one file move and two import lines; no stored shape or public command changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether kit/lib/playbook/ is the better home for formShowText: it was outside the territory too, so the function stayed beside the measure.

```

<!-- /omni-outbox-settled: s1-01-kb-show-shares-the-measure-text -->
