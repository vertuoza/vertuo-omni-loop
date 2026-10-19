# Settled outbox items — PRD 2188

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-confirm-names-each-planning-product -->

## s1-01-confirm-names-each-planning-product — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-confirm-names-each-planning-product
prd: 2188
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

When several products plan in the same repository, how should the question asked before removing it name them?

## The decision, in plain words

The question adds one line per product, each saying that product will have no plan repository. The spec only showed the case of one product.

## The intro, for fun

Two products, one plan repository, and a remove button looking at both of them.

## The punchline, for fun

Each product gets its own line of bad news, so nobody has to share.

## The options, in plain words

A. One line per product, each naming the product that will have no plan repository.
B. One line for all of them, listing every product before saying they will have no plan repository.

## What I had to decide

Keep one line per product, or merge them into a single line that lists every product before saying they will have no plan repository.

## What I did meanwhile

Settings › Repositories asks with one line per product that plans in the repository.

## What it costs to change later

Changing it later is one sentence in the page's code and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often several products share a plan repository today is not known (author).

```

<!-- /omni-outbox-settled: s1-01-confirm-names-each-planning-product -->
