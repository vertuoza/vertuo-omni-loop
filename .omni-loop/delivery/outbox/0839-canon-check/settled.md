# Settled outbox items — PRD 839

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-app-read-workspace-choice -->

## s1-01-app-read-workspace-choice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-app-read-workspace-choice
prd: 839
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When two workspaces both track the same repository, whose business should the canon check read?

## The decision, in plain words

It reads the business of the workspace whose GitHub organisation owns the repository, and otherwise the one that started tracking it first. The read also says when the claims or personas last changed, so the check can skip the model when nothing moved.

## The intro, for fun

Two workspaces, one repository, and only one business gets to judge the spec.

## The punchline, for fun

The owner of the house sets the rules at the table.

## The options, in plain words

A. The workspace of the organisation that owns the repository, then the oldest tracker.
B. Only the owning organisation's workspace; any other tracker reads as no business.
C. Read every tracking workspace and merge their claims.

## What I had to decide

Whether the owning organisation's workspace is the right one to judge a phase-0 spec when a repository is tracked twice.

## What I did meanwhile

The read picks the owning organisation's workspace, then the oldest tracker; it also carries the latest change time for the check's cache.

## What it costs to change later

Changing the pick is one line in the read's ordering, in a follow-up migration; no data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only 'by repository'; nothing in it settles a repository tracked by two workspaces (author).

```

<!-- /omni-outbox-settled: s1-01-app-read-workspace-choice -->
