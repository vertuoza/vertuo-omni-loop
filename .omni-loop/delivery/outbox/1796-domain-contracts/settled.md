# Settled outbox items — PRD 1796

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-summary-line-outside-territory -->

## s1-01-summary-line-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-summary-line-outside-territory
prd: 1796
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The plan asked the knowledge check to count contracts in its summary, but the line that prints the summary sits in a file this slice was not given. Should the slice change it anyway?

## The decision, in plain words

We changed it: the summary now counts contracts. We also made one small typing change in the harvest's classifier so the new kind of entry cannot slip into its list of rules.

## The intro, for fun

The plan drew a fence, then asked for a gate on the other side of it.

## The punchline, for fun

We stepped over, fixed the gate, and wrote down the footprints.

## The options, in plain words

A. Change both files in s1, as built, and record it here.
B. Undo both and leave the summary line to a follow-up slice, so s1 stays strictly inside its territory; the typecheck then needs the classifier fix elsewhere.

## What I had to decide

Whether slice s1 may change the two files outside its territory that the new kind forces: the summary line of omni check knowledge (kit/bin/commands/check.ts) and the type of the classifier's rule list (kit/lib/knowledge/classify.ts).

## What I did meanwhile

Both are changed: the summary reads '<p> principle(s), <r> rule(s), <i> invariant(s), <c> contract(s) across …', and the classifier's list of rules and invariants is typed so a contract can never enter it. Neither file is in any sibling slice's territory, so the wave has no collision.

## What it costs to change later

Two lines each; reverting either is a one-line edit with no stored shape involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant to list kit/bin/commands/check.ts in s1's territory and left it out by mistake (author)

```

<!-- /omni-outbox-settled: s1-01-summary-line-outside-territory -->

<!-- omni-outbox-settled: s1-02-contract-source-and-glob-strictness -->

## s1-02-contract-source-and-glob-strictness — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-contract-source-and-glob-strictness
prd: 1796
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The spec's example writes a contract's source as 'PRD 412', but the check has always asked for 'PRD #412'. And should a pattern instead of a file name be refused even in a copy imported from another repository?

## The decision, in plain words

We kept the check as strict as it is for rules: a source needs the number sign, so our first contract says 'PRD #1796'. A pattern is refused everywhere, even in an imported copy, while whether a file exists is only asked of this repository's own files.

## The intro, for fun

One small number sign stood between a contract and a green check.

## The punchline, for fun

We kept the sign, and wrote the contract to match it.

## The options, in plain words

A. Keep 'PRD #<n>' and refuse a glob everywhere, as built.
B. Accept 'PRD <n>' without the sign on every entry, and skip the glob check in an imported copy too.

## What I had to decide

How a contract's Source: and Points to: lines are read: whether 'PRD <n>' without '#' leads somewhere, and whether the glob refusal is skipped in an imported copy as the existence check is.

## What I did meanwhile

Source: follows the rule check unchanged ('PRD #<n>', an issue number or a path), so DC-PRODUCT-1 reads 'Source: PRD #1796'; a glob in Points to: is refused in every context, and an imported copy (ctx.copyOf) skips only the existence and directory checks.

## What it costs to change later

Two constants in kit/lib/knowledge/check-knowledge.ts; loosening either later breaks no entry.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's 'PRD 412' example meant the number sign could be dropped for every kind of entry (author)

```

<!-- /omni-outbox-settled: s1-02-contract-source-and-glob-strictness -->

<!-- omni-outbox-settled: s1-03-contracts-left-out-of-codeowners -->

## s1-03-contracts-left-out-of-codeowners — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-contracts-left-out-of-codeowners
prd: 1796
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The list of files whose changes need the law owners' approval names every register file. Should the new contracts file be on that list too?

## The decision, in plain words

We left it off. A contract is never a law, and the spec asks that any person can answer a change to one, through the usual high question, not only the law owners.

## The intro, for fun

Every register gets a bouncer at the door, except the new one.

## The punchline, for fun

It never serves anything strong enough to need one.

## The options, in plain words

A. Leave the contracts file out of the owners list, as built.
B. Put the contracts file on the owners list too, so a contract edit also needs a law owner's approving review.

## What I had to decide

Whether omni kb owners' CODEOWNERS block owns each contracts.md beside principles.md, rules.md and invariants.md.

## What I did meanwhile

The block owns only the three required register files; contracts.md is never added, so this repository's CODEOWNERS file does not change and a contract edit asks no law owner.

## What it costs to change later

One list in kit/lib/codeowners-laws.ts; adding the file later means switching that list and re-running omni kb owners once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a principles.md, which also holds no law yet is owned, should have set the precedent instead (author)

```

<!-- /omni-outbox-settled: s1-03-contracts-left-out-of-codeowners -->
