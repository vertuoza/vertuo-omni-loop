# Settled outbox items — PRD 487

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-no-promotion-keeps-the-ship -->

## s1-01-no-promotion-keeps-the-ship — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-no-promotion-keeps-the-ship
prd: 487
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a merged feature taught nothing new, should the harvest also skip the bookkeeping it does at merge time, like moving the feature's folder to the shipped shelf?

## The decision, in plain words

It skips only its own notes about what stayed local. If the feature's folder still has to move to the shipped shelf, or open questions still have to be closed, that still happens.

## The intro, for fun

Nothing new was learned, but the boxes still have to go to the attic.

## The punchline, for fun

We skip the diary entry, not the move.

## The options, in plain words

A. A. Skip only the harvest's own notes; still settle and ship what prepare planned, the option built.
B. B. Drop every change, the settling and the move included, so no pull request ever opens without a promotion.
C. C. Keep the notes too, and let the app decide from the list of promotions whether to open a pull request.

## What I had to decide

Whether a harvest with nothing promoted drops every change it would make, or only its own notes about what stayed local.

## What I did meanwhile

A harvest with no new register entry or decision record keeps the merge-time settling and the move out of the inbox that prepare planned, and adds none of its own ledger lines. For a feature already shipped by its branch, which is the usual case, that is no change at all, so the app opens no pull request.

## What it costs to change later

One line in the harvest's finishing step: return no changes at all instead of only what prepare planned.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the harvest returns no edits and the app opens no pull request; it does not say what should happen to a feature still in the inbox at merge, whose move would then never be made by anyone.
- (author) Without the local notes, a replayed harvest asks the model about the same candidates again; the spec does not say whether that matters.

```

<!-- /omni-outbox-settled: s1-01-no-promotion-keeps-the-ship -->

<!-- omni-outbox-settled: s2-01-bookkeeping-still-opens-a-pr -->

## s2-01-bookkeeping-still-opens-a-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-bookkeeping-still-opens-a-pr
prd: 487
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When a merged feature taught nothing new but its folder still has to move to the shipped shelf, should the app still open a knowledge pull request for that move?

## The decision, in plain words

Yes: the app skips the pull request only when there is truly nothing to change. If the move or the closing of open questions is still owed, it opens the pull request as before, and leaves no comment.

## The intro, for fun

Nothing new was learned, but the boxes are still sitting in the hallway.

## The punchline, for fun

Someone has to carry them upstairs, and that takes a pull request.

## The options, in plain words

A. Open the pull request only when there is something to write; a bookkeeping-only pull request still opens, the option built.
B. Never open a pull request without a promotion, and leave the move and the settling undone until a later harvest.
C. Never open a pull request without a promotion, and say in the comment that the move is still owed so a person does it by hand.

## What I had to decide

Whether the app gates the knowledge pull request on 'nothing to write at all' or on 'nothing promoted', when a feature with no promotion still has merge-time bookkeeping left.

## What I did meanwhile

The app opens no branch and no pull request, and leaves the 'Knowledge: nothing new' comment, only when the harvest has nothing at all to write. That is the usual case, since the feature branch already ships its own folder. When the move or the settling is still owed, the pull request opens as before, carrying only that bookkeeping. The count in the comment is every candidate the harvest looked at.

## What it costs to change later

One condition in the harvest's publish step: test for a promotion instead of for an empty change set.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says no promotion means no pull request, and the adopted s1 decision says the move and the settling still happen; both cannot hold for a feature still in the inbox at merge, so the app follows the s1 decision.
- (author) The spec does not say whether '<n> candidates stayed local' counts candidates the model could not place; the comment counts every candidate.

```

<!-- /omni-outbox-settled: s2-01-bookkeeping-still-opens-a-pr -->

<!-- omni-outbox-settled: s3-01-verdict-follows-prose-rules -->

## s3-01-verdict-follows-prose-rules — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-verdict-follows-prose-rules
prd: 487
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The judge's short reason for its verdict, and its reason for keeping each finding, are published words. Should they follow the same strict wording rules as the rest of the retro, even though breaking one throws the whole verdict away?

## The decision, in plain words

They follow the same rules as every other published sentence of the retro: no digits, no links, no refused words, and a length cap of three hundred characters each. When one breaks a rule, the whole verdict is dropped and the retro counts as not judged, so no pull request opens.

## The intro, for fun

The judge has to watch its language as closely as the witnesses do.

## The punchline, for fun

One stray digit and the verdict is thrown out of court.

## The options, in plain words

A. A: every prose rule applies to the reason and each why, with caps of three hundred characters, and any failure drops the whole verdict
B. B: only the length caps apply to the reason and each why; other prose rules are not checked on them
C. C: a reason or why breaking a rule is dropped on its own, and the verdict survives when the rest holds

## What I had to decide

Whether the verdict's reason and each finding's why obey every prose rule (A), only the length cap the spec names (B), or are cleaned instead of dropped (C).

## What I did meanwhile

A verdict whose reason or why holds a digit, a link or a refused word is dropped, and the retro takes the quiet path with a comment reading not judged.

## What it costs to change later

A constant change in the guard and the field caps; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No live reply has been seen yet, so how often the model writes a digit in its reason is unknown (author).

```

<!-- /omni-outbox-settled: s3-01-verdict-follows-prose-rules -->

<!-- omni-outbox-settled: s3-02-two-test-files-past-the-fence -->

## s3-02-two-test-files-past-the-fence — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-two-test-files-past-the-fence
prd: 487
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Asking the model for a verdict changed two test files that belong to the next slice: a saved copy of the retro's rules, and one test reply that had no verdict. Is it fine that this slice touched them, rather than leaving the tests red until the next slice?

## The decision, in plain words

This slice changed both, as little as it could: the saved rules gained the two new length caps, and the one test reply gained a verdict saying nothing is worth keeping. Every test stays green, and the next slice still owns those files.

## The intro, for fun

Two test files sat just past the fence, and the new verdict rolled over it.

## The punchline, for fun

The slice stepped over, tidied both, and stepped right back.

## The options, in plain words

A. A: this slice changes the saved rules and the one test reply, so every test stays green
B. B: leave both to the next slice, and let the retro tests stay red until it lands

## What I had to decide

Whether the two small test changes stay in this slice (A), or move to the next slice with the tests left red in between (B).

## What I did meanwhile

The saved retro rules list the two new caps, and the retro's test reply for the day-fourteen run carries a verdict judged not worth it.

## What it costs to change later

Two lines in test files; reverting them only moves the work to the next slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the next slice would rather rewrite these lines its own way is not known (author).

```

<!-- /omni-outbox-settled: s3-02-two-test-files-past-the-fence -->

<!-- omni-outbox-settled: s4-01-day-14-falls-back-on-the-merge-verdict -->

## s4-01-day-14-falls-back-on-the-merge-verdict — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-day-14-falls-back-on-the-merge-verdict
prd: 487
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

Fourteen days after a merge the retro asks the judge again. If the judge cannot be reached that day, should the retro keep the answer it got at the merge, or count as not judged?

## The decision, in plain words

It keeps the answer from the merge, the same way it already keeps the merge's words. And when the later run is worth a pull request while the first was not, it also opens the issues for the first run's kept findings, which never got any.

## The intro, for fun

Two weeks later the judge is out for lunch.

## The punchline, for fun

So the retro goes with what the judge said last time.

## The options, in plain words

A. A failed day-14 call keeps the merge run's verdict with its words, and a late PR also opens the first run's kept issues; the option built.
B. A failed day-14 call counts as not judged: the comment is rewritten and nothing is added to an open PR.
C. Keep the merge verdict, but open issues at day 14 only for the day-14 run's own findings.

## What I had to decide

The spec says the day-14 run is judged the same way on both runs' findings, and that no verdict means no PR. It does not say what the day-14 run does when its own model call fails, nor whether the merge run's kept findings get issues when only the day-14 run opens a PR.

## What I did meanwhile

At day 14, `prose = guarded.prose ?? earlier.prose`, as before, and the verdict comes with those words: a failed day-14 call acts on the merge run's verdict (a merge run with an open PR gets its After merge commit; a quiet merge run's comment is rewritten). When the day-14 run is worth it and the merge run opened no PR, its issues are published over both runs' findings (kept ones only, merge run's first); otherwise over its own. A "no new lesson" comment left by the merge run stays as it is when day 14 opens the PR.

## What it costs to change later

A constant: dropping the fallback is one expression in the retro function, and the issue range is one condition.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) When day 14 opens the PR after a quiet merge run, the earlier verdict comment is left in place and now disagrees with the PR; the spec does not say whether to rewrite or delete it.
- (author) Issues over both runs are ranked merge run first, not worst first across both runs.

```

<!-- /omni-outbox-settled: s4-01-day-14-falls-back-on-the-merge-verdict -->

<!-- omni-outbox-settled: s4-02-retro-reads-less-than-the-harvest -->

## s4-02-retro-reads-less-than-the-harvest — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-retro-reads-less-than-the-harvest
prd: 487
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

To give the judge the knowledge base and the earlier lessons, should the retro copy the whole delivery folder at the merge, as the knowledge harvest does, or only what it needs?

## The decision, in plain words

It copies only the settings and the knowledge folder, and reads the earlier retro records one by one from a single listing of the shipped folder. The delivery folder is several megabytes and hundreds of files that the judge never reads.

## The intro, for fun

Asked for last year's lessons, the retro was about to carry the whole library home.

## The punchline, for fun

It took the index and one shelf instead.

## The options, in plain words

A. Copy only the settings and the knowledge folder, and read each earlier retro record from one listing; the option built.
B. Copy every loop folder as the harvest does, and read the records from that copy.

## What I had to decide

The spec says the new step reads the knowledge folder and the shipped retro.json files "through the harvest's tree reader", which snapshots every loop folder, the delivery folder included (about 250 files and 5 MB on this repository at PRD 438's merge).

## What I did meanwhile

`gatherKnowledge` calls the harvest's `withTreeAt` with the config's delivery, playbook and glossary paths set to null, so only the config and the knowledge folders are snapshotted, and builds the summary with the kit's `knowledgeSummary`. The retro.json files are found with one recursive tree listing of the shipped folder and read blob by blob.

## What it costs to change later

A constant: passing the config unchanged to the tree reader and reading the files from its snapshot instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec's wording meant the whole snapshot or only the reader: it gives no size budget for the step.

```

<!-- /omni-outbox-settled: s4-02-retro-reads-less-than-the-harvest -->

<!-- omni-outbox-settled: s4-03-lessons-kept-in-the-retro-record -->

## s4-03-lessons-kept-in-the-retro-record — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-lessons-kept-in-the-retro-record
prd: 487
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The judge compares each retro with the lessons of earlier retros, but the retro record never stored its lessons. Where should they be kept so the next retro can read them?

## The decision, in plain words

Each run of a retro now also keeps, in its record file, the lessons that passed the checks and the verdict, and the next retro reads those lessons. Older records hold none, so the first retros compare only with the knowledge base.

## The intro, for fun

The judge was told to remember old lessons, but nobody had ever written them down.

## The punchline, for fun

So now the notebook comes with the lesson.

## The options, in plain words

A. Each run of the record keeps its accepted lessons and the verdict, and the next retro reads them from every run; the option built.
B. The record keeps one list of lessons for the whole retro at its top, rewritten by each run.
C. Only the lessons of findings the judge kept are stored, so the next judge compares with kept lessons alone.

## What I had to decide

The spec asks the judge for "every lessons[].text in the retro.json files", but retro.json has only ever held the fact sheet, the narration outcome and the issues: no retro wrote its lessons. The shape of where they live was not settled.

## What I did meanwhile

Each run record in retro.json gains two optional fields: `lessons` (the lessons `guard` accepted, text and cited finding ids, dropped ones left out) and `verdict` (as `guard` kept it). `gather-knowledge` reads `runs[].lessons[].text` from every `<shipped>/<prd>/retro.json` at the merge commit, oldest PRD first, each text once.

## What it costs to change later

A constant: the field name and where it sits in the record. Moving it to the top of the file is one line to write and one to read; no stored record holds lessons yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the field `lessons[].text` without saying whether it is per run or per file; per run keeps a day-14 run's lessons apart from the merge run's.
- (author) Whether lessons of findings the judge did not keep should be kept too: every accepted lesson is kept, so a later judge sees more, not less.

```

<!-- /omni-outbox-settled: s4-03-lessons-kept-in-the-retro-record -->

<!-- omni-outbox-settled: s4-04-four-test-files-past-the-fence -->

## s4-04-four-test-files-past-the-fence — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-four-test-files-past-the-fence
prd: 487
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

Now that a retro nobody could judge opens no pull request, four older tests outside this slice's files fail because they expected one. Should the slice change them?

## The decision, in plain words

Yes, as little as possible: two tests now give the retro a stand-in judge that keeps every finding, one test expects the comment instead of the pull request, and the recorded replay of an older feature expects the comment and reads its counts from the retro's own step.

## The intro, for fun

The new rule was polite to everyone except four old tests.

## The punchline, for fun

They got a stand-in judge and a new script.

## The options, in plain words

A. Change the four tests as little as the new rule needs, with a shared stand-in judge; the option built.
B. Leave them failing and raise a follow-up slice that owns them.

## What I had to decide

The plan's territory for this slice is the retro's retro, issues, render and publish files, the retro scenario, the replay helper and the fixtures. Four test files outside it ran the whole retro without a model key and expected a retro PR, which the spec now forbids.

## What I did meanwhile

Changed outside the territory: `src/retro/kinds/churn.test.mjs` and `src/retro/kinds/ci.test.mjs` (the retro built with the scenario's stubbed judge), `src/retro/narrate.test.mjs` (a 500 now ends in the "not judged" comment; the stubbed reply keeps its finding so the file is still written), and `test/prd-50.test.mjs` (the verdict comment and its golden instead of retro.md, the timeline read from the step "facts"). `createRetro` gained a `fetch` dependency so a test hands the judge in without stubbing globals. PRD 50's `retro.golden.md` was replaced by `verdict.golden.md`, and its recording gained the knowledge reads.

## What it costs to change later

A constant: each change is a test's expectation or its setup, with no product code outside the territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant these tests to move with the slice; it names only the retro's own test file.

```

<!-- /omni-outbox-settled: s4-04-four-test-files-past-the-fence -->
