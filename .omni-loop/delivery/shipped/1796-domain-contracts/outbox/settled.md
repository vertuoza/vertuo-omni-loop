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
- Stays here: A one-off territory choice inside this slice, cheap to revert; nothing lasting about how the product behaves or is built.

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
- Became: ADR-0118

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
- Became: ADR-0119

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

<!-- omni-outbox-settled: s1-04-contract-tests-beside-a-rule-proof -->

## s1-04-contract-tests-beside-a-rule-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-16T10:06:13Z
- Channel: feature pull request #1982
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1982#issuecomment-6213112819
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-95
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Became: playbook/testing#layout

### The answer, as it was given

```text
A. Keep the contract tests in the file that proves the rule, as built.
```

### The item, as it was raised

```text
---
id: s1-04-contract-tests-beside-a-rule-proof
prd: 1796
slice: s1
rank: high
bears-on: BR-PRODUCT-95
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The tests for the new contract checks went into the same file that proves an existing rule about the knowledge check. Is it fine to grow that file, as long as the rule's own tests stay as they are?

## The decision, in plain words

We added the contract tests to that file, as the spec's test plan asked, and left the rule's own tests exactly as they were.

## The intro, for fun

A new neighbour moved into the building where a rule keeps its proof.

## The punchline, for fun

Nobody touched the rule's flat, but the doorbell rang anyway.

## The options, in plain words

A. Keep the contract tests in the file that proves the rule, as built.
B. Move them into a test file of their own, so the rule's proof file stays only about the rule.

## What I had to decide

Whether slice s1's contract tests may live in kit/lib/knowledge/check-knowledge.test.ts, the file BR-PRODUCT-95's Enforced by: names, beside that rule's proof.

## What I did meanwhile

One new describe block, 'a domain contract (PRD 1796)', is appended to the file; no existing test in it is changed or removed, so BR-PRODUCT-95's proof (the laws.requireProof block) runs as before. The testing form allows a law's proof file to gain tests of other behaviour (PRD 1739, s2-01).

## What it costs to change later

Moving the block to its own test file later is a cut and paste, with no stored shape involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the coverage guard should tell an added test from a changed proof in a law's test file (author)

```

<!-- /omni-outbox-settled: s1-04-contract-tests-beside-a-rule-proof -->

<!-- omni-outbox-settled: s1-05-first-contract-written-as-law-text -->

## s1-05-first-contract-written-as-law-text — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-16T10:06:13Z
- Channel: feature pull request #1982
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1982#issuecomment-6213112819
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: DC-PRODUCT-1
- Raised: 2026-10-16
- Slice: s1
- Wave: 2
- Became: DC-PRODUCT-1

### The answer, as it was given

```text
A. Keep DC-PRODUCT-1 as written, pointing to the front-matter schema.
```

### The item, as it was raised

```text
---
id: s1-05-first-contract-written-as-law-text
prd: 1796
slice: s1
rank: high
bears-on: DC-PRODUCT-1
raised: 2026-10-16
wave: 2
---

## The question, in plain words

This change writes the repository's first domain contract, and a change to a contracts file now counts as a change to the knowledge's text. Do you approve the contract as worded?

## The decision, in plain words

We wrote the one contract the spec asks for, word for word: an outbox item has exactly one rank, human-action, high or medium, and the file that enforces it is the front-matter schema.

## The intro, for fun

The new rule said every contract needs a signature, and the first contract arrived before the rule did.

## The punchline, for fun

So it waited at the door, holding its own permission slip.

## The options, in plain words

A. Keep DC-PRODUCT-1 as written, pointing to the front-matter schema.
B. Reword it, or point it to another file, before the feature merges.

## What I had to decide

Slice s1 wrote `.omni-loop/knowledge/product/contracts.md` before slice s2 made `law-text` fire on a `contracts.md` file. Once both merged, the feature's coverage grade named the file as an unaccounted law-text change, and a law-text change is accounted only by a high item. The spec settles the words (Solution, "This repository's first contract", and acceptance criterion 9); only a person can approve them as knowledge.

## What I did meanwhile

Kept the contract exactly as the spec words it, and accounted for the file with this item in s1's account. Nothing else changed.

## What it costs to change later

Rewording the contract or its `Points to:` line is a one-file edit; `omni check knowledge` checks the pointed file exists.

## What I could not know

(author) The spec does not say whether the first contract, written by the PRD that introduces the kind, needs the same approval as any later contract change.

```

<!-- /omni-outbox-settled: s1-05-first-contract-written-as-law-text -->
