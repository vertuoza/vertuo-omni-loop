# Settled outbox items — PRD 301

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-next-steps-printed-as-formatted-text -->

## s1-01-next-steps-printed-as-formatted-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-next-steps-printed-as-formatted-text
prd: 301
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

At the end of a yolo, should the next steps be shown as fixed-width text like the folder and the stages, or as ordinary formatted text?

## The decision, in plain words

The folder and the stages are shown as fixed-width text, so the tree and the arrows line up. The next steps are shown as ordinary formatted text, with a bold heading and a numbered list, the way the brainstorm already shows them.

## The intro, for fun

The spec drew every block with a ruler, and the brainstorm already chose otherwise.

## The punchline, for fun

The yolo now ends the way the brainstorm does, bold heading and all.

## The options, in plain words

A. The folder and the stages as fixed-width text, the next steps as formatted text, as the brainstorm does: the option built.
B. All three as fixed-width text, exactly as the spec draws them, so the heading shows its stars.
C. All three as formatted text, leaving the tree and the arrows free to drift.

## What I had to decide

How the three **What is next?** blocks that end `/omni:yolo` step 7 are printed. The spec draws them as `text` fences, yet each holds `**What is next?**` and a numbered list, which only render as Markdown. PRD 292 met the same question for `/omni:brainstorm` step 10 and adopted `markdown` fences for its What is next? block (item s1-01 of PRD 292), and the spec asks for the brainstorm's hand-off, one legend for the whole loop.

## What I did meanwhile

The folder trees and the stages are `text` fences, printed in a code block so they line up. The green, red and held What is next? templates are `markdown` fences, printed as Markdown, each with its own line alone on the reply's last line. `kit/test/plugin.test.mjs` reads fenced blocks of either language whose first line is `**What is next?**`, so every option below passes it.

## What it costs to change later

A fence language on three blocks and one sentence in `kit/plugin/skills/yolo/SKILL.md`. No code, no command, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and its before/after page draw the What is next? blocks in a terminal, where fixed-width and formatted text look alike, and do not say which one the reply uses.

```

<!-- /omni-outbox-settled: s1-01-next-steps-printed-as-formatted-text -->
