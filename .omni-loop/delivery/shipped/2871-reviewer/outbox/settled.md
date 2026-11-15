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
- Closed: yes — reworked by #2890, the sub-pull request that brought the build back in line
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

<!-- omni-outbox-settled: s2-01-docs-skills-test-outside-territory -->

## s2-01-docs-skills-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-docs-skills-test-outside-territory
prd: 2871
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Adding the Reviewer's skill to the help list also changes the skills page of the docs, whose check sits outside the files this step was given. Should this step update that check, or leave it to another step?

## The decision, in plain words

This step updated it itself: the docs check now expects the Reviewer's skill in the Build it group, right after the one that looks after a feature pull request. Nothing else in the check moved.

## The intro, for fun

One new skill joined the help list, and the docs page wanted a seat for it too.

## The punchline, for fun

We set one more chair at the table and left the rest of the room alone.

## The options, in plain words

A. This step updates the one expected list in the docs check itself (built).
B. This step leaves it, and the whole test run stays red until another step updates the check.

## What I had to decide

The plan gives s2 `kit/lib/help/entries.ts` for the new skill's help entry. The docs' skills pages are built from that table, and `apps/galaxy/src/docs/skills.test.ts` lists the Build it group's skills exactly, so a skill in that group turns it red. The path is in no slice's territory. I added `review` after `pr-care` in that one expected list, the same precedent as s1-01 and s3-01.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Updated the one expected list, so the whole test run stays green.

## What it costs to change later

Nothing to undo but one word in one test: putting the skill in another group moves that word.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the docs check to be s2's along with the help entry it is built from.

```

<!-- /omni-outbox-settled: s2-01-docs-skills-test-outside-territory -->

<!-- omni-outbox-settled: s2-02-reviewer-one-repository -->

## s2-02-reviewer-one-repository — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-reviewer-one-repository
prd: 2871
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The spec says a feature built across several repositories gets its fix through the multi-repository fix, but not how the Reviewer reviews such a feature, whose code lives in other repositories. Should the Reviewer review those now, or stop on them for now?

## The decision, in plain words

For now the Reviewer reviews one repository's feature pull request and stops, saying why, on a feature that spans repositories. Under a mission that feature is then held for a person, as any stopped job is.

## The intro, for fun

The Reviewer got one pull request to read, and some features come in a box of five.

## The punchline, for fun

It reads the one it was handed and says plainly it does not open the box.

## The options, in plain words

A. Review one repository's feature pull request, and stop on a feature that spans repositories (built).
B. Review every target repository's feature pull request too, one review each, passing only when every one passes, and hand findings to the multi-repository fix.

## What I had to decide

Spec section 2's table names `/omni:ultra-yolo-fix` as the fix for a multi-repository PRD, but section 1 describes reviewing one feature PR, and the plan's s2 done-when names no target repository. A multi-repository PRD's code is on its targets' feature PRs, not the plan repository's. `/omni:review` stops with `review: PRD <n> spans repositories: …` when `omni prd <n>` prints a `repos:` line; a mission reads that as stopped, sends it once more, then stops the PRD with why (BR-PRODUCT-139).

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

The skill stops in one line on a `repos:` PRD, before any read of GitHub or any review is posted.

## What it costs to change later

A constant: option B adds a section to the skill (each target's PR through `omni review post --repo`, already there) and changes no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether missions build multi-repository PRDs today, and so whether option B is needed before this PRD ships.

```

<!-- /omni-outbox-settled: s2-02-reviewer-one-repository -->

<!-- omni-outbox-settled: s2-03-pass-red-ci-goes-to-care -->

## s2-03-pass-red-ci-goes-to-care — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-pass-red-ci-goes-to-care
prd: 2871
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

After the Reviewer marks a pull request ready, the spec has it follow the pull request until its checks are green or stuck, which can mean fixing a red check, while the spec also says the Reviewer writes no code. Which one wins?

## The decision, in plain words

The Reviewer writes no code: it marks the pull request ready, waits for its checks to finish, and hands a red check to the skill that looks after the pull request. A pass it cannot take to ready, because nothing shipped or questions are still open, is posted and ends as a stop, saying why.

## The intro, for fun

The Reviewer was asked to grade the homework and, maybe, also fix it.

## The punchline, for fun

It kept the red pen and passed the eraser along.

## The options, in plain words

A. The Reviewer fixes nothing: a red check after ready goes to the care skill, and a pass it cannot mark ready ends as a stop (built).
B. The Reviewer fixes a red check after ready itself, as the pull request skill's lifecycle does, writing code for that alone.

## What I had to decide

Spec section 1, On pass: "then `/omni:pr`'s lifecycle until CI is green or stuck"; acceptance: "it never approves or requests changes, and writes no code". `/omni:pr`'s lifecycle fixes a red check. The skill watches the checks as that lifecycle does and fixes none; green or red it ends on `/omni:pr-care <n>` (the runner reads `ready`), checks that never finish end `review: CI never settled on PR #<pr>` (stopped). A pass with the PRD not shipped or the gate red posts the review, marks nothing and ends `review: passed PR #<pr>, not marked ready: …`, which a mission reads as stopped.

Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Built as option A in step 6 of the skill.

## What it costs to change later

A constant: option B is a few lines of the skill and changes no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a mission should read a pass that could not be marked ready as stopped, or as its own ending.

```

<!-- /omni-outbox-settled: s2-03-pass-red-ci-goes-to-care -->

<!-- omni-outbox-settled: s2-04-round-two-reasons-in-the-review -->

## s2-04-round-two-reasons-in-the-review — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-round-two-reasons-in-the-review
prd: 2871
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

In its second round the Reviewer settles each point it raised in the first, and must give its reason once. Where should that reason go, so a settled point is not handed to the product manager by mistake?

## The decision, in plain words

A point the Reviewer accepts as settled gets its reason in the second review's summary, not as a reply on its thread. A point it keeps is raised again in the second review, on the same line, saying why the answer did not settle it, and then a person decides.

## The intro, for fun

Round two: the Reviewer checks every answer it got to its first notes.

## The punchline, for fun

It nods in one place, and repeats itself only where it must.

## The options, in plain words

A. Settled points get their reason in the second review's summary, and kept points are raised again in the second review (built).
B. The Reviewer replies on each first-round thread with its reason, which hands every one of them, settled or not, to the product manager.

## What I had to decide

`omni care state` reads any comment after a care reply as a person's and lists the thread for the PM (`mark-asked`), even a resolved one (`kit/lib/care/state.ts`, `repliedThread`). So a Reviewer reply on a thread it accepts would send a settled thread to the PM. The verdict schema of s1 gives round 2 one `summary` line (500 characters at most) and 1 to 5 findings: resolved reasons go in the summary, and a kept finding is a round-2 finding on its round-1 line, its problem opening `Kept from round 1:`. A still-open thread the Reviewer accepts is resolved through GraphQL; it is the Reviewer's own thread, never a person's.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Built as option A in step 4 of the skill.

## What it costs to change later

A constant: replying on threads instead is a change to step 4 of the skill and to how care state reads a reply, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether five resolved reasons fit the summary's 500 characters on a busy round, or the schema should give round 2 a field of its own.

```

<!-- /omni-outbox-settled: s2-04-round-two-reasons-in-the-review -->

<!-- omni-outbox-settled: s5-01-reviewer-sent-again-same-step -->

## s5-01-reviewer-sent-again-same-step — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: BR-PRODUCT-139
- Raised: 2026-11-14
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-reviewer-sent-again-same-step
prd: 2871
slice: s5
rank: medium
bears-on: BR-PRODUCT-139
raised: 2026-11-14
wave: 2
---

## The question, in plain words

When the Reviewer, or the fix after it, stops half-way, the mission sends it again once. Should it send that same step again, or start the whole PRD over from the build?

## The decision, in plain words

The mission sends that same step again, once, and a second stop anywhere stops the PRD, as before. Only the build waits on the approval: the Reviewer and the fix after it never do.

## The intro, for fun

The Reviewer tripped on the stairs halfway through its reading.

## The punchline, for fun

It gets one more go at the same page, not a fresh copy of the whole book.

## The options, in plain words

A. A. Send the same step again once, under run 2; steps after the build skip the approval check (built).
B. B. Send the build again as run 2, which hands over to the Reviewer's round 1 again.
C. C. Send the same step again, but hold it until the approval stands again.

## What I had to decide

Keep the same step sent again (A), or send the build again and let it hand over to the Reviewer as before (B).

Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

A stopped Reviewer or fix is sent again under the next run's key for the same step (run 2, round 1 or the fix); its round count never grows past two. The approval and blocker checks still hold the first build and a build sent again.

## What it costs to change later

A change to one function of the supervisor and its tests: the keys already allow both shapes, and no stored row depends on which one is used.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a stopped Reviewer follows the existing row, sent again once, without saying whether the build or the Reviewer goes again.
- (author) Whether shipping a PRD voids its approval on the page, which would hold every step after the build if they still waited on it.

```

<!-- /omni-outbox-settled: s5-01-reviewer-sent-again-same-step -->

<!-- omni-outbox-settled: s5-02-findings-count-from-job-log -->

## s5-02-findings-count-from-job-log — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-findings-count-from-job-log
prd: 2871
slice: s5
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Each verdict on the Operation room says how many findings the Reviewer raised and links its review, but the mission's database keeps neither. Where should the mission read them from?

## The decision, in plain words

The mission reads the one line the Reviewer prints when it posts its review, from the end of that job's log, and keeps only the count and the link. When that line is missing, the row says changes were asked without a count and links the pull request.

## The intro, for fun

The Reviewer wrote its score on the back of a receipt.

## The punchline, for fun

The mission copies the number and the link, and throws the receipt away.

## The options, in plain words

A. A. Read the count and the review's link from the Reviewer job's posted line, nothing else of the log (built).
B. B. The runner stores the count and the review's link on the job, and the mission reads those.
C. C. Leave the count out of the sentence, and link the pull request only.

## What I had to decide

Keep reading the posted line from the job's log (A), or have the runner store the count and the review's link on the job itself (B).

## What I did meanwhile

The store reads the log tail of each Reviewer job that ended on a verdict, and `postedOf` keeps the count of findings and a GitHub review link from the last `omni review post` line; nothing else of the log is kept or written to an event. Without the line, the sentence reads `Changes asked, round 1/2.` and the link is the job's PR.

## What it costs to change later

Moving to a stored count is a column on runner jobs, a runner change and a two-line change in the store; nothing stored depends on the log reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives the sentences with a count, but no slice stores the count where the mission reads.
- (author) Whether the posted line stays in the last 200 lines of the log when the Reviewer then follows its pull request's checks after a pass; a pass's sentence carries no count, so only its link would be lost.

```

<!-- /omni-outbox-settled: s5-02-findings-count-from-job-log -->

<!-- omni-outbox-settled: s5-03-fix-always-one-repository -->

## s5-03-fix-always-one-repository — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-fix-always-one-repository
prd: 2871
slice: s5
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The spec says a PRD built across several repositories gets the multi-repository fix after the Reviewer's first round. A mission only knows its one repository, so how should it tell such a PRD apart?

## The decision, in plain words

The mission always sends the one-repository fix: it reads nothing that says a PRD spans several repositories, and the runner does not run the multi-repository fix yet.

## The intro, for fun

The recipe says use the big pot for a party, but the kitchen only has the one.

## The punchline, for fun

Tonight we cook for one, and the big pot waits for its own order.

## The options, in plain words

A. A. Always send the one-repository fix sent for review (built).
B. B. Read the PRD's repositories, and send the multi-repository fix for a PRD that holds more than one.

## What I had to decide

Keep sending the one-repository fix (A), or teach the mission to read a PRD's repositories and send the multi-repository fix for those (B).

Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

`lineOf` sends `/omni:yolo-fix <n> --for-review` for every fix; a mission is of one repository (`missions.repo`), and its facts carry no list of the repositories a PRD holds.

## What it costs to change later

One branch in `lineOf` and one fact more for the store to read, once a PRD's repositories are on the page and the runner runs the multi-repository fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a mission is ever meant to hold a PRD of a plan repository, whose fix spans several repositories.
- (author) The runner's list of skills it runs holds neither the Reviewer's skill nor the multi-repository fix today.

```

<!-- /omni-outbox-settled: s5-03-fix-always-one-repository -->

<!-- omni-outbox-settled: s5-04-room-dispatch-words-long -->

## s5-04-room-dispatch-words-long — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-room-dispatch-words-long
prd: 2871
slice: s5
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The approved drawing of the Operation room shows each sent job in seven words or fewer, while the room today also says which runners took it. Should the mission drop where a job went, to fit the drawing?

## The decision, in plain words

The mission keeps saying where each job went, as it did before this PRD, so its sent rows run to about eleven words. The wait on a person keeps the spec's own words too.

## The intro, for fun

The drawing gave each row a tiny coat; the old row kept its long scarf.

## The punchline, for fun

It still fits through the door, just with a little more fabric.

## The options, in plain words

A. A. Keep where each job went in its row (built).
B. B. Drop where it went, as the drawing shows, and leave it to the job's own page.

## What I had to decide

Keep where each job went in its row (A), or drop it to match the drawing, leaving it to the job's own page (B).

## What I did meanwhile

Dispatch rows read `Sent /omni:yolo 2817 --for-review to the night-shift fleet's runners (run 1).` and `Sent /omni:review 2817 to … (run 1, round 1).`; the word pass flags each as explains-at-rest (11 or 12 words). The wait row reads `Waits on a person: PRD 2817: decide the Reviewer's findings on PR #2817` (13 words), its prefix PRD 2842's and the rest the spec's. The Engineer's and the Reviewer's new rows match the drawing: `Shipped; waits for review.`, `Changes asked: 2 findings, round 1/2.`, `Fixed 2 findings; shipped again.`, `Passed, round 2 of 2: marked ready.`

## What it costs to change later

A change of one sentence and the tests that read it; the rows already written keep their words.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the drawing dropped where a job went on purpose, or only to fit the frame.
- (author) The wait row's words are the spec's, after PRD 2842's `Waits on a person:` prefix; shortening them is the Operation room's call as much as this slice's.

```

<!-- /omni-outbox-settled: s5-04-room-dispatch-words-long -->

<!-- omni-outbox-settled: s5-05-mission-rule-proof-lines -->

## s5-05-mission-rule-proof-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: BR-PRODUCT-139
- Raised: 2026-11-14
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-05-mission-rule-proof-lines
prd: 2871
slice: s5
rank: medium
bears-on: BR-PRODUCT-139
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Two tests prove the rule that a mission never sends a PRD again once it failed, was held twice or was cancelled. They now expect each build to be sent for review: may they change that way?

## The decision, in plain words

The two tests keep every check they made and now expect the build sent for review, with each job knowing its step. The Reviewer's own tests went to new files beside them.

## The intro, for fun

The rule's two witnesses had to learn a longer name for the same build.

## The punchline, for fun

Same story, same verdict, one more word on the badge.

## The options, in plain words

A. A. Accept the two proofs, each build now sent for review (built).
B. B. Keep the proofs as they were, and send the build for review only under a mission's Reviewer, a second line beside the old one.

## What I had to decide

Accept the two proofs as changed (A), or ask for them back as they were, the build line kept as before outside a mission's review (B).

Decided by: Jev (hardToRevert 0.50) · agent said true

## What I did meanwhile

In `supervisor.test.ts` the run helper sets `step: 'build'`, `runOfKey` reads back `step: 'build'`, and two dispatch sentences read `Sent /omni:yolo 1 --for-review …`; in `mission.e2e.test.ts` six expected lines gain ` --for-review`. No assertion was removed or loosened. The Reviewer's tests are in `supervisor.reviewer.test.ts` and `mission.reviewer.e2e.test.ts`.

## What it costs to change later

Putting the line back is one function and the same eight expected lines; the rule itself, and what its tests check, does not move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The rule is proposed and nobody has confirmed it yet, so who answers for its proof is the PRD's owner.

```

<!-- /omni-outbox-settled: s5-05-mission-rule-proof-lines -->

<!-- omni-outbox-settled: s3-04-rule-proof-tests-changed -->

## s3-04-rule-proof-tests-changed — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-15T06:58:48Z
- Channel: feature pull request #2872
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2872#issuecomment-6890760973
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-11-15
- Slice: s3
- Wave: 2
- Stays here: an approval of this PRD's test changes; the rules themselves stay proposed until confirmed on Omni

### The answer, as it was given

```text
A. A. Accept the five changed checks as built (extended to cover the review step).
```

### The item, as it was raised

```text
---
id: s3-04-rule-proof-tests-changed
prd: 2871
slice: s3
rank: high
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Five existing checks that prove the product's rules for missions, the runner and virtual fleets were changed so they also expect the new review step. Do you accept these changes to the rule checks?

## The decision, in plain words

The checks were extended, not loosened: each old expectation still holds, and the new review endings, the new mission event and the Reviewer's skills are now checked too. Builds are now sent with the review flag, so the expected lines say so.

## The intro, for fun

Five rule checks learned a new word overnight: review.

## The punchline, for fun

Nobody forgot the old words; they just stopped being the only ones.

## The options, in plain words

A. A. Accept the five changed checks as built (extended to cover the review step).
B. B. Undo them, and rework the review step so the old checks pass unchanged.

## What I had to decide

Accept or undo the changes to the five rule-proof checks: kit/lib/runner/runner.test.ts (N-PRODUCT-19, +24 lines, nothing removed), supabase/checks/missions.sql (BR-PRODUCT-137/138: the kind list grows from eleven to twelve, the read counts grow with the Reviewer's job), supabase/checks/virtual_fleets.sql (BR-GAME-1..3: the Reviewer's default skills go from {} to {review}), apps/omni-app/src/missions/supervisor.test.ts and mission.e2e.test.ts (BR-PRODUCT-139: builds are sent as /omni:yolo <n> --for-review). Raised high at the person's request, because these rules are proposed and the kit ranks the change medium on its own.

## What I did meanwhile

The checks pass as changed; the feature PR stays a draft until this is answered.

## What it costs to change later

Undoing means reverting the review step in missions, the runner and the Reviewer's defaults: the whole PRD's wiring.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The rules these checks prove are proposed, not confirmed: no owner is named to approve them (author)

```

<!-- /omni-outbox-settled: s3-04-rule-proof-tests-changed -->

<!-- omni-outbox-settled: s1-04-review-form-budget-5k -->

## s1-04-review-form-budget-5k — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-15T08:00:14Z
- Channel: feature pull request #2872
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2872#issuecomment-6891395201
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 2
- Stays here: a ceiling for this repository, set in the ceilings file; nothing lasting about the product

### The answer, as it was given

```text
A. A. Raise the limit of the review section to 5 KB (built).
```

### The item, as it was raised

```text
---
id: s1-04-review-form-budget-5k
prd: 2871
slice: s1
rank: high
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The review section of the playbook now holds the Reviewer's six default checks and is nearly at its 2 KB limit, leaving no room for this repository's own review rules. Raise its limit to 5 KB?

## The decision, in plain words

The limit was raised to 5 KB, so this repository can add its own review rules without asking for another raise. The section is read only when an agent reviews, not at every start.

## The intro, for fun

The Reviewer's checklist fits, but only if nobody adds a single line.

## The punchline, for fun

Now there is room on the clipboard for the house rules too.

## The options, in plain words

A. A. Raise the limit of the review section to 5 KB (built).
B. B. Keep it at 2 KB and trim the six default checks to leave room.

## What I had to decide

Budget raise: `form:review` to 5120 bytes

## What I did meanwhile

The review section measures 1,936 bytes; the limit is now 5,120 bytes.

## What it costs to change later

Lowering it later is one line in the ceilings file, as long as the section still fits under the new number.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long the repository's own review rules will grow is not known yet (author)

```

<!-- /omni-outbox-settled: s1-04-review-form-budget-5k -->
