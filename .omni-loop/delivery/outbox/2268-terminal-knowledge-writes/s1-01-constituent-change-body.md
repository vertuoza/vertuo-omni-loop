---
id: s1-01-constituent-change-body
prd: 2268
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The spec says how a terminal sends a Legal entry or a glossary term to the new route, but not a Statement or a Never line. How should it send one?

## The decision, in plain words

An addition sends its text under the name of what it adds, the Statement or a Never line, as the command's own options name it. An edit names the line it changes and sends the new text.

## The intro, for fun

Two kinds of line, one door, and nobody wrote down which knock means which.

## The punchline, for fun

So each knock now says its own name, the way the command already does.

## The options, in plain words

A. The text goes under the name of what it adds, and an edit names its line and sends the new text, as built.
B. One shape for both: an addition names the Statement or Never as its line too, and every change sends its text the same way.

## What I had to decide

The body of a constituent change on POST /api/knowledge/changes, which slice s3 (`omni constituents add|edit`) sends and the spec leaves open.

## What I did meanwhile

Built: `kind: 'constituent'`, `action: 'add'` with `fields: {statement}` or `fields: {never}`; `action: 'edit'` with `entry: 'statement' | 'never#<n>'` and `fields: {text}`, read by `apps/galaxy/src/knowledge-api/knowledge-api.contract.ts`. Any other shape is a 400 naming the field.

## What it costs to change later

A constant: another shape is one schema in the contract and the matching lines in s3's client, with no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Slice s3 is built from the spec alone, in parallel: it must read this contract or this item to send the same shape (author)
