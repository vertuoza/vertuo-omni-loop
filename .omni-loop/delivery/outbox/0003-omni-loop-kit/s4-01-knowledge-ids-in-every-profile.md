---
id: s4-01-knowledge-ids-in-every-profile
prd: 3
slice: s4
rank: high
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Should a decision be able to point at an entry in the knowledge folder even when that folder is not where this repository's rules come from?

## The decision, in plain words

Yes: an entry is found whenever the knowledge folder exists, but it only forces a decision to be treated as serious when the rules come from that folder.

## The options, in plain words

A. Find knowledge entries in every setup, and raise the seriousness only when the rules come from the knowledge folder, the option built.
B. Find knowledge entries only when the rules come from the knowledge folder, and refuse them everywhere else.

## What I had to decide

Whether `laws.resolve` accepts a knowledge id when `laws.source` is not `knowledge`.

## What I did meanwhile

`resolve()` resolves knowledge ids whenever `ctx.layout.knowledgeRoot` exists (refusing only a missing folder or an unknown id); `floorsHigh` stays tied to `laws.source`. `check-inbox` grades `areas:` the same way. `Became:` write-back therefore works in every profile.

## What it costs to change later

One condition in `kit/lib/laws.mjs` and one in `kit/lib/inbox/check-inbox.mjs`; reverting refuses `Became:` ids outside the knowledge profile again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a repository with laws.source none will keep a knowledge folder at all, or treat it as unused.
