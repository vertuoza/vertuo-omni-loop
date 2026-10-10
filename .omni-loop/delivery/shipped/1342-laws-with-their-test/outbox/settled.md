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

<!-- omni-outbox-settled: s5-01-wiring-and-env-list-outside-territory -->

## s5-01-wiring-and-env-list-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-wiring-and-env-list-outside-territory
prd: 1342
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

To switch the new law check on in the GitHub App, this part had to touch two files its plan did not give it: the place that starts the App's jobs, and the setup list of secrets in the App's guide. Is that acceptable?

## The decision, in plain words

Yes: the App now asks the Omni page whether each untested rule is worth a law, and the guide's list of secrets names the new one. Without these two small edits the feature would be built but never run, and the guide's own check would fail.

## The intro, for fun

The plan gave this part a room, and the light switch was in the hallway.

## The punchline, for fun

So it reached out, flipped it, and left a note on the door.

## The options, in plain words

A. A. Keep both edits in this slice, as built.
B. B. Move the README bullet to s9 and leave the docs check red until s9 lands.
C. C. Leave the App unwired until a later slice, so the law judge is never asked in production.

## What I had to decide

The slice's territory names apps/omni-app/src/knowledge-harvest/, apps/omni-app/src/env and apps/omni-app/.env.example (which does not exist). Wiring the judge into the served function needs one change in apps/omni-app/src/functions.ts, and the docs check (src/env-docs.test.ts) requires apps/omni-app/README.md's variable list to name LAW_JUDGE_SECRET, a file s9 owns. The spec asks that the judge secret be a documented variable checked by the app's env tests.

## What I did meanwhile

Added the knowledge harvest's lawJudge argument in src/functions.ts (built only when LAW_JUDGE_SECRET is set) and one bullet for LAW_JUDGE_SECRET in the README's env-variables list. No .env.example was created, since the app has none.

## What it costs to change later

Reverting is two small hunks; s9 may reword the README bullet freely.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s9 expected to write that README bullet itself is not settled by the plan.

```

<!-- /omni-outbox-settled: s5-01-wiring-and-env-list-outside-territory -->

<!-- omni-outbox-settled: s6-01-sweep-asks-the-model-first -->

## s6-01-sweep-asks-the-model-first — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-sweep-asks-the-model-first
prd: 1342
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When the sweep checks the old rules that have no test, who gives the answer when the company's judge is switched off?

## The decision, in plain words

A language model gives its own answer first, and the judge's answer replaces it when the judge is on. A rule the model cannot answer for is left as it is, and the switch that makes untested rules an error stays off until every rule has an answer.

## The intro, for fun

Every old rule gets a hearing, even when the judge is out to lunch.

## The punchline, for fun

Nobody is sentenced without an answer on the record.

## The options, in plain words

A. A. Ask the model first, the judge's answer counts when it gives one; an unanswered rule waits, and the switch stays off.
B. B. Treat every rule the judge does not answer as worth a law, opening an issue for each, with no model.
C. C. Leave every rule the judge does not answer untouched, with no model, so the sweep does nothing while the judge is off.

## What I had to decide

Whether the sweep needs the model key, and what happens to a rule nobody could judge.

## What I did meanwhile

The sweep asks the model the same worth-a-law question the harvest asks, then omni decide law-worth with that answer as --old. A rule the model cannot judge stays unenforced, is listed as not judged, and laws.requireProof is not set; a second run picks it up.

## What it costs to change later

One branch in the sweep command: dropping the model call or setting requireProof regardless is a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the sweep falls back to the classifier's answer but has no classifier for register entries, so a small model question stands in for it.

```

<!-- /omni-outbox-settled: s6-01-sweep-asks-the-model-first -->

<!-- omni-outbox-settled: s6-02-no-ledger-rule-leaves-anyway -->

## s6-02-no-ledger-rule-leaves-anyway — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-no-ledger-rule-leaves-anyway
prd: 1342
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When an old rule is judged not worth a test but no past decision record says where it came from, where does it go?

## The decision, in plain words

It still leaves the list of rules, and the sweep's report names it as recorded nowhere, so the person reviewing the change sees it before merging. Its words stay in the history of the repository.

## The intro, for fun

Some rules arrived before anyone kept the receipts.

## The punchline, for fun

They leave quietly, but the report still waves goodbye by name.

## The options, in plain words

A. A. Remove it anyway, naming it in the report as recorded nowhere.
B. B. Keep it in its register as it is, so it stays unenforced and the switch cannot turn on.
C. C. Record it in a new file of not-worth-a-law entries in the knowledge folder.

## What I had to decide

What a not-worth-a-law entry with no ledger entry in its Source becomes.

## What I did meanwhile

Removed from its register like any other no; the report says 'recorded in no ledger', and the citations of it are listed. Most register entries in this repository have no ledger Source, so this case is common.

## What it costs to change later

One branch: keeping the entry instead, or writing a note somewhere else, is a few lines in the sweep's pure module.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec assumes every entry has a source PRD with a settled.md; most entries written by invade or by hand do not.

```

<!-- /omni-outbox-settled: s6-02-no-ledger-rule-leaves-anyway -->

<!-- omni-outbox-settled: s6-03-harvest-helpers-shared -->

## s6-03-harvest-helpers-shared — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-harvest-helpers-shared
prd: 1342
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

Should the sweep reuse the harvest's way of asking the judge and opening a law issue, even though that file belongs to an earlier part of this work?

## The decision, in plain words

Yes: the harvest's three small helpers were made shareable, unchanged in behaviour, so both paths ask the judge and open issues the same way.

## The intro, for fun

Two doors into the same courtroom should use the same doorbell.

## The punchline, for fun

One small edit next door saved a whole copy of the wiring.

## The options, in plain words

A. A. Export the helpers from the harvest command and reuse them.
B. B. Copy them into the knowledge command, leaving the harvest untouched.
C. C. Move them into a new shared module both commands import.

## What I had to decide

Whether to touch kit/bin/commands/harvest.ts, outside this slice's territory, to share askLawWorth, openLawIssue and prdTitle.

## What I did meanwhile

Exported the three helpers from harvest.ts; askLawWorth now takes its --ref from the caller (the harvest still passes 'PRD <n> <id>', the sweep passes 'sweep <id>'). The harvest's tests pass unchanged.

## What it costs to change later

Moving the helpers to a shared module later is a rename of imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The territory names no shared place for command helpers.

```

<!-- /omni-outbox-settled: s6-03-harvest-helpers-shared -->

<!-- omni-outbox-settled: s7-02-terminal-checks-read-the-base-rules -->

## s7-02-terminal-checks-read-the-base-rules — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-terminal-checks-read-the-base-rules
prd: 1342
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The terminal checks for a bug fix, a visual fix and a feature's risky changes needed small edits in shared files outside this slice's ground to see a rule losing its test. Should this slice make them?

## The decision, in plain words

Yes: the edits are small and only hand the checks the rules as the main branch holds them, so the server and the terminal now judge the same way.

## The intro, for fun

Three checks were each given the old rulebook to compare with.

## The punchline, for fun

None of them had to learn a new trick, only where the shelf is.

## The options, in plain words

A. A. Wire all four terminal checks in this slice (built).
B. B. Wire only omni bug and omni visual, which the plan asks for, and leave coverage and status to a follow-up.
C. C. Revert the terminal wiring and open a follow-up slice for it.

## What I had to decide

Whether s7 wires the base knowledge folder into omni bug, omni visual, omni check coverage and the omni status gate, editing files no slice of this PRD owns (settled item s2-01 left the terminal commands to a follow-up).

## What I did meanwhile

Edited outside the territory: kit/lib/git.ts (baseKnowledge, and knowledgeAt moved there from kit/lib/status/facts.ts, which now imports it), kit/bin/branch-range.ts (fixLaws, and grade gets base and exec), kit/bin/commands/bug.ts, kit/bin/commands/visual.ts, kit/bin/commands/check.ts, kit/bin/commands/status.ts, kit/lib/outbox/account.ts (LAW_RULES exported) and a new test file, kit/bin/law-demoted.test.ts.

## What it costs to change later

A constant: each command drops its base argument and law-demoted goes back to firing only on the server.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's s7 territory names kit/lib/bug/ and kit/bin/bug.test.ts but not the command files that call them, so 'omni bug names the outbox' needed them.
- (author) The wave's territory check will flag these paths as outside s7.

```

<!-- /omni-outbox-settled: s7-02-terminal-checks-read-the-base-rules -->

<!-- omni-outbox-settled: s7-03-fix-folder-from-branch-number -->

## s7-03-fix-folder-from-branch-number — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-fix-folder-from-branch-number
prd: 1342
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When the server checks a fix, how does it find the folder where the fix's questions about rules live?

## The decision, in plain words

It reads the issue number at the start of the fix's branch name and looks for that number's bug or visual folder; a fix made for a plan repository is pointed to the plan's own pull request instead, where its record lives.

## The intro, for fun

Every fix carries its ticket number on its sleeve.

## The punchline, for fun

The check just reads the sleeve.

## The options, in plain words

A. A. Find the folder from the branch's issue number; a target's fix PR defers to the plan PR (built).
B. B. Find the folder from the files the range adds under bugs/ or visual/.
C. C. Grade a target's fix PR in the target too, failing it when it touches a law.

## What I had to decide

How evaluate finds a fix PR's folder (bugs/<nnnn>-<slug> or visual/<nnnn>-<slug>), and what a target repository's fix PR with a 'Part of <plan repo>#<n>' body gets.

## What I did meanwhile

The folder is the one whose number prefix is the leading digits of the branch topic (branches.fix, topic <n>-<slug>), searched under bugs/ then visual/. A branch with no leading number, or no such folder, has no fix folder: a change to a law then fails naming that. A target's fix PR deferring to a plan PR passes and links it, as a target feature PR does. The fix's outbox comment is posted like a feature PR's.

## What it costs to change later

A constant: one function in apps/omni-app/src/evaluate/evaluate.ts and one branch in checkTarget.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the folder but not how the server finds it; the fix skills cut the branch with topic <n>-<slug>, which this relies on.
- (author) Whether a target's fix PR touching a law should instead be graded in the target is not settled by the spec.

```

<!-- /omni-outbox-settled: s7-03-fix-folder-from-branch-number -->

<!-- omni-outbox-settled: s8-01-enforce-listed-under-every-day -->

## s8-01-enforce-listed-under-every-day — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-enforce-listed-under-every-day
prd: 1342
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

The help and the documentation group the skills by what a person wants to do. Where should the new skill that writes a rule's test be listed?

## The decision, in plain words

Under the everyday skills, right after the one that films a feature's proof, since both prove something already decided.

## The intro, for fun

A new skill arrived and every shelf in the help already had a name tag on it.

## The punchline, for fun

It sat next to its cousin who films proofs, and nobody complained.

## The options, in plain words

A. A. Every day, after the proof films (built).
B. B. Start a change, beside the bug and visual fixes.
C. C. Run by other skills, once a later PRD lets the loop take law issues by itself.

## What I had to decide

Which help group /omni:enforce joins: everyday (after /omni:prove), or start (beside the two fix skills), whose list the docs test in apps/galaxy pins outside this slice.

## What I did meanwhile

The help entry is group everyday, after prove; the docs' skills page lists it there with no other change.

## What it costs to change later

A constant: the entry's group, and the pinned list in apps/galaxy/src/docs/skills.test.ts when it moves to start.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the skill but not the help group it belongs to.

```

<!-- /omni-outbox-settled: s8-01-enforce-listed-under-every-day -->

<!-- omni-outbox-settled: s8-02-fix-law-items-written-by-hand -->

## s8-02-fix-law-items-written-by-hand — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-fix-law-items-written-by-hand
prd: 1342
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

When a bug fix or a visual fix changes a rule that has a test, it must leave a question for a person, but the tool that writes such questions only works for a planned feature. How should the fix write it?

## The decision, in plain words

The fix writes each question itself, following the same layout every question uses, and the existing fix check confirms it is complete before the pull request opens.

## The intro, for fun

The question-printing machine only takes feature tickets, and a fix showed up with a bug ticket.

## The punchline, for fun

So the fix writes its question by hand, in its neatest handwriting.

## The options, in plain words

A. A. Write the item by hand from the template in each fix skill (built).
B. B. Teach omni item new to write into a fix's folder, then have the skills call it.
C. C. Keep the template and add a check command that validates a fix's items before the push.

## What I had to decide

Whether the fix skills write a law item by hand in the fix's outbox, or wait for omni item new to learn a fix's folder (kit/bin/commands/item.ts, outside this slice).

## What I did meanwhile

Both fix skills carry the item's full template and the account's, ids s1-<k>-<slug>, slice s1, rank high, bears-on the law id; omni bug and omni visual grade the folder before the PR opens, and the server check grades it on the PR.

## What it costs to change later

A constant: a later slice teaches omni item new a --fix <folder> form and the two skill sections call it instead of the template.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the fix skills raise the items but not with which tool; omni item new refuses a number with no PRD folder.

```

<!-- /omni-outbox-settled: s8-02-fix-law-items-written-by-hand -->

<!-- omni-outbox-settled: s7-01-check-reads-knowledge-from-head -->

## s7-01-check-reads-knowledge-from-head — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-10-10T08:40:27Z
- Channel: feature pull request #1343
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1343#issuecomment-6095767377
- Basis: stated — the answer is settled as "drifted" because a human said so, not because a comparison read it
- Closed: yes — reworked by #1393, the sub-pull request that brought the build back in line
- Rank: high
- Bears on: N-PRODUCT-4
- Raised: 2026-10-10
- Slice: s7
- Wave: 3
- Became: N-PRODUCT-4

### The answer, as it was given

```text
C. C. Keep A and reword the standing rule to say the rules folder is read from the pull request as data.
```

### The item, as it was raised

```text
---
id: s7-01-check-reads-knowledge-from-head
prd: 1342
slice: s7
rank: high
bears-on: N-PRODUCT-4
raised: 2026-10-10
wave: 3
---

## The question, in plain words

To notice a rule losing its test, the pull request check must now read the rules folder from the pull request too, while a standing rule says it reads only the delivery folder from there. Is that acceptable?

## The decision, in plain words

Yes: the check still takes its settings from the main branch, so a pull request cannot change how it is judged, and it reads the pull request's rules only as the thing being judged.

## The intro, for fun

The referee has to read the new rulebook to notice a page was torn out of it.

## The punchline, for fun

He still blows the whistle by the old rulebook, though.

## The options, in plain words

A. A. Read the rules folder from both sides, settings from the main branch only (built).
B. B. Read the rules folder from the main branch only, and stop spotting a rule that loses its test on the server.
C. C. Keep A and reword the standing rule to say the rules folder is read from the pull request as data.

## What I had to decide

Whether the outbox check may snapshot the knowledge folder at the head as well as at the base, which grading law-proof and law-demoted needs, against N-PRODUCT-4's wording that only the delivery folder is read from the head.

## What I did meanwhile

With laws.source knowledge, the check snapshots paths.knowledge at the base and at the head beside the delivery folder. The config, its labels and its branch shapes still come from the base only. A head that removes or demotes a law fires law-text and law-demoted, so it cannot hide a law by editing the registers.

## What it costs to change later

A constant: drop the head knowledge snapshot in apps/omni-app/src/outbox-check/outbox-check.ts, or reword N-PRODUCT-4 to name the knowledge folder as data read from the head.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) N-PRODUCT-4 is unenforced and was adopted as medium; whether its author meant 'only the delivery folder' as a hard boundary or as 'never the config' is not written down.
- (author) Reading law-proof paths from the base registers instead would miss a law the pull request adds with its test; this slice did not explore that further.

```

<!-- /omni-outbox-settled: s7-01-check-reads-knowledge-from-head -->

<!-- omni-outbox-settled: s8-03-plugin-test-gains-law-skill-tests -->

## s8-03-plugin-test-gains-law-skill-tests — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-10T08:40:27Z
- Channel: feature pull request #1343
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1343#issuecomment-6095767377
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-89
- Raised: 2026-10-10
- Slice: s8
- Wave: 4
- Stays here: one answer about one test file: adding tests to a law's proof file is fine when the tests that prove the law stay as they were, and the high item the rule raises is the person's answer each time.

### The answer, as it was given

```text
A. A. Add the tests to the file the plan names, leaving the agent-limit tests untouched (built).
```

### The item, as it was raised

```text
---
id: s8-03-plugin-test-gains-law-skill-tests
prd: 1342
slice: s8
rank: high
bears-on: BR-PRODUCT-89
raised: 2026-10-10
wave: 4
---

## The question, in plain words

The test file that proves the loop never starts too many agents at once also holds the checks on how every skill is written, and this work added new checks to it. Is it all right to add to that file?

## The decision, in plain words

Yes: the new checks only cover the new rule-testing skill and the two fix skills, and the checks proving the agent limit were left exactly as they were.

## The intro, for fun

Someone added a new chapter to a rulebook that a judge keeps on the bench.

## The punchline, for fun

The judge's own page was not touched, but the bench still wants a signature.

## The options, in plain words

A. A. Add the tests to the file the plan names, leaving the agent-limit tests untouched (built).
B. B. Move this slice's tests to a file of their own, so the law's proof file does not change.

## What I had to decide

Whether the shape tests of /omni:enforce and the fix skills' law step go in kit/test/plugin.test.ts, the file BR-PRODUCT-89 names as its proof, or in a test file of their own.

## What I did meanwhile

A new describe block at the end of kit/test/plugin.test.ts holds nine tests for this slice; no line of the tests proving BR-PRODUCT-89 changed, and the whole file passes.

## What it costs to change later

A constant: move the new describe block to its own file under kit/test, which then no law names.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names kit/test/plugin.test.ts as this slice's territory and the spec puts the skill tests there; nothing says whether adding to a law's proof file without touching its tests needs an answer, so it is raised.

```

<!-- /omni-outbox-settled: s8-03-plugin-test-gains-law-skill-tests -->

<!-- omni-outbox-settled: s1-03-init-test-lists-the-law-label -->

## s1-03-init-test-lists-the-law-label — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-10T08:46:46Z
- Channel: feature pull request #1343
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1343#issuecomment-6095814814
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-13
- Raised: 2026-10-10
- Slice: s1
- Wave: 1
- Stays here: one answer about one test file, as for s8-03: a law's proof file may gain tests when the tests that prove the law stay as they were.

### The answer, as it was given

```text
A. A. Keep the new law label in the setup test's list of labels, with the settings checks untouched (built).
```

### The item, as it was raised

```text
---
id: s1-03-init-test-lists-the-law-label
prd: 1342
slice: s1
rank: high
bears-on: N-PRODUCT-13
raised: 2026-10-10
wave: 1
---

## The question, in plain words

The test file that proves how the kit writes a repository's settings also checks which labels the kit creates, and this work added the new law label to that list. Is it all right to change that file?

## The decision, in plain words

Yes: only the list of expected labels gained the new law label; the checks that prove the settings rule were left exactly as they were.

## The intro, for fun

A new name was added to the guest list kept in the security guard's office.

## The punchline, for fun

The guard's own rules were not touched, but the office still asks who signed in.

## The options, in plain words

A. A. Keep the new law label in the setup test's list of labels, with the settings checks untouched (built).
B. B. Move the list of labels to a test file of its own, so the settings rule's proof file does not change.

## What I had to decide

Whether the label lists in kit/bin/init.test.ts, the proof file N-PRODUCT-13 names beside kit/lib/init/settings.test.ts, may gain omni:law.

## What I did meanwhile

s1 appended omni:law to LOOP_LABELS and to two expectations of the created labels; no line of the tests proving N-PRODUCT-13 changed.

## What it costs to change later

A constant: move the label-list expectations to a test file of their own, which then no law names.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Found by omni check coverage after the waves: s1 changed the file outside its territory and raised no item for it.

```

<!-- /omni-outbox-settled: s1-03-init-test-lists-the-law-label -->
