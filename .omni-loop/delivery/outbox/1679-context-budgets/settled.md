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

<!-- omni-outbox-settled: s3-01-route-test-outside-territory -->

## s3-01-route-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-route-test-outside-territory
prd: 1679
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

Adding the new budgets check to the App changes how many background jobs it serves, and a test outside this slice's area counts them. Should this slice have updated that test?

## The decision, in plain words

I updated the count in that test so it names the new budgets check, and changed nothing else in it.

## The intro, for fun

One new job joined the App, and the head count noticed.

## The punchline, for fun

The roll call now has one more name on it.

## The options, in plain words

A. A. Keep the edit: the route test names the budgets check and counts 9 functions and 14 registrations.
B. B. Move the edit into a follow-up change owned by whoever owns the outbox check's folder.

## What I had to decide

Whether a slice that adds an App function may touch the test that lists every function, though it sits outside its declared area.

## What I did meanwhile

The test lists the budgets check among the functions the App serves; every other line of it is unchanged.

## What it costs to change later

Undoing it is reverting four lines of one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan did not list the route test in s3's territory, though adding a function in functions.ts always changes it

```

<!-- /omni-outbox-settled: s3-01-route-test-outside-territory -->

<!-- omni-outbox-settled: s3-02-budgets-on-read-from-base -->

## s3-02-budgets-on-read-from-base — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-budgets-on-read-from-base
prd: 1679
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The budgets check reads whether budgets are on from the branch a pull request goes into, so the pull request that first turns budgets on gets no budgets check until it merges. Is that right?

## The decision, in plain words

The check reads whether budgets are on from the branch the pull request goes into, like the App's other checks, and measures everything else at the pull request's head.

## The intro, for fun

A switch flipped in a pull request only counts once it lands.

## The punchline, for fun

The guard starts its shift the day after it is hired.

## The options, in plain words

A. A. Read the switch from the base branch, as the outbox and approved checks read their settings.
B. B. Read the switch from the head, so the pull request that turns budgets on is checked at once.

## What I had to decide

Whether turning budgets on should take effect on the very pull request that turns it on, or only after it merges.

## What I did meanwhile

A pull request that turns budgets on, such as this repository's own, gets no omni / budgets check; every pull request after it does. Measuring, ceilings and paths are read at the head.

## What it costs to change later

Switching to the head's setting is a one-line change in the check's first step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the App's checks also run only on pull requests into the default branch, so a sub-PR into a feature branch gets no omni / budgets either; omni check context covers it locally

```

<!-- /omni-outbox-settled: s3-02-budgets-on-read-from-base -->

<!-- omni-outbox-settled: s4-01-ci-form-budgets-slot -->

## s4-01-ci-form-budgets-slot — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-ci-form-budgets-slot
prd: 1679
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The plan asks for a Budgets section in the CI page of the playbook, but the kit only accepts the sections it has on its list of sections for that page. Should this slice add Budgets to that list, outside the files it was given?

## The decision, in plain words

I added Budgets as an optional section of the CI page in the kit's list of sections, with its test and the notes that record how the kit's pages differ from where they came from. Without it, the new section would fail the kit's own checks.

## The intro, for fun

A new shelf was ordered for the CI page, but the cupboard only had four slots.

## The punchline, for fun

So the cupboard got a fifth slot, and a note saying who drilled it.

## The options, in plain words

A. Keep the optional budgets slot in the kit's list, with its test and porting notes (as built).
B. Drop the slot and the template section, and keep the budget guidance in the skills only.

## What I had to decide

Agree to keep the optional `budgets` slot of the ci form (kit/lib/playbook/forms.ts, its forms.test.ts line) and the two porting notes (kit/porting/templates--ci.md, kit/porting/plugin--do-work.md), changed outside s4's territory; or say the section should live elsewhere.

## What I did meanwhile

The ci form has an optional budgets slot; a repository whose ci form lacks it shows the kit default, a short paragraph on budgets.

## What it costs to change later

Undoing it is removing one optional slot and the template section; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s4 did not list kit/lib/playbook/forms.ts, which declares each form's slots; the template test refuses a section the list does not hold, so the done-when could not be met without it.
- (author) Slice s5 fills this repository's own Budgets section in the ci form and needs this slot to pass omni check kb; it lands in the same wave.
- (author) Every repository whose ci form has no Budgets section now prints the kit default in omni kb show ci, about 600 bytes more, so form:ci measures a little larger than before this slice.

```

<!-- /omni-outbox-settled: s4-01-ci-form-budgets-slot -->

<!-- omni-outbox-settled: s4-02-skill-tests-beside-law-proofs -->

## s4-02-skill-tests-beside-law-proofs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-skill-tests-beside-law-proofs
prd: 1679
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

This slice added its tests to the file that also proves four product rules, leaving those rule tests untouched. Do you agree that no product rule changed here?

## The decision, in plain words

I added the new tests at the end of the file the plan named, leaving the product rule tests as they were. The kit's guard treats any change to that file as touching a rule, so it needs a person to confirm.

## The intro, for fun

The new tests moved into a building where the rule keepers live.

## The punchline, for fun

They knocked on no doors, but the guard still wants a signature.

## The options, in plain words

A. Keep the new tests in the file the plan named, since no rule changed (as built).
B. Move the new tests to a file of their own, so the rule tests' file stays untouched.

## What I had to decide

Agree that kit/test/plugin.test.ts changes no law proof (BR-PRODUCT-3, -4, -10 and -11 are untouched; the diff only adds the block "the context budget in the skills (PRD 1679)" and one import), or ask for the tests to move to a file of their own such as kit/test/budget-skills.test.ts.
Decided by: Jev (hardToRevert 0.74) · agent said true

## What I did meanwhile

The new tests sit at the end of kit/test/plugin.test.ts, as the plan's territory names it.

## What it costs to change later

Moving the block to its own file later is a cut and paste with no behaviour change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) omni check coverage refuses a spec account for a law-proof file: only a high item accounts for it, whatever the change. Every later PRD that adds a skill test to kit/test/plugin.test.ts will meet the same refusal; the guard may want to tell an added test from a changed law test.

```

<!-- /omni-outbox-settled: s4-02-skill-tests-beside-law-proofs -->

<!-- omni-outbox-settled: s5-01-ceilings-sized-for-what-lands-next -->

## s5-01-ceilings-sized-for-what-lands-next — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-ceilings-sized-for-what-lands-next
prd: 1679
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

Three of this repository's first reading limits were set a little above what the branch measures today, so they stay green once the main branch and the sibling slice that adds the CI page's Budgets heading are merged in. Is that the right way to start, or should every limit match today's size exactly?

## The decision, in plain words

The limits for the CI page, the root agent instructions and the whole session start were sized for what the branch will hold after those merges, rounded up to the next kilobyte. Every other limit is today's size rounded up.

## The intro, for fun

A limit set to today's size can turn red tomorrow, the moment someone merges what was already written.

## The punchline, for fun

So three of them got a coat one size up, still well under the guideline.

## The options, in plain words

A. A. Size the CI page, root agent instructions and session limits for what lands next: 8 KiB, 7 KiB and 9 KiB (as built).
B. B. Every limit at today's branch size only: the CI page at 7 KiB, the session at 3 KiB, and no limit for the root agent instructions until they are measured here.

## What I had to decide

Answer A to keep the limits as built. Answer B to cut them to today's sizes; the next merge of the main branch then trims or lowers them in the same change.

## What I did meanwhile

The check is green on the branch and stays green after the main branch and the sibling slice are merged in.

## What it costs to change later

Changing it is editing three numbers in one file; nothing is migrated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the session and root-instructions limits read the main branch's agent instructions file as it is today (6,271 bytes); a later change to that file on main is measured against them
- (author) the CI page's limit (8 KiB) assumes the sibling slice names its new template section `budgets`, as this slice's form does

```

<!-- /omni-outbox-settled: s5-01-ceilings-sized-for-what-lands-next -->
