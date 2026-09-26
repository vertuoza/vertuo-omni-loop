# Settled outbox items — PRD 82

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-schema-bound-to-the-knowledge-base -->

## s3-01-schema-bound-to-the-knowledge-base — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-schema-bound-to-the-knowledge-base
prd: 82
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The check on the model's answer must know which folders and topics the repository has, so should it be one fixed check or one built for each repository?

## The decision, in plain words

There is a fixed check for the shape of the answer, and a second one built from what the repository holds, which also refuses a rule attached to another topic's principle.

## The intro, for fun

Every answer the model gives has to fit through a door, and this repository decides how wide it is.

## The punchline, for fun

Same door frame everywhere, just a different lock on each one.

## The options, in plain words

A. A fixed shape check plus a check built for each repository, and a rule may only serve a product principle or its own topic's, the option built.
B. One check built for each repository only, with no fixed shape check exported.
C. Let a rule serve any principle, and leave the refusal to the knowledge check that runs later.

## What I had to decide

The plan names one `ClassificationSchema`, but the spec's refusals (a `place` naming no domain, `covers` naming nothing, a kind with no folder) depend on the repository. I also had to decide whether `serves` may name a principle of another domain, and what the model call's JSON-schema response format should be.

## What I did meanwhile

`ClassificationSchema` is the context-free shape (one strict object per kind, fields outside the spec's table refused, the caps, `serves: new` iff `principle`). `classificationSchema(summary)` binds it to `knowledgeSummary({ ctx })`: allowed kinds, existing places, an existing principle of `product` or the rule's own place (the rule `omni check knowledge` already grades), and an existing entry or `ADR-NNNN` for `covers`. `classificationJsonSchema(summary)` gives a looser JSON schema for `response_format`; zod stays the judge. The prompt snapshot is a file, `kit/lib/knowledge/classify.prompt.snap`, to stay inside the slice's territory.

## What it costs to change later

Renaming or merging the two exports is a find-and-replace across s5, s7 and s8's callers. Allowing a rule to serve another domain's principle is one condition removed, but `omni check knowledge` would then refuse the written entry.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s4's client takes a JSON schema object, a zod schema, or both; the JSON schema here is a guess at what it needs.

```

<!-- /omni-outbox-settled: s3-01-schema-bound-to-the-knowledge-base -->

<!-- omni-outbox-settled: s4-01-model-client-answer-shape -->

## s4-01-model-client-answer-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-model-client-answer-shape
prd: 82
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The shared model client had to say how a call went. Should it keep the retro's own wording for each failure, or give a short kind of failure plus a sentence that each caller turns into its own words?

## The decision, in plain words

It gives a short kind of failure (no key, model unavailable, reply refused) and a sentence saying why. The retro keeps its own wording by translating those kinds when it moves onto the shared client.

## The intro, for fun

Two callers, one model, and a disagreement about how to say no.

## The punchline, for fun

So the client says it plainly, and each caller says it nicely.

## The options, in plain words

A. A failure kind plus a sentence; each caller words it (built).
B. The client returns the retro's exact reason strings, and the harvest reuses them.

## What I had to decide

Whether the shared model client reports failures as a kind plus a sentence, leaving each caller to word them, or reports them in the retro's exact words.

## What I did meanwhile

The client returns ok, a failure kind (no-key, unavailable, refused), the model asked, the reply and a reason. Replies are not streamed unless the caller asks, and the reply check may be a function or a zod schema.

## What it costs to change later

Low: the client is new and only the retro and the harvest call it. Changing the answer shape is an edit to one module and its two callers, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say how the shared client reports a failure; the retro wording it replaces lives in the app (author)

```

<!-- /omni-outbox-settled: s4-01-model-client-answer-shape -->

<!-- omni-outbox-settled: s2-01-broken-open-item-stops-the-settle -->

## s2-01-broken-open-item-stops-the-settle — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-broken-open-item-stops-the-settle
prd: 82
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When a feature is merged while a question is still open, and one of those open questions is written so badly it cannot be read, what should happen?

## The decision, in plain words

Nothing is settled for that feature, and the reason names the unreadable question, so a person can fix it and run the settling again.

## The intro, for fun

One open question got scribbled on a napkin instead of the form.

## The punchline, for fun

So the whole pile waits until someone rewrites the napkin.

## The options, in plain words

A. Settle nothing and name the unreadable question, so a person fixes it first.
B. Settle every readable question and list the unreadable ones as left open.
C. Settle every question, reading only the header of an unreadable one.

## What I had to decide

What settle at merge does when an open item file in the PRD's outbox does not parse. The spec says every open item is adopted, but an entry needs the item's id, rank, slice and wave, and a file that does not parse gives none of them reliably.

## What I did meanwhile

settleAtMerge returns ok: false with the parser's errors, naming the file, and settles nothing for that PRD. The outbox check refuses a malformed item on every pull request, so this should only happen when that check was bypassed.

## What it costs to change later

A constant change in one function: settle the parseable items and list the unparseable ones as not settled, or fall back to the front matter alone. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what a merge over red does with an open item that does not parse.

```

<!-- /omni-outbox-settled: s2-01-broken-open-item-stops-the-settle -->

<!-- omni-outbox-settled: s5-01-reworked-drift-record-quotes-the-answer -->

## s5-01-reworked-drift-record-quotes-the-answer — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-reworked-drift-record-quotes-the-answer
prd: 82
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When a person asked for a change and the team reworked it, what should the written decision say was chosen?

## The decision, in plain words

The written decision quotes the person's answer word for word, instead of the first option, which was what got built before the change.

## The intro, for fun

The first option lost the argument, so it should not get the last word.

## The punchline, for fun

The person who asked for the change gets quoted instead.

## The options, in plain words

A. Quote the answer verbatim for a reworked drift, option A otherwise (what was built).
B. Always quote option A, even for a reworked drift.
C. Ask the model to name the chosen option in its reply, and quote that.

## What I had to decide

The spec says a decision record's Decision section ends with the option chosen, verbatim. For a decision kept as built that is option A. For a drifted decision that was reworked, option A is what the person rejected, and the answer rarely names a letter.

## What I did meanwhile

A record from a drifted, reworked decision ends its Decision section with 'The answer, as it was given:' and the answer verbatim; every other record ends with 'The option chosen:' and option A verbatim.

## What it costs to change later

One function in kit/lib/knowledge/write.mjs and one test; records already merged keep their text until a person edits them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say which option a reworked drift chose; nothing in the ledger maps a free-text answer back to an option letter.

```

<!-- /omni-outbox-settled: s5-01-reworked-drift-record-quotes-the-answer -->

<!-- omni-outbox-settled: s6-01-retro-record-names-shipped-folder -->

## s6-01-retro-record-names-shipped-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-retro-record-names-shipped-folder
prd: 82
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When a feature was merged before its folder was moved to the shipped shelf, should the retro's own record say where the folder was at the merge, or where the retro now lives?

## The decision, in plain words

The retro's record names the shipped folder, where the retro is written, and still says the folder was in the inbox at the merge.

## The intro, for fun

A retro written into a room the folder has not moved into yet.

## The punchline, for fun

The address on the letter is where it will be read, not where it was posted.

## The options, in plain words

A. Name the shipped folder in the record and the pull request text, keep the state as it was at the merge (built).
B. Keep the inbox folder in the record, and only write the files into the shipped folder; the pull request text then names a folder that no longer holds the retro.
C. Name the shipped folder and also set the state to shipped, losing the fact that the PRD was merged without being shipped.

## What I had to decide

Whether the retro's record and its pull request text name the shipped folder or the inbox folder for a PRD merged without being shipped.

## What I did meanwhile

The record's folder field and the retro pull request's text name the shipped folder; the record's state field still says inbox.

## What it costs to change later

One line in the retro function: the folder put on the fact sheet after detection. Undoing it drops that line; no stored data needs migrating.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the retro's files go into shipped/ always, and says nothing about the folder field inside retro.json. (author)

```

<!-- /omni-outbox-settled: s6-01-retro-record-names-shipped-folder -->

<!-- omni-outbox-settled: s7-01-harvest-leaves-changes-unstaged -->

## s7-01-harvest-leaves-changes-unstaged — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-harvest-leaves-changes-unstaged
prd: 82
slice: s7
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When the harvest runs on a person's own computer, should it leave its changes ready to review but not yet marked for saving, or mark them for saving like the shipping step does?

## The decision, in plain words

It leaves every change in place, not yet marked for saving. The person reviews the changes, then marks and saves them themselves.

## The intro, for fun

Two ways to leave a desk tidy: papers in a pile, or papers already in the folder.

## The punchline, for fun

The harvest leaves the pile, so nothing is filed before someone reads it.

## The options, in plain words

A. Leave every change unstaged: plain file operations, the person stages and commits.
B. Stage every change after applying it, as omni ship stages its moves.

## What I had to decide

The spec says omni harvest writes into the working tree and never commits, like omni ship. omni ship stages its moves with git mv; the harvest also deletes item files and rewrites the ledger around the moves, which git mv does not handle cleanly on a folder holding a deleted tracked file.

## What I did meanwhile

applyHarvestEdits applies the edit set with plain file operations (delete, rename, write): the working tree changes, the index does not. The printed report ends with 'Review the diff and commit it.'

## What it costs to change later

One function: staging the result afterwards is a single git add over the moved and written paths, added to the command. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a reviewer expects the same staged state omni ship leaves; neither the spec nor the plan says.

```

<!-- /omni-outbox-settled: s7-01-harvest-leaves-changes-unstaged -->

<!-- omni-outbox-settled: s7-02-no-place-means-not-placed -->

## s7-02-no-place-means-not-placed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-no-place-means-not-placed
prd: 82
slice: s7
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

In a repository with no knowledge folder and no folder for decision records, what should the harvest say about each decision, since there is nowhere to write it?

## The decision, in plain words

It asks no model and lists every decision as not placed, saying the repository has no place for knowledge. It never marks one as staying where it is on its own.

## The intro, for fun

A librarian with no shelves still has to say something about every book.

## The punchline, for fun

Ours says: no shelf yet, so this book waits on the cart.

## The options, in plain words

A. List every decision as not placed, asking no model.
B. Write a fixed 'Stays here' line on every entry, asking no model.
C. Ask the model anyway, allowing only stays-here and covered.

## What I had to decide

The spec says that with neither folder every candidate is stays-here or covered and no call is made, but a stays-here line needs a reason and a covered line needs an entry to point at, and without a model call nothing supplies either.

## What I did meanwhile

classifyCandidate returns no reply, with the reason 'this repository has no knowledge folder and no decision-record folder', when the repository allows only covered and stays-here; finishHarvest lists the candidate as not placed and writes no ledger line.

## What it costs to change later

One branch in classifyCandidate: writing a fixed 'Stays here:' line instead is a constant and a test, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which reason text a 'Stays here:' line would carry when no model was asked; the spec gives none.

```

<!-- /omni-outbox-settled: s7-02-no-place-means-not-placed -->

<!-- omni-outbox-settled: s8-01-route-test-counts-the-harvest -->

## s8-01-route-test-counts-the-harvest — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-route-test-counts-the-harvest
prd: 82
slice: s8
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

Adding the new harvest job to the app meant changing a test that belongs to the pull request check, which this piece of work was not meant to touch. Should that test change, or should the new job be served somewhere else?

## The decision, in plain words

The test changed in the smallest way: it now expects the three jobs the app serves instead of two. Nothing else in the pull request check or its tests changed.

## The intro, for fun

The guest list for the app's front door was printed before the third guest was invited.

## The punchline, for fun

So one name was added to the list, and the door stayed the same.

## The options, in plain words

A. A. Change the one test so it expects the three jobs (built).
B. B. Serve the harvest from a separate address of its own, leaving that test untouched.
C. C. Move the test into the app's shared test folder and rewrite it there.

## What I had to decide

The spec says the knowledge-harvest function is registered in api/inngest.mjs, and the plan says the outbox check's tests pass unchanged. apps/omni-app/src/outbox-check/inngest-route.test.mjs asserts that the route serves exactly [outboxCheck, retro] and reports four functions, so both cannot hold, and that file is outside s8's territory.

## What I did meanwhile

Registered knowledgeHarvest in apps/omni-app/api/inngest.mjs and edited inngest-route.test.mjs in three places: the import, the list of served functions (now outboxCheck, retro, knowledgeHarvest) with the harvest's id, and function_count from 4 to 6 (each function plus its failure handler). No other outbox-check test changed.

## What it costs to change later

Low: reverting is three lines in one test file. Serving the harvest from its own route instead would be a new file under api/ and a second Inngest sync URL.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's 'the outbox check's tests pass unchanged' may have meant the check's behaviour tests only; the spec does not say whether the route test counts.

```

<!-- /omni-outbox-settled: s8-01-route-test-counts-the-harvest -->

<!-- omni-outbox-settled: s8-02-replay-keeps-the-first-commit -->

## s8-02-replay-keeps-the-first-commit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-replay-keeps-the-first-commit
prd: 82
slice: s8
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

When a harvest is run again for the same merge, its knowledge branch already holds the first run's changes. Should the rerun add its own changes on top, or leave the branch as it is and only refresh the pull request's description?

## The decision, in plain words

A rerun never adds a second change to a branch that already holds the harvest's change. It only rewrites the pull request's description, from what the rerun found.

## The intro, for fun

The second run arrives at the post office to find the letter already sent.

## The punchline, for fun

It rewrites the cover note and leaves the envelope sealed.

## The options, in plain words

A. A. Never commit again to a branch holding the harvest's commit; only rewrite the description (built).
B. B. Commit again when the rerun's files differ from the branch's, on top of the first commit.
C. C. Compare the rerun's files with the branch's, and when they differ, leave both alone and post a comment.

## What I had to decide

The spec says a replay finds the PR by its branch, rewrites its body, and never commits twice. It does not say what happens when the rerun's result differs from the first commit, for instance when the model places a decision differently the second time.

## What I did meanwhile

The publish step reads the knowledge branch's head commit; when it is not the tip it was cut from and its message carries 'The knowledge harvest of #<n>.', no commit is made and upsertPull rewrites the title and body from this run's result. A branch cut by a run that failed before its commit gets the commit. Ids are numbered with the run's own branch left out of the open knowledge branches, so a rerun numbers as the first run did.

## What it costs to change later

Low: one condition in the publish step. Committing a rerun's differing files instead would add a tree comparison before the commit; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The body a rerun writes can name a placement the committed files do not hold when the model answers differently; the spec does not say which should win.

```

<!-- /omni-outbox-settled: s8-02-replay-keeps-the-first-commit -->

<!-- omni-outbox-settled: s8-03-write-reads-the-settle-tip -->

## s8-03-write-reads-the-settle-tip — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-03-write-reads-the-settle-tip
prd: 82
slice: s8
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The harvest reads the main branch twice, once to settle and once to write the knowledge, and the main branch may move in between. Should the second read take the newest state, or the same state the first read took?

## The decision, in plain words

Both reads take the same state of the main branch, the one the first read found, and the knowledge pull request starts from there. Other open knowledge pull requests are the ones not yet merged.

## The intro, for fun

Measuring a room twice only helps if nobody moves the walls in between.

## The punchline, for fun

So the harvest measures once, writes it down, and uses the same numbers twice.

## The options, in plain words

A. A. Read the same commit in both steps, and cut the branch from it (built).
B. B. Read the newest tip again in the write step, and cut the branch from that newer tip.
C. C. Read the newest tip again, and start the whole harvest over when it moved.

## What I had to decide

The spec's flow says step 'write' snapshots the tip again and step 'publish' cuts from the tip. The settle step's edits (the moves, the ledger's new entries) are planned against the tree it read; applied to a newer tip, a move could name a path that changed. The spec also does not say how the open knowledge branches are found.

## What I did meanwhile

Step 'settle' records the tip's sha; step 'write' snapshots that same sha, and 'publish' cuts the branch from it. The open knowledge branches are the open pull requests into the default branch whose head matches branches.knowledge, this run's own branch left out; each one's knowledge folder and decision records are snapshotted at its head for the ids it takes.

## What it costs to change later

Low: one sha passed between steps. Reading the newest tip instead is one call in the write step; finding knowledge branches by name instead of by open pull request is one query. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether 'the tip again' in the spec means a fresh read or the same commit; the flow diagram does not say.
- (author) A knowledge branch whose pull request never opened is not counted; the concurrency limit of one run per repository is what keeps two such runs apart.

```

<!-- /omni-outbox-settled: s8-03-write-reads-the-settle-tip -->
