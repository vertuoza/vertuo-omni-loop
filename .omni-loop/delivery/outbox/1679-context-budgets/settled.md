# Settled outbox items — PRD 1679

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-kb-show-shares-the-measure-text -->

## s1-01-kb-show-shares-the-measure-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-kb-show-shares-the-measure-text
prd: 1679
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

To count what an agent reads, the size check needs the exact page the playbook command prints. Should both share one piece of code, even though that touches the playbook command, which this slice was not meant to change?

## The decision, in plain words

Both now share one piece of code that writes a playbook page, so the size counted is always the size an agent reads. The playbook command prints exactly what it printed before.

## The intro, for fun

Two rulers measuring the same page will one day disagree.

## The punchline, for fun

So now there is one ruler, and it lives with the budgets.

## The options, in plain words

A. A. One shared function in the budgets module, used by kb show and the measure (built).
B. B. Move the shared function into the playbook module, where the form resolver lives.
C. C. Keep two copies, held equal by a test, and silence the duplication gate.

## What I had to decide

Whether kit/bin/commands/kb.ts may take its form text from formShowText in kit/lib/budgets/measure.ts, a file outside s1's territory, rather than keep its own copy of the same ten lines.

## What I did meanwhile

Moved the form-to-text code out of kb.ts into kit/lib/budgets/measure.ts as formShowText, and made kb.ts import it; kb show's output is unchanged (kit/bin/kb.test.ts green). Keeping a copy was refused by the repository's duplication gate.

## What it costs to change later

A constant: moving formShowText to kit/lib/playbook/ later is one file move and two import lines; no stored shape or public command changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether kit/lib/playbook/ is the better home for formShowText: it was outside the territory too, so the function stayed beside the measure.

```

<!-- /omni-outbox-settled: s1-01-kb-show-shares-the-measure-text -->

<!-- omni-outbox-settled: s2-01-store-lists-settled-entries -->

## s2-01-store-lists-settled-entries — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-store-lists-settled-entries
prd: 1679
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

To know whether a person said yes to a bigger budget, the size check must read the answered questions of a PRD. Should the place that keeps those answers learn to list them all, even though that place was not part of this slice?

## The decision, in plain words

The place that keeps a PRD's answered questions can now list every one of them, whichever home the PRD's questions live in. Nothing it did before changes.

## The intro, for fun

The check had to ask who said yes, and the ledger only knew how to whisper.

## The punchline, for fun

Now it reads the whole page out loud, for everyone.

## The options, in plain words

A. A. Teach the place that keeps the answers to list them all, and let the size check ask it (built).
B. B. Let the size check read the answer ledger itself, which only works where the answers live in the repository.
C. C. Guess the answered questions from the ones no longer open, which cannot tell a yes from a no.

## What I had to decide

Whether to add a settledEntries(prd) method to OutboxStore (kit/lib/outbox/store.ts, git-store.ts, server-store.ts and the store contract test), all outside s2's territory, so omni check context reads settled raise items through the store as the spec asks.

## What I did meanwhile

Added settledEntries(prd) to the OutboxStore type and both stores: the git store parses settled.md (latest entry per id), the server store maps every settled row; adoptedEntries in the server store now reuses the same row mapping. The store contract test covers it for both stores, an open item left out.

## What it costs to change later

A constant: removing or renaming one additive method and its two implementations; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the live server's settled rows carry the item body with the raise line verbatim, as the git ledger and the fake routes do: the live server was not checked.

```

<!-- /omni-outbox-settled: s2-01-store-lists-settled-entries -->

<!-- omni-outbox-settled: s2-02-how-a-raise-is-matched -->

## s2-02-how-a-raise-is-matched — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-how-a-raise-is-matched
prd: 1679
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When a person says yes to a bigger budget, the check has to tell which budget and which new size the yes was for. How should the question carry that, and what counts as a yes?

## The decision, in plain words

A raise question carries one fixed line naming the budget and its new size, and only an answer that agrees with the question counts as a yes. A first budget set where none existed before needs no yes.

## The intro, for fun

A yes is only useful when everyone knows what it was a yes to.

## The punchline, for fun

So the question now spells out the exact number it asks for.

## The options, in plain words

A. A. One fixed line in the question names the budget and the size, and only an agreeing answer counts (built).
B. B. The question's short name carries the budget and the size, which leaves no room for a long budget name.
C. C. Any answered question of the PRD about budgets counts, whatever size it named.

## What I had to decide

How ratchet matches a settled raise item to a target and a ceiling, which PRD a branch's raises are read from, and what counts as raised against the base. The spec says the item names the target and the new ceiling, not in what form.

## What I did meanwhile

A raise item carries the line `Budget raise: `<target>` to <bytes> bytes` (raiseLine in kit/lib/budgets/ratchet.ts, matched case-insensitively anywhere in the item); only a settled entry whose verdict is agreed counts, never adopted or drifted. omni check context reads the PRD from --prd, else from the branch name (prdOfBranch). A base with no ceilings file is an install, so its first ceilings raise nothing (D8); a target with no ceiling at the base or the head is green; removing a ceiling the base had needs a yes no item can give.

## What it costs to change later

A constant: the raise line's wording is one regex and one function; ceilings already merged never need to be matched again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a removed ceiling should be red with no way to answer it, or green: the spec's table does not name it.

```

<!-- /omni-outbox-settled: s2-02-how-a-raise-is-matched -->
