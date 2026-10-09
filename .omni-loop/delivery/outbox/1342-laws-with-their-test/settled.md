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

<!-- omni-outbox-settled: s2-01-law-demoted-needs-the-base -->

## s2-01-law-demoted-needs-the-base — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-law-demoted-needs-the-base
prd: 1342
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The new check that spots a law losing its test needs to see the knowledge base as it was before the change. Who hands it that earlier copy?

## The decision, in plain words

The check is built and works when it is given the earlier copy, but the commands that run the gate today do not hand it over yet. The pull request check on the server can pass it in the later slice that already reworks that check; the terminal commands wait for a follow-up.

## The intro, for fun

A law quietly losing its test is only visible if you remember what the law used to say.

## The punchline, for fun

The detective is hired; someone still has to give it yesterday's photo.

## The options, in plain words

A. A. The check takes the earlier copy when it is given one; the server check and the terminal commands learn to give it later, in the work that owns them
B. B. Teach the server check and the two terminal commands to give it now, in this slice
C. C. Add the server check's part to the later slice's to-do list, and the terminal commands to a new slice of this PRD

## What I had to decide

`law-demoted` compares register entries at the base with the head, so `riskyChanges` needs the base knowledge folder. Its callers, `kit/bin/commands/check.ts` (`omni check coverage`), `kit/bin/commands/status.ts` (`omni status --base`) and `apps/omni-app/src/evaluate/evaluate.ts`, sit outside s2's territory. Wire them now outside the territory, or expose an optional `base` (a `KnowledgeSource`) on `riskyChanges`, `unaccountedChanges` and `gateResult` and leave wiring to the slices that own those files?

## What I did meanwhile

Added an optional `base?: KnowledgeSource | null` to `riskyChanges`, `unaccountedChanges` and `gateResult`; omitted, `law-demoted` never fires and every caller behaves as before. Tests cover it through `gateResult` with `memorySource`. No caller outside the territory changed.

## What it costs to change later

A constant-sized change: each caller passes `diskSource(<base checkout>)` (the app already has the base checked out) or a git-backed source built from `git show <base>:<file>` in the CLI. No stored shape moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s7, which owns `apps/omni-app/src/evaluate/`, will pass `base` to `gateResult`: its plan row does not say so.
- (author) No slice of this PRD owns `kit/bin/commands/check.ts` or `kit/bin/commands/status.ts`, so `omni check coverage` and `omni status --base` will not grade `law-demoted` until someone wires them.

```

<!-- /omni-outbox-settled: s2-01-law-demoted-needs-the-base -->

<!-- omni-outbox-settled: s2-02-comment-test-names-a-high-item -->

## s2-02-comment-test-names-a-high-item — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-comment-test-names-a-high-item
prd: 1342
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

One older test outside this slice's area expected a note in the plan to cover a change to a law, which the new rule no longer allows. Should that test change here?

## The decision, in plain words

Yes. The test now covers the change with a question ranked high, which is exactly what the new rule asks, and it checks the same thing it always did: a covered change is not reported.

## The intro, for fun

An old test still believed a note in the plan was enough to touch a law.

## The punchline, for fun

It has been gently told the rules changed, and it took the news well.

## The options, in plain words

A. A. Update the one test here, so the feature branch stays green
B. B. Revert it and leave the fix to another slice, the branch red meanwhile

## What I had to decide

`kit/lib/outbox/comment.test.ts` ('excludes a risky change an account names') accounted a `law-text` change with `spec <where>`, which the spec now refuses. The file is outside s2's territory. Edit it here, or leave it red for another slice?

## What I did meanwhile

Changed that one test to seed an item ranked `high` (`writeItem`) and account the change with `item s5-01-adr`. Its assertion is unchanged; no other line of the file moved.

## What it costs to change later

One test fixture; reverting it is a two-line edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The wave's territory check may flag `kit/lib/outbox/comment.test.ts` as outside s2's territory.

```

<!-- /omni-outbox-settled: s2-02-comment-test-names-a-high-item -->

<!-- omni-outbox-settled: s4-01-worth-a-law-missing-reads-as-today -->

## s4-01-worth-a-law-missing-reads-as-today — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-worth-a-law-missing-reads-as-today
prd: 1342
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

When the harvest reads an answer about a rule that does not say whether the rule is worth a test, what should happen to that rule?

## The decision, in plain words

It is written as it was before this change: kept as a rule with no test named. Fresh answers always say it; only answers saved before this change, or from the hosted harvest until its own update, can lack it.

## The intro, for fun

A rule shows up at the door without its ticket, the one that says whether it deserves a test.

## The punchline, for fun

We let it in the old way: it got in before tickets were printed.

## The options, in plain words

A. Read an answer without the field the old way: written with no test named, no law issue (built).
B. Refuse an answer without the field, so the model is asked again and the rule is not placed if it still leaves it out.
C. Treat a missing field as worth a law, so a law issue is opened for it.

## What I had to decide

Whether an answer without the new 'worth a law?' field is refused, or read the old way.

## What I did meanwhile

The field is optional in the answer's shape and asked for in the question to the model on every rule and invariant; an answer without it is written unenforced, exactly as before, and no law issue is opened for it.

## What it costs to change later

A constant: one optional flag in the answer's shape and one branch in the writer, plus their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the contract 'has worthALaw on every rule and invariant reply' without saying whether a reply missing it is refused.
- (author) The hosted harvest (a later slice) and its saved steps still send answers without the field until that slice lands; refusing them would break its tests and saved runs now.

```

<!-- /omni-outbox-settled: s4-01-worth-a-law-missing-reads-as-today -->

<!-- omni-outbox-settled: s4-02-law-issue-opens-before-its-entry -->

## s4-02-law-issue-opens-before-its-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-law-issue-opens-before-its-entry
prd: 1342
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

When a rule is judged worth a test, in what order should the harvest open its tracking issue and write the rule down?

## The decision, in plain words

The harvest works out every rule first and lists the issues to open, opens them, then writes each rule pointing at its issue. A rule the final checks refuse after its issue opened leaves that issue open with no rule, which a person closes.

## The intro, for fun

Which comes first, the rule or the ticket that says the rule needs a test?

## The punchline, for fun

The ticket, so the rule never points at a number that does not exist yet.

## The options, in plain words

A. Open the issues first from a first pass, then write the rules pending them in a second pass (built).
B. Write the rules with a placeholder number, then replace it once each issue is open.
C. Write the rules first as untested, and point them at their issues in a later pull request.

## What I had to decide

How the harvest learns each law issue's number before it writes 'pending' with that number, while staying a pure function that returns edits as data.

## What I did meanwhile

finishHarvest returns the law issues to open and writes no entry for them; the caller opens them and calls it again with their numbers, and the same entries, with the same ids, are written pending those issues. A 'no' is written as a 'not worth a law' note in the ledger, even when nothing else became knowledge, with who decided and Jev's score when Jev decided.

## What it costs to change later

A small change in two functions and the command that calls them: the second call could become one call with a placeholder, or the issues could open after the knowledge is written.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the harvest opens the law issue and writes pending #<issue>, not how it learns the number before writing it.
- (author) The spec's note reads 'not worth a law (<decided by> <score>)'; the classifier has no score, so its note reads 'not worth a law (classifier)'.

```

<!-- /omni-outbox-settled: s4-02-law-issue-opens-before-its-entry -->
