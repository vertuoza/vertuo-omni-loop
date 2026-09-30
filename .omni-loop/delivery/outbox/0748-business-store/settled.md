# Settled outbox items — PRD 748

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-no-page-reads-as-no-sign-in -->

## s1-01-no-page-reads-as-no-sign-in — adopted

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
id: s1-01-no-page-reads-as-no-sign-in
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When a repository has no Omni page set at all, or its sign-in has expired for good, what should the business read say to an agent?

## The decision, in plain words

Both count as having no sign-in: the agent reads one line saying so and carries on, exactly as when nobody ever signed in.

## The intro, for fun

An agent knocked on a door that was never built.

## The punchline, for fun

It was told nobody is home, and went back to work.

## The options, in plain words

A. Both are no-sign-in, the option built.
B. ask.url unset exits 2 as a configuration error, and a 401 reads as refused.

## What I had to decide

Which of the five read states covers ask.url unset in the config, and a 401 the refresh cannot fix.

## What I did meanwhile

Both answer state no-sign-in with exit 0; a 403, a 404 or another refusal answers refused. ask.url unset is not a configuration error (exit 2), so a skill line calling it never stops.

## What it costs to change later

Two branches in kit/bin/commands/business.mjs and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec lists the states but names neither case (author)

```

<!-- /omni-outbox-settled: s1-01-no-page-reads-as-no-sign-in -->

<!-- omni-outbox-settled: s1-02-last-seen-stays-empty -->

## s1-02-last-seen-stays-empty — adopted

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
id: s1-02-last-seen-stays-empty
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Each fact an agent reads carries a 'last seen' date, but nothing in this change ever sees a fact anywhere. What should that date say?

## The decision, in plain words

It stays empty for now. It fills in once a later change reads facts from real sources, such as a pricing page.

## The intro, for fun

We built a guest book before anyone came to visit.

## The punchline, for fun

Its pages are blank, and that is honest.

## The options, in plain words

A. Null until evidence sets it, the option built.
B. The date the claim was picked or last confirmed.

## What I had to decide

What claims.last_seen and the contract's lastSeen hold while no evidence sets them.

## What I did meanwhile

The column last_seen is null on every claim, and lastSeen is null in every read; the pick date is kept apart in created_at and updated_at.

## What it costs to change later

One nullable column; filling it later needs no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec names lastSeen in decision 14 without saying what sets it before evidence drafting (author)

```

<!-- /omni-outbox-settled: s1-02-last-seen-stays-empty -->

<!-- omni-outbox-settled: s1-03-help-count-test -->

## s1-03-help-count-test — adopted

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
id: s1-03-help-count-test
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Adding the new business command meant changing a test that counts every command, and that test sits outside this slice's agreed files. Is that fine?

## The decision, in plain words

We raised the expected number of commands by one in that test, and changed nothing else in it.

## The intro, for fun

A new command walked in and the head count was off by one.

## The punchline, for fun

So we counted again, out loud, and wrote down the new number.

## The options, in plain words

A. Raise the count in the help test to 35, the option built.
B. Leave the count as it is and take the business command out of the command list, which the plan does not allow.

## What I had to decide

Whether kit/lib/help/entries.test.mjs may move its command count from 34 to 35, outside s1's territory.

## What I did meanwhile

The count reads 35 in both of its assertions; the test's other checks are untouched.

## What it costs to change later

Two numbers in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for s1 lists kit/lib/help/entries.mjs but not its test (author)

```

<!-- /omni-outbox-settled: s1-03-help-count-test -->
