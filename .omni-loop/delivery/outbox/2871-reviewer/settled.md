# Settled outbox items — PRD 2871

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-tests-outside-territory -->

## s1-01-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-tests-outside-territory
prd: 2871
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

The new review section and the new review command changed what a few existing checks expect, and those checks sit outside the files this step was given. Should this step update them, or leave them for another step?

## The decision, in plain words

This step updated them itself: three checks now expect the fourth section, and the help list gained the new command's entry and its count, so every check stays green.

## The intro, for fun

One new section, and five old checks all asked to be told.

## The punchline, for fun

They were told, line by line, and nobody else was woken up.

## The options, in plain words

A. A. s1 updates the five expectations and the command's help entry itself (built).
B. B. s1 leaves them, and the preflight stays red until s2 adds the help entry and someone updates the three test files.

## What I had to decide

The plan gave s1 the review form and the `omni review` command, but adding a slot to the review form changes the expected slot lists in kit/lib/playbook/forms.test.ts, kit/lib/omni-settings/curated.test.ts and kit/lib/omni-settings/copy.test.ts, and registering a command requires a help entry in kit/lib/help/entries.ts (the guard in kit/lib/help/entries.test.ts counts commands). None of those paths is in s1's territory; entries.ts is s2's. Without the edits the preflight is red.

Decided by: Jev (hardToRevert 0.60) · agent said false

## What I did meanwhile

Updated the expected lists in the three test files to include look-for (one line each), added a command entry for review in kit/lib/help/entries.ts after care, and moved the command count in entries.test.ts from 69 to 70. s2, blocked by s1, adds the skill entry for /omni:review on top.

## What it costs to change later

Nothing to undo but these lines: reverting them means moving the slot or the command elsewhere. s2 starts after s1 merges, so the shared entries.ts file never conflicts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant s2 to own the command's help entry as well as the skill's: it names entries.ts as s2's for the new skill's entry only.

```

<!-- /omni-outbox-settled: s1-01-tests-outside-territory -->

<!-- omni-outbox-settled: s1-02-look-for-extends-default -->

## s1-02-look-for-extends-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-look-for-extends-default
prd: 2871
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

A repository may add its own things for the Reviewer to look for, and must never drop the kit's six. Where should the full list, the six plus the additions, be read from?

## The decision, in plain words

A new command prints the full list: the six first, then each item the repository adds, a repeat of one of the six dropped. The page that prints the playbook still shows the repository's own section in place of the six, as it does for every other section.

## The intro, for fun

Six things to look for, and every repository wants a seventh.

## The punchline, for fun

The seventh joins the line, and the six keep their place.

## The options, in plain words

A. A. A new review command prints the full list, and the playbook page shows the repository's section as written (built).
B. B. The playbook page itself prints the six, then the repository's additions, for this one section.

## What I had to decide

The spec says a repository's look-for section adds to the kit default and never removes from it, while `omni kb show` resolves every section by replacing the kit default with the repository's text (kit/lib/playbook/resolve.ts, outside s1's territory). s1 added `omni review look-for`, backed by kit/lib/review/look-for.ts: the kit default's list items, then the list items of the section the repository resolves to, a repeat dropped; prose around the items adds nothing. The curated settings page's look-for is prose naming the six, so it adds nothing. s2's skill should read `omni review look-for`.

Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

Built `omni review look-for` and left `omni kb show review` printing the repository's section in place of the default, labelled as every section is.

## What it costs to change later

A constant: making kb show merge the two instead is a change to the resolver for one slot, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person reading `omni kb show review` expects to see the six beside the repository's additions.

```

<!-- /omni-outbox-settled: s1-02-look-for-extends-default -->

<!-- omni-outbox-settled: s3-01-reviewer-old-words-tests -->

## s3-01-reviewer-old-words-tests — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-reviewer-old-words-tests
prd: 2871
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

Giving the Reviewer its skill broke five older checks outside this slice's ground, which still expected a Reviewer with nothing to do. Should this slice have updated them?

## The decision, in plain words

Yes: the five checks now expect what the spec asks, the Reviewer working alone with its review. Only what they expect of the Reviewer changed; nothing else in them moved.

## The intro, for fun

The Reviewer got a job, and five old notes still said it was unemployed.

## The punchline, for fun

We updated its file before anyone called it a ghost hire.

## The options, in plain words

A. Keep the five updated expectations in this slice (built).
B. Move the five changes to a slice of their own, the feature staying red until it merges.

## What I had to decide

Keep the five updated checks (A), or have the wave hand them to a slice whose ground holds them (B).

## What I did meanwhile

The checks expect the new Reviewer, so the whole test run stays green with the new defaults.

## What it costs to change later

Undoing it is a revert of five test expectations, a line or two each; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this slice named none of the five files: the Virtual Fleet drawer test, its render test, the Heroes tab's row test, the fleets database check, and the Operation room test, whose person-held seat is now a PM since the Reviewer works alone (that file is the ground of a later slice, s6, cut after this one merges) (author).

```

<!-- /omni-outbox-settled: s3-01-reviewer-old-words-tests -->

<!-- omni-outbox-settled: s3-03-reviewer-hand-off-lines -->

## s3-03-reviewer-hand-off-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-reviewer-hand-off-lines
prd: 2871
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

The spec names the two new endings, waiting for the Reviewer and changes asked, but not the last line a job prints for each. Which lines should the runner read?

## The decision, in plain words

The same rule as the other build endings: a job ends on the next command to run. A PR left for the Reviewer ends on the Reviewer's command, and changes asked end on the fix's command sent for review; a pass the Reviewer marked ready ends on the usual care command.

## The intro, for fun

Every job leaves a sticky note on the fridge saying who cooks next.

## The punchline, for fun

The Reviewer's notes now use the same fridge.

## The options, in plain words

A. The next command to run, as the other build endings do (built).
B. An Outcome word line of its own for each ending, as a bug fix prints.

## What I had to decide

Keep the next-command lines (A), or give the two endings an Outcome word line of their own, as a bug fix does (B).

## What I did meanwhile

The two later slices that write the Reviewer's skill and the build sent for review end on these lines: `/omni:review <n>` reads review; `/omni:yolo-fix <n> --for-review` and `/omni:ultra-yolo-fix <n> --for-review` read changes; `/omni:pr-care <n>` reads ready.

## What it costs to change later

Changing them later is a change to one table of the runner and the lines two skills print; no stored data holds the lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- In round 2 the Reviewer's changes still print the fix's command, though the mission then waits on a person instead of sending it: the line is what a person would run to settle the findings (author).

```

<!-- /omni-outbox-settled: s3-03-reviewer-hand-off-lines -->

<!-- omni-outbox-settled: s1-03-review-form-budget -->

## s1-03-review-form-budget — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-14T20:31:05Z
- Channel: feature pull request #2872
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2872#issuecomment-6883775277
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
1: A
```

### The item, as it was raised

```text
---
id: s1-03-review-form-budget
prd: 2871
slice: s1
rank: high
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

The review page every agent may read grew from about one kilobyte to about two, because it now lists the six things the Reviewer looks for. May its size limit go up to two kilobytes?

## The decision, in plain words

This step raised the limit to two kilobytes, since the six items cannot fit in the seventy bytes left under the old limit without losing what each one asks for.

## The intro, for fun

The review page packed six new things to look for and outgrew its suitcase.

## The punchline, for fun

A bigger suitcase is on order, pending one person's signature.

## The options, in plain words

A. A. Raise the review page's limit to two kilobytes, the six items kept on it (built).
B. B. Keep the one-kilobyte limit, and cut the six items from the page down to a single line that points to the review command.

## What I had to decide

The context budget measures what `omni kb show review` prints: 955 bytes before this slice against a 1024-byte ceiling. The spec asks the kit default of the review form's new look-for section to hold six items in order of harm, each with what it covers; printed, that section is 981 bytes, bringing the form to 1936 bytes. Trimming cannot fit it: the heading alone takes 27 of the 69 bytes left, and the fix, push-back and ask sections are not this slice's to cut. So the ceiling of form:review in .omni-loop/budgets/context.json went from 1024 to 2048 bytes, the measured size rounded up to the next KiB.

Budget raise: `form:review` to 2048 bytes

## What I did meanwhile

Raised the ceiling in the same commit as this item; check context stays red until a person answers.

## What it costs to change later

A constant: putting the ceiling back is one number, and then the look-for default must shrink to a pointer or leave the form.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the look-for list would rather live only behind the review command, out of the page every agent reads, which the spec does not allow as written.

```

<!-- /omni-outbox-settled: s1-03-review-form-budget -->

<!-- omni-outbox-settled: s3-02-review-not-runnable-yet -->

## s3-02-review-not-runnable-yet — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-11-14T20:31:05Z
- Channel: feature pull request #2872
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2872#issuecomment-6883775277
- Basis: stated — the answer is settled as "drifted" because a human said so, not because a comparison read it
- Closed: no — the build and the decision disagree until a rework sub-PR brings them back in line (/omni:yolo-fix)
- Rank: high
- Bears on: BR-PRODUCT-139
- Raised: 2026-11-14
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
4: A
```

### The item, as it was raised

```text
---
id: s3-02-review-not-runnable-yet
prd: 2871
slice: s3
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-14
wave: 1
---

## The question, in plain words

A runner still refuses to run the Reviewer's job, and the Omni page still refuses a job that reports the two new endings, because the lists that allow them live outside every slice's ground. Who adds the Reviewer's job and its two endings to those lists before the feature goes ready?

## The decision, in plain words

This slice taught the runner to read the two endings and left the lists alone, so the whole test run stays green. Until a slice adds them, a mission that sends the Reviewer's job would see it refused.

## The intro, for fun

The Reviewer has a desk, a badge and a job title, but the front door still says staff only.

## The punchline, for fun

Someone has to put its name on the list before it can clock in.

## The options, in plain words

A. A slice before ready adds the Reviewer's job and its two endings to the runner's list, the Omni page's lists and the guide (recommended).
B. The supervisor slice widens its ground to take the same change.
C. Ship as built: the Reviewer's job is refused until a later PRD adds it.

## What I had to decide

Add a slice before ready (A, recommended) whose ground holds the runner's list of skills it runs, the Omni page's copy of that list and of the endings it accepts, and the guide's runner page; or fold the change into the supervisor slice (B); or ship without it (C).

## What I did meanwhile

Nothing sends the Reviewer's job yet: the supervisor that sends it is a later slice. A runner reads the two endings already, and when the page refuses a report for its ending the runner sends it again without the ending, so a job still ends done.

## What it costs to change later

Without the lists, the first mission that hands a PR to the Reviewer sees that job refused, and a mission never sends a failed PRD again, so each such PRD waits for a person to take it to ready by hand.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives no slice the runner's list of skills it runs, the Omni page's list of runner skills, its report's list of endings or the guide's runner page (author).
- Adding the Reviewer's skill to the runner's list alone turns the page's own tests red, since they hold the two lists equal (author).

```

<!-- /omni-outbox-settled: s3-02-review-not-runnable-yet -->
