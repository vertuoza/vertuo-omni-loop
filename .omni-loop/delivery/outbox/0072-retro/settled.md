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

<!-- omni-outbox-settled: s3-01-checks-read-from-actions -->

## s3-01-checks-read-from-actions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-checks-read-from-actions
prd: 72
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec asks the retro to read the result of every check on every commit of a slice, yet also says the retro never reads a check result. Where should the retro read those results from?

## The decision, in plain words

The retro reads the runs of the repository's own automated workflows, their jobs and the end of each failed job's log, and nothing else. Checks that other services post, such as the outbox check or a preview deployment, are not counted.

## The intro, for fun

Two lines of the spec pulled in opposite directions, like a door marked both push and pull.

## The punchline, for fun

So the retro used the side door: the workflow logs, where failing tests leave their names anyway.

## The options, in plain words

A. Read only the repository's own automated workflows and their logs, the option built.
B. Read every service's check results too, leaving out only the outbox check, and loosen the earlier test that forbids reading any check result.
C. Read both: the workflows for their logs, and the other services' results for counting only.

## What I had to decide

Which GitHub API the checks kind's `gather` reads CI from. The spec's detector table and decision 6 ask for "check runs on every sub-PR commit plus the last lines of each failed job's log", while its Flow and decision 14 say the retro "never reads or writes a check run", which s2 pinned in `apps/omni-app/src/retro/retro.test.mjs` as no request whose route names `check-runs`. The plan's done-when for s3 names no API.

## What I did meanwhile

`kinds/ci.mjs` reads `GET /repos/{owner}/{repo}/actions/runs?branch=<slice branch>` for every slice branch, `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs?filter=all` for every run (every attempt's jobs), and `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` for red jobs only; a check is a job's name. Red is `failure`, `timed_out` or `startup_failure`; a `cancelled` or `skipped` job is no run. A 403 on a slice's runs is named in the Checks section ("Not read: the runs of s3 (GitHub answered 403). The app reads them with the `actions: read` permission."), a 404 reads as a slice with no run, anything else fails the step for Inngest to retry. GitHub serves no part of a log, so each red job's log is downloaded whole and only its last `LIMITS.logTailLines` (200) lines, cleaned of timestamps and colour codes, are kept in the step's output. Jobs and logs are read four at a time. The end-to-end test in `kinds/ci.test.mjs` pins that no route names `check-runs`.

## What it costs to change later

One `gather` and its tests. Reading `GET /repos/{owner}/{repo}/commits/{ref}/check-runs` instead gives records of the same shape (an Actions job's check run carries the job's name), but needs s2's route test narrowed to the outbox check's own run, and each sub-PR's commits listed first. The finding ids stay the same, so retro issues already opened are found again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether decision 14's "never reads a check run" meant only the outbox check's own run, which is what the sentence around it is about.
- (author) Whether the repositories the loop runs in post their CI through a service other than GitHub Actions; that CI goes uncounted.

```

<!-- /omni-outbox-settled: s3-01-checks-read-from-actions -->

<!-- omni-outbox-settled: s3-02-log-lines-travel-with-evidence -->

## s3-02-log-lines-travel-with-evidence — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-log-lines-travel-with-evidence
prd: 72
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The model is to see the end of each failed log beside the problem it explains, but nothing says where those lines are kept for it. Where should they go?

## The decision, in plain words

Each link to a failed run carries that run's last lines, so the model gets them with the problem they explain. The retro page shows only the links, while its data file keeps the lines.

## The intro, for fun

Every log line wanted a seat right next to the problem it could explain.

## The punchline, for fun

It got one, tucked behind each link, where the page never shows it.

## The options, in plain words

A. Each link to a failed run carries its last lines, the option built.
B. Keep the lines only in the checks part of the data file, and have the model's step look them up there.
C. Keep a separate list of excerpts on each problem, apart from its links.

## What I had to decide

Where the failed jobs' log tails live in the fact sheet, so that `narrate` (slice s6, built at the same time) can send them. `narrate` receives only `{ sheet, prd }` (its contract in `apps/omni-app/src/retro/narrate.mjs`); the spec says the model gets "per finding its id, its facts and its evidence excerpts (failed-job log tails of about 200 lines…)"; the registry in `kinds/index.mjs` types evidence as `{ label, url }`.

## What I did meanwhile

Every evidence item of a `repeated-red`, `flaky` or `failing-test` finding that points at a red job whose log was read carries `excerpt`: that log's last lines, cleaned. `render` writes only `[label](url)`, so `retro.md` shows no log line (tested); `retro.json` keeps them, once per finding citing the run, so a run cited by a repeated-red and a failing-test finding is kept twice. The kind's facts keep a log's lines themselves only when no reporter was read (`kinds.ci.redRuns[].excerpt`), as the spec's "any other format keeps its excerpt" asks. Nothing is masked here: `narrate` masks token-shaped strings before sending.

## What it costs to change later

A few lines in `kinds/ci.mjs` and its tests if `narrate` looks elsewhere. Before any retro is merged, nothing else; after, the `retro.json` files already merged keep the excerpts where they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Where s6's `narrate` and `guard` look for evidence excerpts; they were built at the same time, without this.
- (author) How large `retro.json` grows for a delivery with many red runs; each excerpt is at most 200 lines, and nothing caps how many.

```

<!-- /omni-outbox-settled: s3-02-log-lines-travel-with-evidence -->

<!-- omni-outbox-settled: s3-03-one-name-per-failing-test -->

## s3-03-one-name-per-failing-test — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-one-name-per-failing-test
prd: 72
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The four test tools each name a failing test in their own way, and one test must carry the same name from run to run to be counted twice. How should the names be made alike?

## The decision, in plain words

A test is named by its file, its groups and its title, joined the same way whatever tool ran it, without the line numbers one tool adds. Only tests that finally failed count, not a test that failed and then passed on a retry within the same run.

## The intro, for fun

Four tools, four accents, and one test that has to be recognised in all of them.

## The punchline, for fun

The retro taught them one spelling, and the line numbers were left in the cloakroom.

## The options, in plain words

A. One naming for all four tools, line numbers left out, only final failures counted, the option built.
B. The same naming, also counting a test that failed and then passed on a retry within one run.
C. Each tool's own naming as printed, line numbers included, so one test may carry several names.

## What I had to decide

How `readTestLog` in `apps/omni-app/src/retro/kinds/ci-logs.mjs` names a test. A `failing-test:<test>` finding counts one name across red runs, and its id, hence its retro issue found again by its marker, is built from that name. The spec says only "test names parsed from failed-job log tails for Vitest, Jest, Playwright and pytest".

## What I did meanwhile

The separators ` › ` and ` > ` both become ` > `, and whitespace is collapsed. Vitest: its `FAIL  <file> > <suite> > <test>` lines (a file that failed to load, by its file alone), or the `×` lines under their `❯ <file>` when the tail was cut before them. Jest: each `● <suite> › <test>` under its `FAIL <file>`, a "Test suite failed to run" named by its file, `● Console` and warnings skipped. Playwright: the tests its summary lists under "N failed", the project kept (`[chromium]`), `:line:col` and `(retry #n)` dropped, the flaky ones not counted. pytest: the `FAILED <node id>` lines of the short summary, `ERROR` lines not counted. Counts come from each tool's summary line; a log no reader recognises gives no name and no count. Fixtures for all four and an unknown format are in `kinds/ci.fixtures/`.

## What it costs to change later

One pure module and its tests. Once retros have opened issues, a different naming changes the `failing-test` ids: a finding then gets a second issue, and the first stays open until someone closes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a test that failed and then passed on a retry inside one run (Playwright's flaky) should count toward a failing test; here it does not.
- (author) Whether pytest's errors in setup or collection should count as failing tests; here they do not.

```

<!-- /omni-outbox-settled: s3-03-one-name-per-failing-test -->

<!-- omni-outbox-settled: s4-01-churn-counts-merged-work -->

## s4-01-churn-counts-merged-work — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-churn-counts-merged-work
prd: 72
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the retro adds up the lines written across every change and compares them with what stayed in the end, but not which changes count, nor whether the first writing of some lines counts as one of the three times they were rewritten. How should they be counted?

## The decision, in plain words

The retro counts the changes of every piece of work merged into the feature, in the order it was merged, and leaves out work that was never merged. Some lines count as rewritten again and again when three changes wrote them, the first writing included; lines only added beside them do not rewrite them.

## The intro, for fun

Counting how often code was rewritten starts with a harder question: which drafts count as drafts?

## The punchline, for fun

Only the ones that made it to the fridge door, and the very first draft counts too.

## The options, in plain words

A. Merged work only, in the order it was merged, the first writing counted among the three, the option built.
B. The same, counting only the rewrites after the first writing, so some lines need four changes in all.
C. Also count work that was never merged, since that code was written and thrown away too.

## What I had to decide

Which commits `kinds/churn.mjs` reads and in which order, what "the final diff" is, and whether "a range rewritten in 3 or more commits" (`THRESHOLDS.churnRangeCommits`) counts the commit that first wrote it. The spec ("The facts, and what makes a finding") says churn counts "per file, lines added across all commits minus lines added in the final diff; per line range, the commits that rewrote it, line numbers followed through each commit's hunks"; its units table says `gather` reads "sub-PRs, their commits with patches". Neither names the commits, their order or the first write.

## What I did meanwhile

`gather` reads the commits of every pull request merged into the feature branch (the sub-PRs, and a rework or settle PR into it), skips a commit with two parents (a merge of the feature branch into a slice branch, whose diff repeats merged work), and never reads a pull request that was not merged, which the section names as not counted. The final diff is the feature PR's own files. `detect` walks the pull requests by merge time and each one's commits as GitHub lists them. Each line keeps every commit that wrote it, the first included; a block that replaces lines passes their commits on; a line only inserted carries its own commit. Commits made on the feature branch itself (a wave's adoption, the ship) are not read.

## What it costs to change later

A filter and a comparison in `kinds/churn.mjs`, and the fixture's expectations: counting only the rewrites after the first write is `churnRangeCommits` read as one more; counting work never merged is one filter. Retros already merged keep the counts they were made with.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether "rewritten in 3 or more commits" meant three rewrites after the first write, or three commits in all.
- (author) Two slices of one wave changing the same file are walked one after the other, as merged, though each was written against the file before the other merged; line numbers in such a file are approximate.

```

<!-- /omni-outbox-settled: s4-01-churn-counts-merged-work -->

<!-- omni-outbox-settled: s4-02-churn-keeps-no-code-text -->

## s4-02-churn-keeps-no-code-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-churn-keeps-no-code-text
prd: 72
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the model is shown the changed lines of each part rewritten again and again, but keeping the text of every change between two steps can outgrow what the job queue stores for one step. What should the retro keep of each change?

## The decision, in plain words

The retro keeps where each change sits and how many lines it touched, never the text of the code, so it fits however large the feature is. The model is told which lines were rewritten, by which changes, with links, but is not shown the code itself.

## The intro, for fun

The model asked to read the code, but the suitcase between two steps only fits a list of line numbers.

## The punchline, for fun

So it travels light: where each change sits, how big it was, and a link for anyone curious.

## The options, in plain words

A. Keep where each change sits and its size, never the code, the option built.
B. Keep also the code of the last change to each flagged part, read again in a step of its own after the counting.
C. Keep the code of every change between steps, accepting that a very large feature may not be counted.

## What I had to decide

What `gather` in `kinds/churn.mjs` hands `detect` for each file of each commit. The spec's model input includes "the hunks of churn ranges" ("The model, and the guard"), and its units table says `gather` returns "commits with patches". Each step's output is stored by Inngest, which refuses one over its size limit; the patches of a delivery of a hundred commits can pass it.

## What I did meanwhile

`gather` reduces each patch to its change blocks, `[oldStart, oldCount, newStart, newCount]`, and keeps no line of text; `churn.test.mjs` pins that no patch text reaches the records. Each finding carries its commit links and a link to the file, or the range, at the feature PR's head. No excerpt of the code reaches the fact sheet, so `narrate` (slice s6) has no hunk to send for a churn finding.

## What it costs to change later

Showing the model the code of each flagged range is one more field on a range finding, filled by reading those commits again after the counting, in a step the function (`retro.mjs`, slice s8's ground) would add; or by keeping every patch's text in the records and risking the step limit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The step output limit of the Inngest plan the app runs on.
- (author) How slice s6 means to find the hunks it sends the model, since the kinds' contract names no excerpt field.

```

<!-- /omni-outbox-settled: s4-02-churn-keeps-no-code-text -->

<!-- omni-outbox-settled: s4-03-churn-leaves-out-tool-written-files -->

## s4-03-churn-leaves-out-tool-written-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-churn-leaves-out-tool-written-files
prd: 72
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the retro leaves out files that tools write to record exact versions, and files marked as generated, but names neither those files nor what to show when the code host sends back none of the history. Which files, and what then?

## The decision, in plain words

The retro leaves out the version records of the common package tools, by name, and whatever the repository's root attributes file marks as generated. When the code host returns none of the history, the retro leaves this section out rather than show zeros, and its data file says what could not be read.

## The intro, for fun

Some files are written by machines for machines, and counting their rewrites is like grading a photocopier.

## The punchline, for fun

So those files stay out of the count, and an empty history gets no section of its own.

## The options, in plain words

A. The common version records by name and the root attributes file, no section when nothing could be read, the option built.
B. The same, with one line saying this part could not be counted when nothing was read.
C. Only the version record of the tool this repository uses, and the attributes files of every folder.

## What I had to decide

`LOCKFILES` in `kinds/churn-generated.mjs`, which `.gitattributes` `gather` reads, and what `describe` shows when GitHub returns no commit. The spec ("The facts, and what makes a finding") says churn leaves out "paths marked `linguist-generated` in `.gitattributes` at the merge SHA, and lockfiles by name", naming neither the names nor the case where nothing could be read.

## What I did meanwhile

`LOCKFILES` holds 22 names (pnpm, npm, yarn, bun, deno, Cargo, Bundler, Composer, Poetry, Pipenv, uv, PDM, Go, Mix, pub, CocoaPods, SwiftPM, NuGet, Nix, Gradle), matched by file name at any depth. Only the root `.gitattributes` at the merge is read, by git's pattern rules: a later line wins, `-linguist-generated` unsets. A pull request whose commits GitHub answers 404, a commit it answers 404 or 422, and a final diff it answers 404 are named in the section as not read; when no commit at all was read the section is left out, so the PRD 50 recording, which holds no commits, keeps its golden retro, and `retro.json` still keeps what was not read.

## What it costs to change later

One constant to extend. Reading the `.gitattributes` of every folder is one more read per folder holding one. A line saying churn could not be counted changes `describe` and the PRD 50 golden retro.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which package managers the repositories running the loop use besides pnpm.
- (author) Whether a retro should say plainly that this part could not be counted rather than leave its section out.

```

<!-- /omni-outbox-settled: s4-03-churn-leaves-out-tool-written-files -->

<!-- omni-outbox-settled: s5-01-shared-ground-is-computed -->

## s5-01-shared-ground-is-computed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-shared-ground-is-computed
prd: 72
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When a slice changes a file outside the ground it declared, the retro leaves the change unflagged if that ground is shared. Should shared ground be what two slices both declare in the plan's table, or whatever the plan's note about sharing mentions?

## The decision, in plain words

Shared ground is worked out from what the slices declare: ground that two slices both claim. A path the plan's note only mentions in passing does not count.

## The intro, for fun

Two neighbours sharing a garden path is fine, as long as the map agrees on where the path is.

## The punchline, for fun

So the retro reads the fences the slices drew, not the chatter over them.

## The options, in plain words

A. Shared ground is what two slices both declare, worked out from the plan's table, the option built.
B. Shared ground is every path the plan's note about sharing mentions, as written.
C. Both: what two slices declare, plus what the note mentions.

## What I had to decide

What `territoryFacts` treats as the plan's shared ground when it grades a breach. The spec says a finding is "any breach the plan does not list as shared ground"; the plan skill says the shared-ground note lists "each prefix more than one slice declares", in prose. PRD 72's note names `apps/omni-app/src/retro/` and `apps/omni-app/test/fixtures/` in one paragraph, the second precisely to say it is not shared; PRD 50's note names `kit/lib/outbox/` to say s1 stays clear of it. Read as a list, either note would unflag ground it meant to fence off.

## What I did meanwhile

Shared ground is every prefix the kit's `collisions(parsePlanSlices(plan))` finds between two slices' territories (through `sharedGround`). A path outside its slice's territory but under shared ground is counted in the facts (`territory.counts.shared`, and per sub-PR) and never becomes a finding. The PRD's own outbox folder is every slice's ground, since `/omni:do-work` allows item and account files there. PRD 50 gives `kit/dist/omni.mjs` as its shared ground and no breach.

## What it costs to change later

One function, `territoryFacts` in `apps/omni-app/src/retro/kinds/delivery.facts.mjs`, and its tests; retros already merged keep the counts they were made with.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a plan's note is meant to declare ground its table does not, for a file no slice lists in its territory.
- (author) Whether ground that one slice's territory wholly contains (PRD 72's `apps/omni-app/src/retro/`, around the wave-3 prefixes) should count as shared, since the kit's `sharedGround` names the wider prefix.

```

<!-- /omni-outbox-settled: s5-01-shared-ground-is-computed -->

<!-- omni-outbox-settled: s5-02-second-claim-is-a-second-sub-pr -->

## s5-02-second-claim-is-a-second-sub-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-second-claim-is-a-second-sub-pr
prd: 72
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

A slice counts as claimed twice only when it had two pull requests, because a quiet claim taken over in place leaves no lasting mark. Is that good enough, or should the loop leave a mark when it takes a claim over?

## The decision, in plain words

The retro counts a second claim when one slice had two or more pull requests. A takeover in place goes uncounted, and the retro cannot tell it happened.

## The intro, for fun

Claiming a seat twice is easy to spot when there are two coats on it.

## The punchline, for fun

When the second claim just sits on the first coat, nothing shows.

## The options, in plain words

A. Count a slice's pull requests only, the option built.
B. Also read the edit history of each status comment for the takeover line.
C. Ask the loop to leave a lasting mark on every takeover, and count that.

## What I had to decide

What `frictionFacts` counts as "a second claim of the same slice" (spec, Agent friction). A new claim after a closed sub-PR opens a second sub-PR for the slice. A stale claim is taken over in place by `/omni:wave`, which adds the in-progress label (already there) and rewrites the status comment with "taken over from a stale claim", a line the next rewrite of that comment erases and no event records.

## What I did meanwhile

A slice's claims are the sub-PRs whose head is its slice branch, from the pull requests the retro already reads. The count is a fact (`friction.counts.reclaimed`, and `claims` per slice), named in the finding of a slice that also went stuck or needed a fix, and never a finding on its own, as the spec's table says ("any stuck or needs-fix slice"). The status comment is not read.

## What it costs to change later

A read of each status comment's edit history, or a lasting mark left by `/omni:wave` on a takeover (a label or an empty commit, a kit change), then one more check in `frictionFacts`; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `/omni:wave` should leave a lasting mark when it takes over a stale claim, a kit change outside this PRD.

```

<!-- /omni-outbox-settled: s5-02-second-claim-is-a-second-sub-pr -->

<!-- omni-outbox-settled: s5-03-stub-tests-follow-the-delivery-kind -->

## s5-03-stub-tests-follow-the-delivery-kind — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-stub-tests-follow-the-delivery-kind
prd: 72
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Two checks written with the retro's skeleton expected this part of the retro to find nothing, and the saved example retro had no section for it. Now that it finds things, should those two checks change with it?

## The decision, in plain words

The check that every unbuilt part finds nothing now skips this part, and the saved example retro was rebuilt with its new section. The recorded example itself is untouched.

## The intro, for fun

The scaffolding said the room was empty, so of course it objected when the furniture arrived.

## The punchline, for fun

It has been told about the sofa, and still expects the other rooms to be bare.

## The options, in plain words

A. Change both checks with this slice and rebuild the golden file, the option built.
B. Leave both to be changed once the whole wave has merged, with this slice's checks red until then.

## What I had to decide

Whether this slice may change two files outside its territory, both s2's: the registry test in `apps/omni-app/src/retro/detect.test.mjs` asserts that every kind but the timeline gathers `null` and finds nothing, and `apps/omni-app/test/fixtures/prd-50/retro.golden.md` pins the PRD 50 retro without a Decisions section. The plan says no wave-3 slice edits the registry, the function or `render`, and that s5 reads the PRD 50 recording without writing to it; it says nothing of these two, and `pnpm test` is red without them.

## What I did meanwhile

`detect.test.mjs` leaves `delivery` out of the stub check, as it already left the timeline out. `retro.golden.md` was rebuilt with `UPDATE_GOLDEN=1`, which adds only the Decisions section; `recording.json` is unchanged. The wave's checks and churn slices will likely change the same two files: merging them is a conflict resolved by rebuilding the golden file once all are in.

## What it costs to change later

One line of a test and one golden file, rebuilt by `UPDATE_GOLDEN=1 pnpm test` once the wave has merged.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the golden file beside the PRD 50 recording counts as part of the recording that this slice must not write to.

```

<!-- /omni-outbox-settled: s5-03-stub-tests-follow-the-delivery-kind -->

<!-- omni-outbox-settled: s6-01-model-asked-three-times-in-four-minutes -->

## s6-01-model-asked-three-times-in-four-minutes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-model-asked-three-times-in-four-minutes
prd: 72
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the retro goes out with the facts only once the model has failed after its retries, but the step that asks the model cannot fail without failing the whole retro. How often, and for how long, should the model be asked?

## The decision, in plain words

The model is asked up to three times, a few seconds apart, when it is busy or down, all within four minutes, and the part of the app that runs it may now run for five. After that the retro goes out with the facts only, saying the model was unavailable.

## The intro, for fun

Asking a busy model for words is like calling a bakery during the morning rush.

## The punchline, for fun

Three rings, a short wait between each, then the retro leaves with plain toast.

## The options, in plain words

A. Three tries within four minutes, in a part of the app that may run for five, the option built.
B. Let the step fail and be tried again by the job runner, which needs the retro's wiring changed so a failure still ends in a facts-only retro.
C. Ask once, and go out with the facts only on the first failure.

## What I had to decide

How the model call is retried, and how long it may take. The spec ("Failures") says that when "the model call fails after the step's retries" the retro goes out "Facts only: model unavailable (<status>)", and asks `vercel.json`'s `maxDuration` for `api/inngest.mjs` to be "raised above 60 seconds" without naming a value. The seam s2 wired calls `narrate` inside `step.run('narrate')` with no try/catch (`src/retro/retro.mjs`, outside this slice): a throw from `narrate` would fail the run after Inngest's retries and post "The retro could not run" instead of a facts-only retro.

## What I did meanwhile

`narrate` never throws. `MODEL_CALL` in `src/retro/narrate.mjs`: 3 tries in all on a network error, a 408, a 429 or a 5xx, 1 s then 4 s apart; a 401 or another 4xx is not tried again; every try and the one repair share a 240 s budget, enforced with `AbortSignal.timeout`. `vercel.json` names `api/inngest.mjs` at `maxDuration: 300` and `api/github.mjs` at the 60 it had, in place of the `api/*.mjs` glob. `retro.md`'s front matter names the model asked even when it was unavailable, beside "Facts only: model unavailable (500)". Tests pin the budget under `maxDuration`, every file under `api/` named, and a stubbed 500 through the real function giving facts only and no failure comment.

## What it costs to change later

Constants in one file and one number in `vercel.json`. Retrying through Inngest instead needs a try/catch around the step in `retro.mjs`, slice s8's ground in wave 4.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The Vercel plan the app is deployed on: 300 seconds is the most a Hobby project gets with fluid compute, and a plan allowing less refuses the deploy.
- (author) How long Claude Opus 5.5 takes through OpenRouter to write a retro from 40,000 tokens of input.

```

<!-- /omni-outbox-settled: s6-01-model-asked-three-times-in-four-minutes -->

<!-- omni-outbox-settled: s6-02-evidence-excerpt-beside-its-link -->

## s6-02-evidence-excerpt-beside-its-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-evidence-excerpt-beside-its-link
prd: 72
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the model reads each finding's evidence, such as the end of a failed log or the lines of code rewritten, but nothing says where each kind of finding puts those extracts. Where should they go?

## The decision, in plain words

Each piece of evidence may carry its extract beside its link, listed oldest first. When the input grows too long, older logs go first, then rewritten code, then comments, and the latest log of each check always stays.

## The intro, for fun

The findings packed their clippings, but the suitcase had no pocket labelled for them.

## The punchline, for fun

So each clipping rides beside its link, and the oldest ones step off first when it gets crowded.

## The options, in plain words

A. An extract beside each piece of evidence, listed oldest first, the option built.
B. A separate list of extracts on each finding, each with the time it was taken, so its age is read rather than assumed from the order.
C. No extracts at all: the model reads only the facts and the links, and writes shorter prose.

## What I had to decide

Where `narrate` reads evidence excerpts from. The `Finding` contract in `src/retro/kinds/index.mjs` is `{ id, kind, title, happened, evidence: [{ label, url }] }` and names no excerpt; slices s3, s4 and s5 build the kinds in parallel with this one. The spec ("The model, and the guard") asks for "its evidence excerpts (failed-job log tails of about 200 lines, the hunks of churn ranges, the text of stuck and review comments)", capped so that "older attempts' logs go first, then hunks, and the latest failure of each check always stays".

## What I did meanwhile

`modelInput` in `src/retro/narrate.mjs` reads an optional `excerpt` string on each evidence item. A finding's `source` (its kind's registry id, set by `detect`) says what an excerpt is: `ci` a log tail, `churn` a hunk, any other a comment; a `ci` finding's last excerpt is its latest failure. Tokens are counted as 4 characters against `LIMITS.modelInputTokens`. Past the cap, older `ci` excerpts go (oldest first), then `churn` ones, then the rest (least severe finding first); then the latest logs are cut to their last lines, then the least severe findings. Until a kind sets `excerpt`, the model gets each finding's facts, labels and links only.

## What it costs to change later

One reader in `narrate.mjs` if the kinds put excerpts elsewhere; for the kinds, one optional field per evidence item.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s3, s4 and s5 give their evidence an excerpt and list it oldest first: none had pushed code when this was built.
- (author) How closely four characters a token matches the model's own count on log output.

```

<!-- /omni-outbox-settled: s6-02-evidence-excerpt-beside-its-link -->

<!-- omni-outbox-settled: s6-03-what-the-guard-counts-as-copied -->

## s6-03-what-the-guard-counts-as-copied — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-what-the-guard-counts-as-copied
prd: 72
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec lets the model's writing hold a number only inside a quoted name copied from the evidence. What counts as copied, and may the model point to the evidence it was given?

## The decision, in plain words

A quoted name counts as copied when it appears word for word in the evidence, or is the name of a finding, and holds at least one letter, so a bare number never passes. A link to the evidence is let through, any other link drops the sentence, and a refused sentence is replaced by a line giving the reason, never the refused words.

## The intro, for fun

A number in quotes is still a number, even when it dresses up as a name.

## The punchline, for fun

So a quoted name gets in only with a letter in it, and its ticket must match the evidence.

## The options, in plain words

A. Names copied from the evidence that hold a letter, and links to the evidence, let through, the option built.
B. Only quoted names let through, so a sentence with any link is dropped for its digits.
C. Any quoted text found in the evidence let through, bare numbers included.

## What I had to decide

`guard`'s digit and link rules. The spec says a field is dropped when it "holds a digit, once backtick spans copied verbatim from the evidence are set aside" and when it "carries a link that is not one of the evidence URLs". An evidence URL almost always holds digits, so read literally no link could pass; and a span like `7001` is verbatim inside a run's URL, so read loosely any number from a URL could pass.

## What I did meanwhile

`guard` in `src/retro/guard.mjs`: the evidence is every finding's evidence labels, URLs and excerpts, plus the finding ids. A backtick span is set aside when it holds a letter and appears in that evidence; an evidence URL is set aside too. A field breaking several rules is dropped for the first, in the order not text, too long, refused word, foreign link, unknown finding, digit. Reasons are fixed sentences (`DROPPED`: "it holds a digit"…) that never quote the model. A refused lesson of the list keeps its place as the line `render` writes for any dropped field (`_Dropped: <reason>._`), citing only findings the retro found, since the prose contract has no dropped form for it. Refused words are checked on the whole field, spans included.

## What it costs to change later

Constants and one function in `guard.mjs`, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec meant links to the evidence to be dropped for their digits; the model is asked for no links at all, so this seldom matters.

```

<!-- /omni-outbox-settled: s6-03-what-the-guard-counts-as-copied -->

<!-- omni-outbox-settled: s6-04-replay-test-stubs-the-model -->

## s6-04-replay-test-stubs-the-model — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-04-replay-test-stubs-the-model
prd: 72
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

A test written by the slice before this one runs the retro a second time with a model key set, only to make the retro change, and now that a key makes the retro ask the model, that test would reach the real service. Should that test change?

## The decision, in plain words

That one test now puts a stand-in for the model's service in place for its second run, answering that the key is refused. It still checks what it checked: the second retro is added on top of the first, never written over it.

## The intro, for fun

A test borrowed a key just to rattle the doorknob, and now the door really opens.

## The punchline, for fun

So it gets a cardboard door instead, one that says no politely every single time.

## The options, in plain words

A. Stub the model's service in that one test, the option built.
B. Stub it for every test of the suite, in a shared setup file.
C. Make the second run change the retro some other way, with no key set.

## What I had to decide

Whether to edit `src/retro/retro.test.mjs`, outside this slice's territory (s2 wrote it; `retro.` is slice s8's ground in wave 4). Its test "adds a commit on top of the first instead of rewriting it when the retro changed" runs with `env: { OPENROUTER_API_KEY: 'k' }`. With `narrate` built, that sends a real request to OpenRouter, which no test may do, and a network error there is retried with pauses past the test's timeout.

## What I did meanwhile

That test stubs `fetch` with `vi.stubGlobal` for its second run, answering 401 (never retried), and unstubs it after; nothing else in the file changes, and all its tests pass. `narrate.test.mjs` runs the real function with a stubbed `fetch` for the 500 and the reply cases.

## What it costs to change later

A few lines of one test. Keeping the test untouched instead needs a stub installed for every test, in a root setup file, also outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether slice s8, which owns that file in wave 4, would rather keep the stub in a shared test helper.

```

<!-- /omni-outbox-settled: s6-04-replay-test-stubs-the-model -->

<!-- omni-outbox-settled: s7-01-issue-routes-in-the-shared-test-double -->

## s7-01-issue-routes-in-the-shared-test-double — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-issue-routes-in-the-shared-test-double
prd: 72
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Opening retro issues for real made two tests owned by other parts of this work fail, because the stand-in for GitHub they share knew nothing of issues. Should those two files change here?

## The decision, in plain words

The stand-in for GitHub now answers the requests for issues, and one test of the retro as a whole now expects the one issue its example earns. Nothing else in either file changed.

## The intro, for fun

The stand-in for GitHub had a drawer marked issues, but no handle to open it.

## The punchline, for fun

It has a handle now, and the drawer finally holds something.

## The options, in plain words

A. Extend the shared stand-in for GitHub with the three issue requests, and update the one count in the retro's own test, the option built.
B. Keep the issue requests in a stand-in of this slice's own, and point the retro's own test at it, so the shared stand-in is never touched.
C. Open no issue when GitHub cannot list issues, so the shared stand-in stays as it was, at the price of hiding a real failure.

## What I had to decide

Whether to edit `apps/omni-app/test/github-replay.mjs` (s2's ground, `apps/omni-app/test/`) and `apps/omni-app/src/retro/retro.test.mjs` (the function file's prefix, `apps/omni-app/src/retro/retro.`, s8's in wave 4), both outside s7's territory `apps/omni-app/src/retro/issues`. The double kept `state.issues` and could label an issue, but answered no issue route, so any finding made the `publish-issues` step fail with a 404; and `retro.test.mjs` asserted `issues: 0` for the widget scenario, whose slow slice now gets its issue.

## What I did meanwhile

The double answers `GET /repos/{owner}/{repo}/issues` (by label and state, pull requests included and marked `pull_request`, as GitHub lists them), `POST /repos/{owner}/{repo}/issues` and `PATCH /repos/{owner}/{repo}/issues/{issue_number}`, sharing its number counter with pull requests. `retro.test.mjs` expects `issues: 1` instead of `0`. Its other tests and the PRD 50 recording test pass unchanged.

## What it costs to change later

A constant: twenty lines of test support and one number in one test. Keeping the issue routes in a wrapper under `issues.fixtures/` instead would still change `retro.test.mjs`, since it builds its double through `widgetScenario`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the shared double to be extended by whichever wave-3 slice first needs a route, or to stay s2's alone; s3 to s5 may add routes to the same file, and the wave merges their additions.

```

<!-- /omni-outbox-settled: s7-01-issue-routes-in-the-shared-test-double -->

<!-- omni-outbox-settled: s7-02-retro-pr-named-once-it-is-open -->

## s7-02-retro-pr-named-once-it-is-open — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-retro-pr-named-once-it-is-open
prd: 72
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Each retro issue is meant to name the retro pull request, but the issues are opened just before that pull request exists. What should the first issues say?

## The decision, in plain words

An issue names the retro pull request only once one is open, so from a later run of the same retro on; the first time, it names the request being looked back on and the merged feature only. The pull request lists every issue, so the two are still linked.

## The intro, for fun

The issues arrive a moment before the pull request they are meant to introduce.

## The punchline, for fun

So the introductions wait for the next visit, when everyone is finally in the room.

## The options, in plain words

A. Name the retro pull request only once it is open, the option built.
B. Once the pull request opens, go back and add its number to each open issue, in one more step of the retro.
C. Name the retro's branch instead, which is known from the start but goes away once the pull request is merged.

## What I had to decide

The spec's issue header reads `**Retro of PRD 50** (#50 · feature PR #51 · retro PR #…) · F1`, while the function runs the step `publish-issues` before `publish`, so the retro PR's number is unknown when the issues are first written. The function and `publish` are outside s7's territory (s8 owns both in wave 4).

## What I did meanwhile

`publishIssues` reads the pull requests from the retro branch (`branches.retro` with the topic) and names the open one, else the latest, in the header; with none, the header reads `(#7 · feature PR #12) · F1`. A replay or a later run rewrites the open issues with the number.

## What it costs to change later

A constant: one part of the header. Naming the PR on the first run needs a step after `publish` that rewrites the open issues, in the function (s8's territory).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `retro PR #…` in the spec was a placeholder for the number, or meant a link that can only come once the pull request is open.

```

<!-- /omni-outbox-settled: s7-02-retro-pr-named-once-it-is-open -->

<!-- omni-outbox-settled: s7-03-retro-issues-found-by-their-label -->

## s7-03-retro-issues-found-by-their-label — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-retro-issues-found-by-their-label
prd: 72
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

To avoid opening the same issue twice, the retro looks for the one it opened before. Where should it look?

## The decision, in plain words

It looks among the issues carrying the retro label, open or closed. An issue whose label was removed by hand is no longer found, and the next run opens a fresh one.

## The intro, for fun

Finding an old note is easy when it wears a name tag.

## The punchline, for fun

Take the tag off, and the retro writes a brand new note, very politely.

## The options, in plain words

A. Look among the issues carrying the retro label, the option built.
B. Look among every issue of the repository, slower on a large one but blind to labels.
C. Use GitHub's search, quick but sometimes a few seconds behind, so a quick retry could open a twin.

## What I had to decide

The spec says: 'Before it creates an issue the app looks for one carrying the same PRD and finding id'. It does not say where. GitHub's issue search lags behind, so a retry seconds after a half-done step can miss an issue it just opened; listing every issue of a repository is slow on a large one.

## What I did meanwhile

`publishIssues` lists `GET /repos/{owner}/{repo}/issues` with `labels` set to `labels.retro` and `state: all` (at most `MAX_PAGES` pages), leaves pull requests out, and matches the marker `<!-- <markers.prefix>-retro: prd=<n> finding=<id> -->`. With several matches the open one wins, then the oldest. An open match is rewritten only when its title or body changed; a closed one is not written to at all.

## What it costs to change later

A constant: the list's filter. Widening it to every issue of the repository costs more reads per run and stores nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How often a retro issue loses its label by hand while staying in use, which is when a second one would be opened.

```

<!-- /omni-outbox-settled: s7-03-retro-issues-found-by-their-label -->

<!-- omni-outbox-settled: s7-04-issue-lesson-gathers-cited-lessons -->

## s7-04-issue-lesson-gathers-cited-lessons — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-04-issue-lesson-gathers-cited-lessons
prd: 72
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The model may propose a lesson for one finding, and apart from it a few lessons that each point at several findings. Which should a finding's issue show?

## The decision, in plain words

Both: the finding's own lesson first, then every shared lesson that points at it. With no lesson at all, the issue says none was proposed, and adds that the retro has facts only when it has.

## The intro, for fun

A lesson that points at three findings has three front doors to knock on.

## The punchline, for fun

It knocks on all three, so no issue has to guess the lesson was meant for it.

## The options, in plain words

A. Show the finding's own lesson, then the shared lessons pointing at it, the option built.
B. Show only the finding's own lesson, and leave the shared ones to the retro file.
C. Show only the shared lessons, so one lesson reads the same wherever it appears.

## What I had to decide

The spec's issue body has one `## Proposed lesson` section, and the model's reply carries a per-finding `lesson` (optional) and a `lessons` list, each citing finding ids. The spec does not say which of them the issue shows.

## What I did meanwhile

`renderIssue` writes the finding's own `lesson` (or the line naming why it was dropped), then each `lessons` entry citing the finding as a bullet; with neither, `None proposed.`, or `None proposed: facts only.` without prose. `issues.golden/issue-prose.md` pins it.

## What it costs to change later

A constant: which lessons one function gathers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `/omni:retro-apply` will want the finding's own lesson apart from the shared ones; the YAML block carries neither today, as the spec shows it.

```

<!-- /omni-outbox-settled: s7-04-issue-lesson-gathers-cited-lessons -->
