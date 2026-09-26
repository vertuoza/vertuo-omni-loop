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
