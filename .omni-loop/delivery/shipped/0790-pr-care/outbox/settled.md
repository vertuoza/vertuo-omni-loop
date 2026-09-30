# Settled outbox items — PRD 790

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-care-help-entry -->

## s1-01-care-help-entry — adopted

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
id: s1-01-care-help-entry
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The new PR care command needs a line in the built-in help, but the help belongs to a later part of this work. Should this part write it now?

## The decision, in plain words

We wrote the help line for the new command now, because every command must have one for the checks to pass. The later part that adds the PR care skill builds on it.

## The intro, for fun

A new command walked in without a name tag.

## The punchline, for fun

So we printed one at the door rather than keep it waiting outside.

## The options, in plain words

A. Add the command's help entry in s1, the option built.
B. Leave the help line to the later part, and accept failing checks on the feature until then.

## What I had to decide

Whether slice s1 may add the `care` command's help entry in kit/lib/help (s5's territory), since the help test fails for any command without one.

## What I did meanwhile

s1 adds one command entry to kit/lib/help/entries.mjs and bumps the command count from 36 to 37 in entries.test.mjs; s5 adds the skill entry on top.

## What it costs to change later

One help entry and a counter in a test; undone by moving the entry into s5.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s5 wants to reword the command's help text (author)

```

<!-- /omni-outbox-settled: s1-01-care-help-entry -->

<!-- omni-outbox-settled: s1-02-which-claims-hold-a-round -->

## s1-02-which-claims-hold-a-round — adopted

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
id: s1-02-which-claims-hold-a-round
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

PR care must not push while a wave is building. Which unfinished pieces count as a wave still building?

## The decision, in plain words

Any piece whose pull request is still open counts, even a claim gone quiet, except one marked stuck. When the list of pieces cannot be read, PR care only reports and pushes nothing.

## The intro, for fun

Is anyone still in the kitchen?

## The punchline, for fun

If a pan is on the stove, nobody mops the floor.

## The options, in plain words

A. Open sub-PRs (in flight or stale claim) hold the round, stuck ones do not, the option built.
B. Only fresh claims hold the round; a stale claim no longer freezes it.
C. Any sub-PR not yet merged holds the round, stuck ones included.

## What I had to decide

Which board states make `omni care state` report `wave.holdsClaims: true`, and what happens when the board cannot be read.

## What I did meanwhile

in-flight and claimed-stale count as claims; stuck, merged, runnable and blocked do not; an unreadable board gives holdsClaims null, which decideRound treats as report-only.

## What it costs to change later

One set of state names in kit/bin/commands/care.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a stuck sub-PR should also freeze PR care (author)

```

<!-- /omni-outbox-settled: s1-02-which-claims-hold-a-round -->

<!-- omni-outbox-settled: s1-03-asked-stays-asked -->

## s1-03-asked-stays-asked — adopted

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
id: s1-03-asked-stays-asked
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Once PR care hands a review comment to the PM, what happens when more people reply in that thread?

## The decision, in plain words

The comment stays with the PM: PR care never picks it up again, whatever is said after. A comment PR care fixed or declined becomes the PM's the moment a reviewer answers or reopens it.

## The intro, for fun

Some conversations are above everyone's pay grade.

## The punchline, for fun

Those ones go to the PM and stay there.

## The options, in plain words

A. An asked thread stays with the PM for good, the option built.
B. PR care reads the PM's reply in an asked thread and acts on it in the next round.

## What I had to decide

How a review thread whose last care reply says asked reads when later comments arrive, and whether a reopened thread counts as the reviewer's last word.

## What I did meanwhile

A thread whose last care marker is asked stays asked with nothing to do; a fixed or pushed-back thread with a later non-care comment, or unresolved again, reads as asked and the round posts an asked reply.

## What it costs to change later

A few lines in kit/lib/care/state.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how the PM's own answer in the thread should be carried out (author)

```

<!-- /omni-outbox-settled: s1-03-asked-stays-asked -->

<!-- omni-outbox-settled: s2-01-chip-open-count -->

## s2-01-chip-open-count — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-chip-open-count
prd: 790
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The health chip says how many review comments are still open. Should that count include the comments waiting for the product manager's decision, or only the ones nobody has handled yet?

## The decision, in plain words

The chip counts every comment not yet resolved on GitHub, so it includes the ones waiting for the product manager's decision as well as the ones nobody has handled.

## The intro, for fun

Two open comments, or one open and one waiting for you? The chip had to pick a meaning.

## The punchline, for fun

It went with the plain meaning: anything not resolved yet counts as open.

## The options, in plain words

A. count every unresolved thread, asked included (built)
B. count only the threads nobody has handled, matching the tab's open count
C. show two numbers on the chip, open and asked

## What I had to decide

The spec shows the chip as `CI ✓ · no conflict · 2 open` and, on the tab, separate counts of open, fixed, pushed-back and asked threads. It does not say whether the chip's open number includes asked threads.

## What I did meanwhile

`openThreads` in `apps/galaxy/src/dossier/github/care.ts` counts every unresolved thread (unhandled plus asked), and the chip uses it.

## What it costs to change later

A one-line change to the filter in `openThreads`, and its test expectations. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people read the chip number as all unresolved comments is not tested with a product manager (author)

```

<!-- /omni-outbox-settled: s2-01-chip-open-count -->

<!-- omni-outbox-settled: s2-02-page-reads-care-marks -->

## s2-02-page-reads-care-marks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-page-reads-care-marks
prd: 790
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The page and the terminal command both need to recognise the hidden mark a care reply carries, and the time written in the watch line. Should the page share the terminal's reader, or keep its own copy?

## The decision, in plain words

The page keeps its own small reader of the mark and of the watch line for now, because the terminal's reader is being built at the same time. It expects the watch line's times written in the standard date-and-time form.

## The intro, for fun

Two readers for one hidden mark: twins built in separate rooms on the same day.

## The punchline, for fun

They agree today; a later tidy-up can make them one.

## The options, in plain words

A. keep a separate reader on the page, standard times expected (built)
B. share the terminal's reader once it is merged, in a follow-up slice
C. fix the care line's time format in the spec and have both sides test against one fixture

## What I had to decide

s1 builds the kit's marker reader and state parser in `kit/lib/care/` in the same wave, so galaxy cannot import it yet. The spec also does not fix the time format of the status comment's `PR care: watching since <time> · last round <time>` line.

## What I did meanwhile

`apps/galaxy/src/dossier/github/care.ts` has its own `careVerdictOf` (the `<!-- omni-care: fixed|pushed-back|asked -->` marker) and reads the care line's two times with `Date.parse`, so ISO 8601 times are expected; a time it cannot parse reads as no watch.

## What it costs to change later

Swapping the local reader for an import from `kit/lib/care/` once s1 is merged is a small refactor with the same tests. If s5 writes the times in another form, only the care-line parser changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s1 and s5 write exactly this marker and ISO times is not known from this slice (author)

```

<!-- /omni-outbox-settled: s2-02-page-reads-care-marks -->

<!-- omni-outbox-settled: s3-01-review-template-kit-original -->

## s3-01-review-template-kit-original — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-review-template-kit-original
prd: 790
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Every advice page the kit ships was copied from an older project, and a test asks each one to say where from. The new review page has no such source: may it go without that note?

## The decision, in plain words

The review page is marked as written by the kit itself, and the test now checks that it carries no copied-from note, while every other page still needs one.

## The intro, for fun

Every page in the kit had a birth certificate, then a brand new one showed up without parents.

## The punchline, for fun

We noted it was born here, and kept checking everyone else's papers.

## The options, in plain words

A. Mark the review template kit-original in the templates test; every other template keeps its provenance line.
B. Add a porting record naming the pull request page as a loose source, and keep the rule with no exception.
C. Drop the provenance rule for all templates.

## What I had to decide

Whether a kit-written template may skip the copied-from note, or must get a porting record of its own.

## What I did meanwhile

The review template ships with no copied-from note; the templates test lists it as kit-original.

## What it costs to change later

A constant: one set in the templates test. Undoing it means adding a note and a porting record.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No upstream page holds a review rubric at the pinned commit, so there is nothing honest to port from (author)

```

<!-- /omni-outbox-settled: s3-01-review-template-kit-original -->

<!-- omni-outbox-settled: s4-01-care-tab-open-count -->

## s4-01-care-tab-open-count — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-care-tab-open-count
prd: 790
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

On the PR care tab, the review counts list open, fixed, pushed back and asked. Should 'open' mean only the comments nobody has handled yet, or also the ones waiting for the PM?

## The decision, in plain words

In the counts row, open means nobody has handled it yet, and asked is counted on its own. The tab's small badge adds both together, like the health chip does.

## The intro, for fun

Two counters looked at the same comment and argued about whose it was.

## The punchline, for fun

We gave the row one each and let the badge count them together.

## The options, in plain words

A. Open counts only unhandled threads in the row; the badge counts open plus asked (built).
B. Open counts every unresolved thread in the row too, asked ones shown twice.
C. Rename the row's open to 'not handled' so it never reads like the chip.

## What I had to decide

What 'open' counts in the PR care tab's Review row, given the health chip's 'N open' counts unresolved threads including asked ones (s2-01).

## What I did meanwhile

The Review row reads '1 open · 1 fixed · 1 pushed back · 1 asked' with open = verdict open only; the tab badge reads 'N open' with N = open + asked, matching the chip.

## What it costs to change later

One word map and a count in view.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the four counts without saying whether open includes asked.

```

<!-- /omni-outbox-settled: s4-01-care-tab-open-count -->

<!-- omni-outbox-settled: s4-02-care-tab-while-unknown -->

## s4-02-care-tab-while-unknown — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-care-tab-while-unknown
prd: 790
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The PR care tab should only show when the PRD has a feature PR, but while the page is still asking GitHub nobody knows yet. Should the tab show in the meantime?

## The decision, in plain words

The tab stays in the bar, dimmed, until GitHub says there is no feature PR, so the tabs do not jump when the answer arrives. It also stays once the feature PR is merged, saying there is nothing left to look after.

## The intro, for fun

Is there a feature PR? The page is still waiting for GitHub to say.

## The punchline, for fun

So the tab keeps its seat until someone confirms it is really empty.

## The options, in plain words

A. Show the tab unless GitHub answered there is no feature PR, dimmed while unknown or merged (built).
B. Show it only once GitHub confirmed a feature PR, letting the tab bar change when the answer arrives.
C. Show it only while the feature PR is open.

## What I had to decide

Whether the PR care tab shows while GitHub has not answered (page streaming, or GitHub unreachable) and after the feature PR merged, or only while an answer says a feature PR exists.

## What I did meanwhile

view.ts hides the tab only for a draft or when the summary says feature is null; pending reads 'Reading GitHub…', unread reads the usual GitHub alert, merged reads 'The feature PR is merged: nothing is left to look after.' The streamed page's pending view (stream/pending.test.ts) keeps the same tab bar as the final one.

## What it costs to change later

One predicate (noFeature) in view.ts and a few test expectations.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'shown while the PRD has a feature PR' and does not say what an unknown answer or a merged PR means.

```

<!-- /omni-outbox-settled: s4-02-care-tab-while-unknown -->

<!-- omni-outbox-settled: s5-01-care-own-worktree -->

## s5-01-care-own-worktree — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-care-own-worktree
prd: 790
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

PR care changes and pushes code while it watches. Should it work in the person's own copy of the project, or in a separate copy of its own?

## The decision, in plain words

PR care works in a separate copy of its own, so the person's own copy is never switched or changed while it watches.

## The intro, for fun

Two cooks, one cutting board, and one of them keeps swapping the vegetables.

## The punchline, for fun

So PR care brought its own board.

## The options, in plain words

A. A. A worktree of its own, reset each round (built).
B. B. The person's checkout, refusing to start when it has changes.
C. C. A fresh clone in a temporary folder.

## What I had to decide

Where /omni:pr-care makes its conflict, CI and review fixes: the person's checkout, or a worktree of the feature branch; the spec does not say.

## What I did meanwhile

The skill adds a worktree at <worktrees>/pr-care-<n>, resets it to the feature branch at the start of every round, and removes it when the watch stops.

## What it costs to change later

A few lines in kit/plugin/skills/pr-care/SKILL.md; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people expect to see care's fixes appear in their own checkout is not known.

```

<!-- /omni-outbox-settled: s5-01-care-own-worktree -->

<!-- omni-outbox-settled: s5-02-care-fix-that-stays-red -->

## s5-02-care-fix-that-stays-red — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-care-fix-that-stays-red
prd: 790
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

A reviewer asks for a fix, PR care tries it, and the project's checks keep failing. What should happen to that comment?

## The decision, in plain words

PR care undoes its attempt, pushes nothing, and hands the comment to the PM with a note saying what it tried.

## The intro, for fun

The fix looked easy, then the tests disagreed three times in a row.

## The punchline, for fun

When the fix will not behave, a person gets the call.

## The options, in plain words

A. A. Revert, and hand the thread to the PM as asked (built).
B. B. Revert, and push back with the reason that the fix broke the checks.
C. C. Push the fix anyway and let the CI fix loop take it.

## What I had to decide

What a review thread judged fixed becomes when its fix cannot pass the preflight within limits.attempts tries; the spec only says each fix runs the preflight before pushing.

## What I did meanwhile

The skill reverts the attempt, pushes nothing, and replies with the asked verdict, naming what was tried; the thread stays open for the PM.

## What it costs to change later

One paragraph of kit/plugin/skills/pr-care/SKILL.md.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a pushed-back reply would suit such a thread better is not settled by the spec.

```

<!-- /omni-outbox-settled: s5-02-care-fix-that-stays-red -->

<!-- omni-outbox-settled: s5-03-docs-skills-list-outside-territory -->

## s5-03-docs-skills-list-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-docs-skills-list-outside-territory
prd: 790
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

The skills page of the docs has a test that lists every skill under Build it by name, and adding PR care there means changing a file this part of the work was not given: may it?

## The decision, in plain words

We added PR care's name to that list in the docs test, a one-word change, so the docs page shows the new skill under Build it with the checks still passing.

## The intro, for fun

The new skill arrived at the docs page and found the guest list already printed.

## The punchline, for fun

So we wrote its name in by hand, at the end of the row.

## The options, in plain words

A. A. Change the docs test's expected list in this slice (built).
B. B. Put PR care in the Every day group instead, which that test does not list by name.
C. C. Leave the docs test red until a follow-up slice.

## What I had to decide

Whether slice s5 may change apps/galaxy/src/docs/skills.test.ts, outside its territory, whose overview test lists the build group's skills by name and fails for any new one.

## What I did meanwhile

Added 'pr-care' after 'pr' in the build group's expected list in apps/galaxy/src/docs/skills.test.ts; no page code changed, the page reads the help entries.

## What it costs to change later

One word in one test; undone by moving the line to another slice or putting the skill in another group.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan did not foresee that the docs page test names every build skill.

```

<!-- /omni-outbox-settled: s5-03-docs-skills-list-outside-territory -->
