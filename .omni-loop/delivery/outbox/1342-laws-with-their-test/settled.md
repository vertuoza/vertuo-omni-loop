# Settled outbox items — PRD 1342

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-require-proof-skips-proposed-and-copies -->

## s1-01-require-proof-skips-proposed-and-copies — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-require-proof-skips-proposed-and-copies
prd: 1342
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Once a repository says every law must name its test, should entries nobody has confirmed yet, and the copies a plan repository keeps of other repositories' knowledge, be held to it too?

## The decision, in plain words

No. An entry still waiting for a person's confirmation is not a law yet, so it may stay without a test; and a copied knowledge base follows its own repository's choice, not the plan repository's.

## The intro, for fun

A rule nobody has signed yet walks into the courtroom and asks to see its own test.

## The punchline, for fun

The judge says: come back once someone says you are a law.

## The options, in plain words

A. A. Skip both: a proposed entry is no law yet, and a copy follows its own repository (built).
B. B. Refuse proposed entries too: /omni:invade then has to write pending or a test for every entry it proposes.
C. C. Hold imported copies to the plan repository's own 'every law names its test' switch as well.

## What I had to decide

Whether the new 'every law names its proof' check also refuses unconfirmed (proposed) entries and imported copies.

## What I did meanwhile

Proposed entries and imported copies may stay untested when the switch is on; confirmed rules and invariants of the repository itself may not.

## What it costs to change later

A constant: two conditions in one function of the knowledge check, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the check refuses 'a rule or an invariant' and does not name proposed entries or imported copies. (author)
- Whether a copy should read its target's requireProof once imported copies carry the target's config is left to a later PRD. (author)

```

<!-- /omni-outbox-settled: s1-01-require-proof-skips-proposed-and-copies -->

<!-- omni-outbox-settled: s1-02-law-label-styled-by-init -->

## s1-02-law-label-styled-by-init — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-law-label-styled-by-init
prd: 1342
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The new label for law issues needs a colour and a description so that setting up a repository creates it like every other loop label. That lives outside this slice's ground: should this slice add it?

## The decision, in plain words

Yes. The slice gives the new label a purple colour and a one-line description in the set-up step, and updates the set-up tests that list every label, because the kit's own test refuses a label with no style.

## The intro, for fun

A brand-new label showed up to the party without a colour, and the bouncer would not let it in.

## The punchline, for fun

So it borrowed a purple coat and a name tag on the way.

## The options, in plain words

A. A. Add the style and the test lists in this slice (built).
B. B. Move the style to another slice, leaving the kit's tests red until it lands.
C. C. Pick another colour or wording for the label.

## What I had to decide

Whether the law label's style is added by this slice, outside its declared ground, or left to a later slice.

## What I did meanwhile

Setting up a repository creates the law label, purple, described as a law waiting for its test.

## What it costs to change later

A constant: one style line and the label lists of two test files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gave the new label key to this slice but not the set-up code that styles every label; the kit's test of label styles makes the two inseparable. (author)

```

<!-- /omni-outbox-settled: s1-02-law-label-styled-by-init -->

<!-- omni-outbox-settled: s3-01-law-judge-own-secret -->

## s3-01-law-judge-own-secret — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-law-judge-own-secret
prd: 1342
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Should the new law judge have its own secret, even if that means touching a few files outside this slice's ground?

## The decision, in plain words

We gave it its own secret, as the spec asks, and added it everywhere the web app lists its secrets, plus two tests that count the Jev decisions.

## The intro, for fun

Every judge wants its own key to the courthouse.

## The punchline, for fun

We cut a new key and updated the key cabinet's inventory too.

## The options, in plain words

A. Its own secret, added to the app's settings list, its example file and its read-me list, the option built.
B. Share the constituent judge's secret, so nothing outside the slice changes, at the price of one secret opening two judges.

## What I had to decide

Whether the law judge signs with its own secret or shares the constituent judge's, and whether the slice may edit the app's settings list to add it.

## What I did meanwhile

A new optional secret; left empty, every law judge call is refused and the classifier's own answer stands, so nothing breaks before it is set.

## What it costs to change later

Removing the variable from four files and pointing the law judge at the other secret.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the slice plan meant the app's settings list to be part of this slice (author)

```

<!-- /omni-outbox-settled: s3-01-law-judge-own-secret -->

<!-- omni-outbox-settled: s3-02-law-worth-state-shape -->

## s3-02-law-worth-state-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-law-worth-state-shape
prd: 1342
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

What exactly does the harvest tell the judge when it asks whether a decision is worth a law?

## The decision, in plain words

Five things, each with a length limit: the statement, its why, the principle it serves, its domain and its PRD's title. Anything else in the request is refused, so a mistake in the caller shows up at once.

## The intro, for fun

A judge who reads only five lines rules fast.

## The punchline, for fun

Bring a sixth line and the clerk sends you home.

## The options, in plain words

A. Exactly the five facts the spec names, strict, with limits, the option built.
B. Also send whether it is a rule or an invariant.
C. Accept and ignore any extra fact, so a caller sending more is never refused.

## What I had to decide

Which facts about a decision the worth-a-law judge reads, how long each may be, and whether an unexpected fact is refused or ignored.

## What I did meanwhile

Only the statement is required; the four others may be left out. The two later slices that ask the judge send exactly these five.

## What it costs to change later

Adding one optional field to the judge and to its two callers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether knowing a rule from an invariant would change the judge's answer (author)

```

<!-- /omni-outbox-settled: s3-02-law-worth-state-shape -->
