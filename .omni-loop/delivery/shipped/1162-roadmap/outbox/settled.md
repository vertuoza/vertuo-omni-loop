# Settled outbox items — PRD 1162

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-roadmap-push-shape -->

## s2-01-roadmap-push-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 1
- Became: ADR-0085

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-roadmap-push-shape
prd: 1162
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

The spec lists what a stored roadmap holds, but not its open questions, how a waiting PRD names what it waits on, or what a PRD whose work was closed without merging looks like. What should the app keep?

## The decision, in plain words

The app keeps each roadmap's open questions with any answer given, so the page can show them and the answer box; a waiting PRD keeps one line naming what it waits on plus its link; and a PRD can be marked closed, beside waiting, building, outbox, ready for a merge and merged.

## The intro, for fun

A roadmap walks into a database and asks for a table for its questions.

## The punchline, for fun

The database said yes, and kept a seat for the answers too.

## The options, in plain words

A. A. Store the questions with their answers on the roadmap, waits-on as a line and a link, and six states including closed (built).
B. B. Store no questions; the page reads them from the stored roadmap document and the answers from the roadmap's issue.
C. C. Keep the spec's five states and show a PRD closed unmerged as waiting, its line saying why.

## What I had to decide

Whether the stored roadmap carries its questions and answers, and whether `closed` is a state of its own.

## What I did meanwhile

The page (s5) and `omni roadmap push` (s6) build against this shape: `questions` on the roadmap, `waitsOn` and `waitsOnUrl` on each PRD, and six states.

## What it costs to change later

Changing it later is one migration on two tables nothing else reads, and the matching edits in the API's schema, s5's page and s6's push.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page needs the phase's done-when line beside the milestone: the front matter has no field for it, so nothing stores it. (author)

```

<!-- /omni-outbox-settled: s2-01-roadmap-push-shape -->

<!-- omni-outbox-settled: s2-02-roadmap-any-member-pushes -->

## s2-02-roadmap-any-member-pushes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 1
- Became: BR-PRODUCT-81, P-PRODUCT-72

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-roadmap-any-member-pushes
prd: 1162
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

A loop on the Omni page belongs to the person who runs it, and only they can update it. Should a roadmap work the same way, or belong to the whole workspace?

## The decision, in plain words

A roadmap belongs to its workspace: any member can update it, and the last person who did is recorded. Two people driving the same roadmap both keep its page current.

## The intro, for fun

Whose roadmap is it anyway? Everyone's, as it turns out.

## The punchline, for fun

The page just remembers who touched it last.

## The options, in plain words

A. A. Any member of the workspace updates it; the last pusher is recorded (built).
B. B. Only the person who first sent it updates it; anyone else is refused, as a loop is.

## What I had to decide

Whether any member of the workspace may update a roadmap, or only the person who first sent it.

## What I did meanwhile

Any member's `omni roadmap push` replaces the roadmap's document and PRD rows; the row keeps `pushed_by`.

## What it costs to change later

Restricting it later is one change to the database function, and a refusal the push command learns to print.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only roadmap_push() writes and members read; it does not say who among the members may push. (author)

```

<!-- /omni-outbox-settled: s2-02-roadmap-any-member-pushes -->

<!-- omni-outbox-settled: s3-01-consumes-is-direct-only -->

## s3-01-consumes-is-direct-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 1
- Became: BR-PRODUCT-82

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-consumes-is-direct-only
prd: 1162
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When one repository installs a second, and the second installs a third, should the plan check also refuse the first waiting on a change in the third?

## The decision, in plain words

The check only looks at the repositories a repository says it installs directly. A chain through a middle repository is not followed.

## The intro, for fun

Who installs whom, and does the grandparent count too?

## The punchline, for fun

For now the family tree stops at the parents.

## The options, in plain words

A. A. Direct only: a target is refused only for blockers in the targets its own consumes list names.
B. B. Follow the chain: a target also consumes what its consumed targets consume, and the check refuses those blockers too.

## What I had to decide

Whether the consumes rule follows chains of consumers or reads only the direct list.

## What I did meanwhile

Only direct consumes are refused; a person can list the third repository in the first one's consumes to get the refusal today.

## What it costs to change later

One small change in the plan check to walk the chain, and its tests; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a slice in a consumer blocked by a slice in a target it consumes; it does not say whether consumes is transitive (author)

```

<!-- /omni-outbox-settled: s3-01-consumes-is-direct-only -->

<!-- omni-outbox-settled: s4-01-consumer-rule-follows-blockers -->

## s4-01-consumer-rule-follows-blockers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s4
- Wave: 2
- Became: BR-PRODUCT-83

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-consumer-rule-follows-blockers
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When a roadmap has a project in a repository that installs another repository's package, which earlier projects must it come after?

## The decision, in plain words

It must come after every project it waits on, directly or through others, that changes the repository it installs from. Projects that do not wait on each other may still run side by side in the same wave.

## The intro, for fun

Two repositories, one package, and a question of who goes first.

## The punchline, for fun

Only the ones holding hands have to queue.

## The options, in plain words

A. A. Only the provider projects it waits on, directly or through others (built).
B. B. Every provider project of an earlier or the same wave, whether it waits on it or not.
C. C. Only the provider projects it waits on directly.

## What I had to decide

Whether the rule binds only the projects a consumer waits on (built), or every provider project against every consumer project of the roadmap, which would force all provider work before any consumer work.

## What I did meanwhile

The check refuses a consumer project whose wave is not after a provider project it waits on; unrelated projects in the two repositories run in parallel.

## What it costs to change later

Switching to the global reading is one extra loop in the roadmap grade and its tests; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's sentence reads either way; the narrower reading was taken because the wider one would refuse the spec's own example roadmap once crew consumes ai-domain (author).

```

<!-- /omni-outbox-settled: s4-01-consumer-rule-follows-blockers -->

<!-- omni-outbox-settled: s4-02-shipped-prd-still-counts -->

## s4-02-shipped-prd-still-counts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s4
- Wave: 2
- Became: BR-PRODUCT-84, P-PRODUCT-73

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-shipped-prd-still-counts
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Once a project of a roadmap has shipped, does the roadmap check still accept its row?

## The decision, in plain words

Yes: a row passes when its project's folder is in the inbox or already shipped, and its spec is compared wherever it lives. Otherwise every roadmap would fail its check as soon as its first project merged.

## The intro, for fun

A roadmap that fails the moment it succeeds would be a strange reward.

## The punchline, for fun

Shipped projects keep their seat at the table.

## The options, in plain words

A. A. Inbox or shipped folder (built).
B. B. Inbox folder only, so a roadmap must be edited each time one of its projects ships.

## What I had to decide

Whether a roadmap row needs its project in the inbox only, as the spec words it, or in the inbox or the shipped folder (built).

## What I did meanwhile

The check reads each row's project from the inbox or the shipped folder; only a project with neither is refused.

## What it costs to change later

Narrowing it to the inbox is one condition in the roadmap reader and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says inbox folder; whether it meant to refuse shipped projects was not settled (author).

```

<!-- /omni-outbox-settled: s4-02-shipped-prd-still-counts -->

<!-- omni-outbox-settled: s4-03-repos-column-and-source -->

## s4-03-repos-column-and-source — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s4
- Wave: 2
- Became: BR-PRODUCT-85, P-PRODUCT-74

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-repos-column-and-source
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

How strict is the roadmap file about which repositories each project names, and about saying where the roadmap came from?

## The decision, in plain words

In a plan repository every project must name at least one repository; outside one, a repositories column is refused. Saying where the roadmap was read from is optional, like the product and the target date.

## The intro, for fun

Every roadmap starts somewhere, but not every start has a link.

## The punchline, for fun

Pasted text gets to stay anonymous.

## The options, in plain words

A. A. Repositories required on every row of a plan repository; source optional (built).
B. B. Source required too, written as pasted for pasted text.
C. C. Repositories optional per row, a row without them read as the plan repository's own.

## What I had to decide

Whether the source line is required, and whether a plan repository's roadmap may leave a project's repositories empty.

## What I did meanwhile

A plan repository's roadmap needs its repositories column and a repository on every row; the source line may be left out.

## What it costs to change later

Making the source required, or relaxing the repositories rule, is one schema field or one condition and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists source beside the optional fields without saying it is optional; a roadmap from pasted text has no link to give (author).

```

<!-- /omni-outbox-settled: s4-03-repos-column-and-source -->

<!-- omni-outbox-settled: s5-01-answer-box-copies-the-command -->

## s5-01-answer-box-copies-the-command — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s5
- Wave: 2
- Stays here: An interim, wave-bound choice to be replaced by a Send route later; nothing lasting to record, and no domain or principle needs it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-answer-box-copies-the-command
prd: 1162
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The roadmap page's answer box should leave a person's answer on the roadmap's issue. Should the page post that comment itself, or hand the person the one line that posts it?

## The decision, in plain words

The box turns the answer into the one line that records it, with a copy button and a link to the roadmap's issue. The page does not post anything to GitHub yet.

## The intro, for fun

A text box that wants to talk to GitHub, but has nobody to pass the note to yet.

## The punchline, for fun

So it writes the note neatly and hands it to you to deliver.

## The options, in plain words

A. A. The box writes out the answer command to copy, and links the issue; posting from the page comes later
B. B. The page posts the comment itself now, through a new API route and the App's authorisation as the person
C. C. The box only links to the roadmap's issue, and the person writes the comment by hand

## What I had to decide

The spec says the page's answer box writes the same comment as `omni roadmap answer`. Posting from the page needs a write path to GitHub as the person (the GitHub App's authorisation, as the Outbox tab's Send does, through an API route) that is outside s5's territory, and the comment's marker is s6's (`kit/lib/roadmap/answers`), not built yet in wave 2.

## What I did meanwhile

`AnswerBox.tsx` shows a textarea for each unanswered `person` question; as the person types, it shows `omni roadmap answer <n> <Q> "<answer>"` with a Copy button, beside a link to the roadmap's issue. Nothing is written by the page.

## What it costs to change later

Small: a later slice swaps the box's copy step for a Send button posting through a new `/api/roadmaps/answer` route that reuses s6's marker; the box, its place on the page and the question model stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any workspace member may answer a person question from the page, or only some (author)
- Which GitHub account the page would post as: the person's, through the App's authorisation, is assumed (author)

```

<!-- /omni-outbox-settled: s5-01-answer-box-copies-the-command -->

<!-- omni-outbox-settled: s5-02-switch-test-lists-roadmaps -->

## s5-02-switch-test-lists-roadmaps — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s5
- Wave: 2
- Stays here: A local test-list fix outside the slice's declared files; it sets no lasting rule or architecture choice, and reverting the entry reverts the line.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-switch-test-lists-roadmaps
prd: 1162
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Adding the Roadmaps entry broke a check that lists every menu entry, in a file outside this slice's list. Fix it here, or leave it failing?

## The decision, in plain words

The check now lists the Roadmaps entry too. It is a one-line change to a test, made in this slice so everything stays green.

## The intro, for fun

One new menu entry, and a test somewhere was keeping count.

## The punchline, for fun

It now counts one more.

## The options, in plain words

A. A. Update the test's list in this slice
B. B. Leave it failing for a later slice to fix

## What I had to decide

`apps/galaxy/src/switch/switch.test.ts` pins the sidebar's in-app paths and checks each page exists. The plan gave s5 `headers.test.ts` but not this file; the Roadmaps entry makes it fail until `/roadmaps` is in its list.

## What I did meanwhile

Added `/roadmaps` between `/app/engineering` and `/prd` in that test's expected list; `app/roadmaps/page.tsx` exists, so its page check passes.

## What it costs to change later

None: a test's expected list. Reverting the entry reverts the line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant to leave this file to another slice: no other slice of PRD 1162 touches the sidebar (author)

```

<!-- /omni-outbox-settled: s5-02-switch-test-lists-roadmaps -->

<!-- omni-outbox-settled: s6-01-roadmap-push-reads-the-prs -->

## s6-01-roadmap-push-reads-the-prs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s6
- Wave: 3
- Became: BR-PRODUCT-86, P-PRODUCT-75

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-roadmap-push-reads-the-prs
prd: 1162
slice: s6
rank: medium
bears-on: none
raised: 2026-10-07
wave: 3
---

## The question, in plain words

The page colours each piece of a roadmap by where it stands, and says what a waiting piece waits on. The spec names the states but not how to tell them apart from the work on GitHub.

## The decision, in plain words

A piece counts as building once its work is open, waiting on answers when its draft holds open questions, ready once every part is ready, and merged once every part merged; a waiting piece names the first unfinished piece before it. When the code host cannot be read, nothing is sent and one line says so.

## The intro, for fun

Six colours, one Gantt, and GitHub as the only witness.

## The punchline, for fun

We asked the pull requests; they rarely lie about being drafts.

## The options, in plain words

A. Derive the state and the waits-on line from the feature pull requests alone, in the push (built)
B. Push no waits-on line until the next slice, and leave every piece without work as waiting with no reason
C. Run the whole reading of the next-step command inside the push, board and checks included

## What I had to decide

How `omni roadmap push` derives each PRD's state and its waits-on line from GitHub: a feature PR (and, in a plan repository, each target PR its row names, by the same branch) decides `building`, `outbox` (an open draft with high or human-action items on its branch), `ready`, `merged`, `closed`; a PRD not started names its first unmerged blocker as `waits on <repo>#<pr> (<id> <title>): <state>`. The spec's `building wave <k>/<m>` and `CI red` words are not produced: they need the board and the care state, which `omni next` reads (s7). GitHub unreadable stops the push with `github unreachable`, exit 1.

## What I did meanwhile

`kit/lib/roadmap/push.ts` holds `prdState`, `prdTimes` and `waitsOn` as pure functions, tested in `push.test.ts`; `readStandings` reads `gh pr list --head <branch>` per repository and the outbox items on the fetched feature branch.

## What it costs to change later

Small: s7 can hand its own held `why` to the push, or widen `stateWords` with the board's wave and the CI state; the contract and the page do not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `outbox` should also show while slices are still building and a high item is open: it does today, as soon as the draft holds one.

```

<!-- /omni-outbox-settled: s6-01-roadmap-push-reads-the-prs -->

<!-- omni-outbox-settled: s6-02-roadmap-push-outside-territory -->

## s6-02-roadmap-push-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s6
- Wave: 3
- Stays here: A local, additive implementation choice about touching a file outside the slice's territory; nothing lasting for the knowledge base to keep.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-roadmap-push-outside-territory
prd: 1162
slice: s6
rank: medium
bears-on: none
raised: 2026-10-07
wave: 3
---

## The question, in plain words

Sending a roadmap to the app needed one small addition to a shared file this piece of work was not meant to touch, and the command had to start without the usual setup so tests can stand in for the sign-in.

## The decision, in plain words

The shared sign-in client gained one line that sends a roadmap, beside the one that sends a loop. The roadmap command now loads its own setup, as the loop command does; nothing it prints or refuses changed.

## The intro, for fun

One line, one file over the fence.

## The punchline, for fun

We knocked, nobody was home, so we left it by the loop's line.

## The options, in plain words

A. Add one sending line to the shared client and let the command load its own setup (built)
B. Write a second sender with its own sign-in refresh inside the roadmap code
C. Open up the client's private call so any code can post anywhere

## What I had to decide

`kit/lib/ask/client.ts` is outside s6's territory, but its `call` (the 5-second limit and the one token refresh) is private: `pushRoadmap(body)` was added beside `pushLoop`, posting to `/api/roadmaps`. `omni roadmap` became a `withoutContext` command, like `loop` and `dossier`, so a test hands it `tokens`, `fetch` and `callMs`; `check` loads the context itself and behaves as before. The comment in `kit/bin/commands/index.ts` that lists the context-free commands does not name `roadmap` yet: that file is outside the territory too.

## What I did meanwhile

Built as described; every `omni roadmap check` test still passes unchanged.

## What it costs to change later

Nothing to undo: the client line is additive; the index comment is one word for a later slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) None: the change is additive and every existing roadmap check test passes unchanged.

```

<!-- /omni-outbox-settled: s6-02-roadmap-push-outside-territory -->

<!-- omni-outbox-settled: s6-03-roadmap-answer-comment-shape -->

## s6-03-roadmap-answer-comment-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s6
- Wave: 3
- Became: ADR-0086

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-roadmap-answer-comment-shape
prd: 1162
slice: s6
rank: medium
bears-on: none
raised: 2026-10-07
wave: 3
---

## The question, in plain words

A person's answer to a roadmap question is left as a comment on the roadmap's issue. What should that comment look like so it can be found again, and which answers should the command accept?

## The decision, in plain words

The comment starts with a fixed hidden tag naming the question, then the answer in plain text, and the latest answer to a question wins. The command only accepts a question the roadmap lists, and an answer of up to a thousand characters.

## The intro, for fun

A comment walks into an issue wearing a name tag.

## The punchline, for fun

Only the last one in the room gets remembered.

## The options, in plain words

A. A fixed tag, the latest answer wins, only listed questions accepted (built)
B. A tag built from the repository's own configured prefix
C. Accept any question name, and let the page sort out unknown ones

## What I had to decide

The answer comment opens with `<!-- omni-roadmap-answer: <question> -->`, a fixed marker rather than one derived from `markers.prefix` (which is the outbox's), so the roadmap's page can write the same comment without reading the repository's config. `readAnswers` keeps the latest marked comment per question in GitHub's order and ignores unmarked ones. `omni roadmap answer` refuses a question the roadmap's Open questions do not list, and an empty or over-1000-character answer, exit 2. `omni roadmap push` is `off` when `ask.url` is unset, as `omni loop push` is; `dossier.enabled` is not read.

## What I did meanwhile

`kit/lib/roadmap/answers.ts` and `omni roadmap answer` build and read that comment; the command's shape, `omni roadmap answer <n> <question> "<answer>"`, is the one s5's answer box copies.

## What it costs to change later

Small: a different marker is one constant in `answers.ts` and in the page's future Send route; answers already posted would need reading under both.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether only some members may answer a person question: anyone who can comment on the issue can today.

```

<!-- /omni-outbox-settled: s6-03-roadmap-answer-comment-shape -->

<!-- omni-outbox-settled: s7-01-roadmap-waits-on-outside-territory -->

## s7-01-roadmap-waits-on-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s7
- Wave: 4
- Stays here: A local, additive choice to extend another slice's files rather than duplicate wording; no lasting product guarantee or architecture decision beyond this piece of work.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-roadmap-waits-on-outside-territory
prd: 1162
slice: s7
rank: medium
bears-on: none
raised: 2026-10-07
wave: 4
---

## The question, in plain words

Naming what a waiting project waits on, and showing on the loop's page which repositories a step touches, needed small changes in two files this piece of work was not given. Change them here, or write the same words a second time?

## The decision, in plain words

Both files got a small addition: the roadmap's code now accepts finer words for a waiting project, such as the wave being built or red checks, so the loop and the roadmap's page say it the same way. The loop's sending command now takes the repositories of a step, or reads them from the plan.

## The intro, for fun

Two files over the fence, and a sentence nobody wanted to write twice.

## The punchline, for fun

So the loop borrows the roadmap's words instead of inventing its own.

## The options, in plain words

A. A. Widen s6's waits-on line with an optional argument and add the flag to the loop command (built)
B. B. Write a second waits-on line inside the loop's code, and leave the command without the flag
C. C. Leave both for a later piece of work, so the loop names only the coarse states and no repositories

## What I had to decide

`kit/lib/roadmap/push.ts` (s6's) and `kit/bin/commands/loop.ts` are outside s7's territory. The waits-on line had to be widened with `building wave <k>/<m>` and `CI red` without duplicating its wording, and a tick had to carry its repositories, which only the command's flags can add.

## What I did meanwhile

`waitsOn(row, rows, live)` gained an optional third argument: finer state words by row id, used in place of the state's own; `rowStates(roadmap, standings)` was extracted so `omni next` and the push read the rows the same way. `omni loop push tick` gained `--repos <repo,…>`, and without it sends the repositories the latest loop plan gives that step; a tick with none sends no `repos`, as before. Every existing push and loop test passes unchanged.

## What it costs to change later

Nothing to undo: both changes are additive. Moving them would be one parameter and one flag in another slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives s7 `kit/lib/loop/` and `kit/bin/loop.test.ts` but not the command file that reads the tick's flags; whether it meant to was not settled.

```

<!-- /omni-outbox-settled: s7-01-roadmap-waits-on-outside-territory -->

<!-- omni-outbox-settled: s7-02-roadmap-park-links-the-issue -->

## s7-02-roadmap-park-links-the-issue — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s7
- Wave: 4
- Stays here: A stopgap link choice made because omni next calls no app. It changes with one argument once the page id is readable, so nothing lasting needs keeping.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-roadmap-park-links-the-issue
prd: 1162
slice: s7
rank: medium
bears-on: none
raised: 2026-10-07
wave: 4
---

## The question, in plain words

When a project of a roadmap waits on a person's answer, the loop should point at the roadmap's page, but it only knows the roadmap's issue on GitHub. Where should it point?

## The decision, in plain words

The loop points at the roadmap's issue, where an answer is left, and its line names the question and the one command that answers it. A project whose earlier project was closed without merging points at that closed pull request.

## The intro, for fun

A question with no address is a letter with no envelope.

## The punchline, for fun

So the loop writes the issue on the envelope, and the reply finds its way.

## The options, in plain words

A. A. Link the roadmap's issue and name the answer command; spec wording for a closed blocker (built)
B. B. Read the page's address from the app on each tick, with the sign-in, and link the page
C. C. Link the roadmap list page of the app, which every roadmap can be reached from

## What I had to decide

The spec says a `person` question parks its PRDs "naming the question and the roadmap's page", but the page's id is the app's (`omni roadmap push` learns it from the reply); `omni next` calls no app. Also open: what a tick does when the kept loop plan drives other PRDs, and what a closed blocker's line names in a plan repository.

## What I did meanwhile

The park reads `waits on a person: roadmap <n> question <Q> is not answered (<question>); answer it with omni roadmap answer <n> <Q> "<answer>"`, linking `https://github.com/<slug>/issues/<n>`; answers GitHub cannot read leave the question unanswered. A closed blocker parks with the spec's `blocker #<pr> closed unmerged: fix the roadmap`, linking that PR. `omni next --roadmap <n>` follows the kept plan when it drives the roadmap's PRDs, else makes version 1 for them, replacing the kept one, as a tick with no plan kept does. Only a PRD's first step is held on its blockers.

## What it costs to change later

Small: a page link is one argument once `omni next` can read the roadmap's id (or the app serves a page by repository and number); the closed line is one string.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page should be reachable by repository and roadmap number, so a terminal could link it without asking the app.
- (author) In a plan repository `#<pr>` alone does not say which repository the closed PR is in; the link does.

```

<!-- /omni-outbox-settled: s7-02-roadmap-park-links-the-issue -->

<!-- omni-outbox-settled: s8-01-held-prd-sent-as-park -->

## s8-01-held-prd-sent-as-park — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s8
- Wave: 5
- Stays here: A stopgap mapping in two skills, cheap to replace with a hold event later; no lasting guarantee or architecture to record.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-held-prd-sent-as-park
prd: 1162
slice: s8
rank: medium
bears-on: none
raised: 2026-10-07
wave: 5
---

## The question, in plain words

The spec says a project waiting on another's merge is named on the loop's page and on its own issue, but the loop's page only knows parked projects. How should a waiting project show there?

## The decision, in plain words

The loop sends a waiting project to the loop's page as a parked one, its line naming the pull request it waits on, and leaves one comment on the project's own issue each time that line changes.

## The intro, for fun

A project waiting on a merge and the loop's page has only one chair for waiting.

## The punchline, for fun

So it sits in the parked chair, with a note saying exactly whose merge it waits for.

## The options, in plain words

A. Send a held PRD as a park naming the pull request, and comment on its issue when the line changes (built)
B. Add a hold event to the loop's sending command and the Loop page, in a later slice
C. Leave held PRDs to the roadmap's page alone, with no Loop page line and no issue comment

## What I had to decide

Whether a project held on its blockers is sent to the loop's page as a park, and whether the loop comments on its issue, without a new kind of event in the loop's sending command.

## What I did meanwhile

/omni:drive and /omni:mega-drive send each held PRD with `omni loop push park`, splitting its `waits on <repo>#<pr> (<id> <title>): <state>` line into who and what, and post it once per distinct line with `gh issue comment` on the held PRD's issue; the roadmap's page gets it from `omni roadmap push`.

## What it costs to change later

Small: a `hold` event in `omni loop push` and the Loop page would replace one line in each of the two skills; the comments already posted stay on the issues.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The Loop page may count a held PRD among the parked ones, though the loop goes on running other steps; whether the page should tell them apart was not settled.
- (author) A held PRD's issue gets a new comment each time its waits-on state changes (building, outbox, CI red, ready), which may be noisy on a long wait.

```

<!-- /omni-outbox-settled: s8-01-held-prd-sent-as-park -->

<!-- omni-outbox-settled: s9-01-roadmap-guide-page-outside-territory -->

## s9-01-roadmap-guide-page-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s9
- Wave: 6
- Stays here: Page order in the guide is a local documentation choice, cheap to move, with no lasting product guarantee to keep.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-roadmap-guide-page-outside-territory
prd: 1162
slice: s9
rank: medium
bears-on: none
raised: 2026-10-07
wave: 6
---

## The question, in plain words

The new guide page on roadmaps had to sit between two existing pages, which meant changing one line of a neighbouring page and the test of the guide's menu, both outside this piece of work.

## The decision, in plain words

The roadmaps page comes right after the page on several repositories and before landings; that page's next link now points to it, and the menu's test lists thirteen pages.

## The intro, for fun

A new page moved into the guide and needed the neighbours to shift over.

## The punchline, for fun

One next link changed hands, and the menu learned to count to thirteen.

## The options, in plain words

A. A. After Several repositories, before Landings, changing that page's Next link (built)
B. B. After Drive the loop, changing that page's Next link instead
C. C. Last in the guide, after When something goes wrong, with no Next link leading to it

## What I had to decide

Whether the roadmaps page sits after the several-repositories page (built), or somewhere that needs no change to another page.

## What I did meanwhile

docs/guide/several-repositories.md now ends with Next → Roadmaps, docs/guide/roadmaps.md ends with Next → Landings, and apps/galaxy/src/docs/docs.test.ts lists the thirteenth page in the sidebar, the served pages and the Next links; neither file is in s9's territory.

## What it costs to change later

Moving the page is one entry in meta.json, two Next links and the matching lines of the two guide tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names meta.json and guide.test.ts but not docs.test.ts, which also lists every page, nor the page whose Next link must lead to the new one.

```

<!-- /omni-outbox-settled: s9-01-roadmap-guide-page-outside-territory -->

<!-- omni-outbox-settled: s9-02-roadmap-phase0-proved-per-prd -->

## s9-02-roadmap-phase0-proved-per-prd — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s9
- Wave: 6
- Became: ADR-0087

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-02-roadmap-phase0-proved-per-prd
prd: 1162
slice: s9
rank: medium
bears-on: none
raised: 2026-10-07
wave: 6
---

## The question, in plain words

The check that proves a review pull request holds only documents expects one project with its build plan, but a roadmap's review holds many projects and, by design, no plans yet. How does the skill prove it?

## The decision, in plain words

The skill runs that check once per project of the roadmap and accepts only one fault, the missing plan; everything else (documents only, signed, the spec and the page showing today beside after present) must hold for every project.

## The intro, for fun

The checker wanted a plan; the roadmap said plans come later.

## The punchline, for fun

So it checks everything else, one project at a time.

## The options, in plain words

A. A. Run the check once per project and allow only the missing plan (built)
B. B. Teach the check a roadmap mode that accepts every project of the roadmap without a plan
C. C. Skip that check for roadmaps and rely on the inbox check alone

## What I had to decide

Whether the skill proves the phase-0 PR by running omni phase0 per PRD and allowing only missing: plan (built), or whether omni phase0 should learn a roadmap mode first.

## What I did meanwhile

/omni:roadmap step 5 (and /omni:mega-roadmap step 5 through it) runs omni phase0 <prd> for every PRD and treats its not ok as expected only when missing: plan is its one fault; omni phase0 itself is unchanged, since kit code is outside s9's territory.

## What it costs to change later

Teaching omni phase0 a --roadmap <n> mode later is one kit change and one line in each skill's step 5.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says omni phase0 proves the roadmap's phase-0 PR, but no slice of the plan teaches it to accept PRDs without a plan.

```

<!-- /omni-outbox-settled: s9-02-roadmap-phase0-proved-per-prd -->
