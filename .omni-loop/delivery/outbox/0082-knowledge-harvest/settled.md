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
