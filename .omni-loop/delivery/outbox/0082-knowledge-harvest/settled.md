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
