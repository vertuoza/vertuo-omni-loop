# Settled outbox items — PRD 971

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-example-personas-copy -->

## s3-01-example-personas-copy — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-example-personas-copy
prd: 971
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The brief named the example company and its three kinds of customer, but not their first names or the exact words of the doubtful customer's objection. Who should they be, and what should the objection say?

## The decision, in plain words

We named them Nadia (office manager, excited), Theo (plumber who subcontracts, neutral) and Marek (site foreman, doubtful). Marek objects that an approval screen expects a back office when his crew is five people, and the answer becomes the rule that a crew may have no back office.

## The intro, for fun

Three invented people just moved onto the front page, and one of them already has complaints.

## The punchline, for fun

Marek is not impressed, which is exactly his job.

## The options, in plain words

A. Keep Nadia, Theo and Marek, and the back-office objection (built).
B. Keep the people, but word the objection differently.
C. Use role names only, with no first names.

## What I had to decide

Keep these names and this objection, or give other words for the front page.

## What I did meanwhile

The front page shows these three names and this exchange.

## What it costs to change later

A copy change in one constant: names and sentences only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No real customer of a renovation firm was asked whether this objection rings true (author)

```

<!-- /omni-outbox-settled: s3-01-example-personas-copy -->

<!-- omni-outbox-settled: s4-01-example-fleets-mascot-guard -->

## s4-01-example-fleets-mascot-guard — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-example-fleets-mascot-guard
prd: 971
slice: s4
rank: medium
bears-on: none
raised: 2026-10-02
wave: 4
---

## The question, in plain words

The check that keeps the old company fleets out of the code also flags the spy mascot that the new example fleet SPY RING flies. Should HOME's example fleet list be allowed to name that mascot?

## The decision, in plain words

We let the example fleet list name the spy mascot, the same way the card rules and the sprite library already may. It is still never allowed as a fleet's name.

## The intro, for fun

Our spy fleet got stopped at the border for carrying its own passport.

## The punchline, for fun

We stamped it through, since the passport is the mascot, not the name.

## The options, in plain words

A. A. Add the example fleet list to the guard's mascot tables (built).
B. B. Give SPY RING another mascot the sprite library holds, and leave the guard as it was.
C. C. Keep SPY RING's spy mascot but read it from the card rules' table instead of naming it.

## What I had to decide

Whether HOME's example fleet list may name the spy mascot, as the card rules already do.

## What I did meanwhile

The example fleet list is on the guard's list of mascot tables; the spread shows SPY RING with its spy mascot as the spec asks.

## What it costs to change later

One line in a test's allow list: removing it means renaming or dropping SPY RING's mascot.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The change sits outside the slice's territory: the guard test lives in apps/galaxy/src/no-vertuoza-fleets.test.ts (author)

```

<!-- /omni-outbox-settled: s4-01-example-fleets-mascot-guard -->
