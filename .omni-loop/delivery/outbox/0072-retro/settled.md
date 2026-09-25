# Settled outbox items — PRD 72

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-retro-label-look -->

## s1-01-retro-label-look — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-retro-label-look
prd: 72
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

What colour and what description should the new label for retros carry, since the spec asks for both but names neither?

## The decision, in plain words

The label is a pale lavender that no other label of the loop uses, and its description says it marks the retro of a merged feature: its retro pull request, or one finding to act on.

## The intro, for fun

Every new label has to pick an outfit before its first day at work.

## The punchline, for fun

It went with lavender: calm enough for looking back, bright enough to be found.

## The options, in plain words

A. A pale lavender no other loop label uses, with a description naming the retro pull request and a finding to act on, the option built.
B. A grey, so retro issues read as history rather than as work waiting to be done.
C. Another colour or wording a person prefers; only the look of the label changes.

## What I had to decide

The colour and the description `LABEL_STYLES.retro` gives the `omni:retro` label, which `omni init` creates with both. The spec ("The app's manifest, the kit, the environment") asks for `labels.retro` "with its colour and description in `LABEL_STYLES`" and names neither.

## What I did meanwhile

Colour `d4c5f9`, a pale lavender none of the seven other loop labels uses; description "Omni Loop: the retro of a merged PRD — its retro pull request, or one finding to act on", under GitHub's 100-character cap and in the "Omni Loop: …" shape the others share. `kit/lib/init/labels.test.mjs` pins that the colour differs from every other loop label's and that the description fits the cap.

## What it costs to change later

One line in `kit/lib/init/labels.mjs` and a rebuilt `kit/dist/omni.mjs`. `omni init` never recolours or rewords a label that exists, so a repository that already created it changes it by hand on its labels page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the team already reads a colour as "looking back" or "not work yet" on its boards.

```

<!-- /omni-outbox-settled: s1-01-retro-label-look -->

<!-- omni-outbox-settled: s2-01-route-test-counts-the-retro -->

## s2-01-route-test-counts-the-retro — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-route-test-counts-the-retro
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The plan says the tests of the existing pull request check must pass unchanged, yet one of them says the app serves that check and nothing else. Should that test change now that the app serves the retro too?

## The decision, in plain words

That one test now says the app serves the check and the retro, each with its own failure handler. Every other test of the existing check is untouched and passes as before.

## The intro, for fun

Two jobs now share one front door, and the doorbell test still expects a single guest.

## The punchline, for fun

The test learned to count to two, and the check itself never noticed the new neighbour.

## The options, in plain words

A. Change that one test to count the retro beside the check, the option built.
B. Serve the retro from a second endpoint of its own, so the test stays as it was, at the price of a second setup step.
C. Move that test beside the endpoint it describes, in the retro's ground, and leave the check's folder with only the check's own tests.

## What I had to decide

Whether to edit `src/outbox-check/inngest-route.test.mjs`, outside this slice's territory. The spec puts the retro function's registration in `api/inngest.mjs` (Scope, In), and that test asserts `functions` equals `[outboxCheck]` and that Inngest describes 2 functions. The plan's done-when for s2 says "The `outbox-check` tests pass unchanged", and the spec's test seams say "`outbox-check` — its existing tests pass unchanged". Both cannot hold for this one test.

## What I did meanwhile

The test now asserts `functions` equals `[outboxCheck, retro]`, names `RETRO_FUNCTION_ID`, and expects 4 functions (each function and its failure handler). `outbox-check.test.mjs` and `end-to-end.test.mjs` are untouched and pass.

## What it costs to change later

A constant: the test's two expectations. Serving the retro from a second endpoint instead would keep the test unchanged but need a second Inngest app and a second sync, a human step the spec does not list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec's "existing tests pass unchanged" meant the outbox check's behaviour, which is unchanged, or every test file under its folder.

```

<!-- /omni-outbox-settled: s2-01-route-test-counts-the-retro -->

<!-- omni-outbox-settled: s2-02-one-retro-at-a-time-per-repository -->

## s2-02-one-retro-at-a-time-per-repository — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-one-retro-at-a-time-per-repository
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The spec asks that only one retro of the same product request runs at a time in a repository, but which request a merge belongs to is only known once the retro has started reading. How should retros be kept apart?

## The decision, in plain words

Only one retro runs at a time in each repository, whatever request it is for. Two retros of the same request can never overlap, and merges are rare enough that waiting costs little.

## The intro, for fun

Two retros walk into the same repository at once and reach for the same branch.

## The punchline, for fun

So they queue politely, one at a time, like people at a single coffee machine.

## The options, in plain words

A. One retro at a time per repository, the option built.
B. One at a time per repository and feature branch, adding the branch's name to the event the webhook sends.
C. One at a time per repository and pull request number, which lets two retros of one request race on the same branch.

## What I had to decide

The retro function's concurrency key. The spec ("Flow") gives it "its own concurrency key (repository + PRD)", but the event carries only the repository and the pull request number (the spec's own event shape); the PRD is known after the step "qualify" reads the config and the delivery folder at the merge SHA, and a concurrency key is read from the event before the run starts.

## What I did meanwhile

`CONCURRENCY` in `src/retro/retro.mjs` is `{ key: 'event.data.repository', limit: 1 }`: one retro at a time per repository, which also keeps two retros of one PRD apart. Its test pins the key.

## What it costs to change later

One constant. Keying on the repository and the feature branch's name instead would need the head ref added to the event the webhook sends, one more field and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How often two feature PRs of one repository merge within the minutes a retro takes; if often, the queue is felt.

```

<!-- /omni-outbox-settled: s2-02-one-retro-at-a-time-per-repository -->

<!-- omni-outbox-settled: s2-03-prd-50-recording-is-trimmed -->

## s2-03-prd-50-recording-is-trimmed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-prd-50-recording-is-trimmed
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The recorded example of an earlier delivery was read from the code host through a connector that returns a slimmer shape and cannot see when a pull request was marked ready. Is a trimmed recording good enough?

## The decision, in plain words

The recording keeps what the retro reads, in the code host's own shape, without long descriptions or code changes, and the files come from the repository itself. The moment the feature was marked ready is left unknown, and the retro says so.

## The intro, for fun

The recorder had a small suitcase, so it packed only what the trip would actually use.

## The punchline, for fun

One souvenir stayed behind: the minute the feature said it was ready to be looked at.

## The options, in plain words

A. Keep the trimmed recording, with the ready moment unknown, the option built.
B. Record again later with direct access to the code host, bodies, comments and events included.
C. Add the ready moment by hand from the pull request's page, marked as added by hand.

## What I had to decide

What `apps/omni-app/test/fixtures/prd-50/recording.json` holds. The plan asks for "#51 and its sub-PRs, as GitHub returned them". This session reads GitHub only through the GitHub connector: it returns pull requests, files and reviews in a slimmer shape, and has no route for issue events, so `ready_for_review` on #51 cannot be recorded.

## What I did meanwhile

The recording holds 20 responses: #51, the sub-PR list (#54, #56, #57), each sub-PR's files and each PR's reviews, in the REST shape trimmed of bodies and patches; `merge_commit_sha` for #51 is read from the squash commit on `main`; the trees and blobs at the merge SHA are built from that commit's own git objects. Issue events, comments, commits and check runs are not recorded, which `recording.json` states. The replay gives 3 slices in 2 waves, and the timeline reads "ready: not known".

## What it costs to change later

Recording again with a token that reads the REST API directly replaces one file and the retro pinned beside it; no code changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a later slice needs a response this recording leaves out; slice s5's test reads only the settled file, which is recorded.

```

<!-- /omni-outbox-settled: s2-03-prd-50-recording-is-trimmed -->

<!-- omni-outbox-settled: s2-04-prose-caps-and-refused-words -->

## s2-04-prose-caps-and-refused-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-prose-caps-and-refused-words
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The spec says each piece of the model's writing has a length limit and a list of refused words, but gives neither the limits nor which word list. Which should the retro use?

## The decision, in plain words

The summary may run to a short paragraph, a title to one line, and each explanation or lesson to a few sentences. The refused words are both lists the joke lines already avoid: the words every delivery file keeps out, and the words that point at a person or a group.

## The intro, for fun

Every writer needs a word count, and this one needed a list of words to stay away from.

## The punchline, for fun

It got both, and the list keeps the writing on what went wrong, never on who was nearby.

## The options, in plain words

A. These caps, and both word lists, the option built.
B. The same caps, refusing only the first list, not the person words.
C. Tighter caps, to keep a retro short enough to read in one sitting.

## What I had to decide

The values `rules` holds for `FIELD_CAPS` and `REFUSED_WORDS`. The spec ("The model, and the guard") says a field is dropped when it "is longer than its cap in `rules`, or holds a word `rules` refuses: the same list of words the kit's question pool may not hold (`kit/lib/outbox/banter.test.mjs`)". It names no cap, and that test holds two lists the pool may not hold: `GAME_WORDS` and `PERSON_OR_TEAM_WORDS`. Nothing after s2 owns `rules`, so s6 reads these as they are.

## What I did meanwhile

`FIELD_CAPS` is summary 1200, title 90, whyItMatters 600, lesson 400 characters. `REFUSED_WORDS` is both kit lists copied word for word; `rules.test.mjs` fails when a copy and the kit's list part. `render`'s own words hold none of them (tested).

## What it costs to change later

Constants in one file, and `RULES_VERSION` bumped so every retro says which rules counted it. Dropping the person words would let a line that blames a role through.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long the model's summaries run in practice; the caps may drop good prose until they are tuned.
- (author) Whether the spec meant only the first list, since the person words make some prose about review threads harder to write.

```

<!-- /omni-outbox-settled: s2-04-prose-caps-and-refused-words -->

<!-- omni-outbox-settled: s2-05-waves-as-merged -->

## s2-05-waves-as-merged — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-05-waves-as-merged
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The retro compares the rounds of work the plan intended with the rounds that actually happened, but nothing says how to tell the real rounds apart. How should they be counted?

## The decision, in plain words

A new round starts when a piece of work is picked up after every piece of the current round has been merged or closed; otherwise it joins the current round. Times are counted in whole minutes, from the moment a piece is picked up to its merge.

## The intro, for fun

Counting rounds after the fact is like guessing the songs of a party from the empty glasses.

## The punchline, for fun

The rule is simple: no new round starts until the last glass is washed.

## The options, in plain words

A. A new round when work is picked up after the current round has all closed, in whole minutes, the option built.
B. Read each round from the report the wave leaves on the feature pull request.
C. Show only the planned rounds, and not guess the real ones.

## What I had to decide

How the timeline counts "waves as planned and as merged" and a slice's time. The spec's detector table names both and the median-time finding, but not how waves are recognised in GitHub's data, nor the unit of time. No record says which wave a sub-PR belonged to.

## What I did meanwhile

`wavesAsMerged` in `src/retro/kinds/timeline.mjs`: sub-PRs ordered by opening (the claim); one opened after every sub-PR of the current wave had closed starts the next wave. A slice's time is its sub-PR's opening to its merge, rounded to whole minutes; an unmerged sub-PR has no time. On PRD 50 this gives 2 waves planned and 2 as merged, 13, 20 and 21 minutes, and a median of 20.

## What it costs to change later

One function and its test. Reading waves from the claim commits or the wave's own report instead would need more reads from GitHub in the timeline's gather.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a wave that claims its slices one by one, merging each before claiming the next, should read as one wave; this rule reads it as several.

```

<!-- /omni-outbox-settled: s2-05-waves-as-merged -->

<!-- omni-outbox-settled: s2-06-retro-file-layout -->

## s2-06-retro-file-layout — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-06-retro-file-layout
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The spec sketches the retro page and says its data file keeps every run, but leaves open where each kind of problem is shown and how the data file is laid out. What layout should they have?

## The decision, in plain words

The page lists every problem once, worst first, then gives each kind its own section that refers back to its problems, then the rules used. The data file keeps one record per run, holding the counted facts, whether the model wrote anything, and the issue links, so every number on the page can be found in it.

## The intro, for fun

A retro page has to be read by people in a hurry and checked by people with a calculator.

## The punchline, for fun

So the page tells the story once, and the data file keeps the receipts for every number.

## The options, in plain words

A. Problems once, worst first, then a section per kind referring back, and one data record per run, the option built.
B. Each kind's problems written out in full inside its own section, with no single ranked list.
C. The same page, with a data file holding only the latest run.

## What I had to decide

The layout of `retro.md` and the shape of `retro.json`. The spec's sketch has Findings, Proposed lessons, Timeline, Decisions, Rules and After merge; the plan asks `render` to place "each kind's findings under the section that kind names", so no later slice edits it. The spec says only that `retro.json` "holds the fact sheet of every run", yet a later reader may compare it across PRDs.

## What I did meanwhile

`retro.md`: front matter, summary or "Facts only: <reason>", Findings (F1… ranked by `rules`, each with what happened, why it matters, lesson, evidence and its issue link), Proposed lessons, one section per kind in the registry's order (Timeline, Decisions, Checks, Churn; each kind's own lines, then "Findings: F2 · <title> · #issue"), Rules, then After merge. A kind with nothing to say has no section. `retro.json` is `{ prd, runs: [record] }`, a record being the fact sheet (`run`, `rules`, `prd`, `featurePr`, `kinds` by id, `findings`) plus `narration` (`model`, `reason`, `dropped`) and `issues` (finding id to number, url and state); a replay replaces the record of the same feature PR and run. Golden files pin both.

## What it costs to change later

Before any retro is merged into a repository, a change is `render` and its golden files. After, the retro files already merged keep the old layout, and anything reading `retro.json` across PRDs reads both shapes, told apart by each record's rules version.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the two sections the sketch does not name, Checks and Churn, are wanted as sections or only as findings.
- (author) A PRD with a second feature pull request: its record is kept in the data file, but the page shows only the latest feature pull request's runs, not one section per feature pull request as the spec asks.

```

<!-- /omni-outbox-settled: s2-06-retro-file-layout -->
