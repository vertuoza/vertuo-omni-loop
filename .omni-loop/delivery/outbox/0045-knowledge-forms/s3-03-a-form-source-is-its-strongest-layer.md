---
id: s3-03-a-form-source-is-its-strongest-layer
prd: 45
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The map of the knowledge pages says, for each page, where it is read from: the repository, a pointer, or the kit's default. What does it say for a page whose sections come from different places?

## The decision, in plain words

It names the strongest place any section comes from: the repository when one section holds the repository's own words, a pointer when every answered section points elsewhere, and the kit's default when nothing is answered yet. The map also lists where each section comes from.

## The options, in plain words

A. One word per page, the strongest place any section comes from, and the place of every section beside it.
B. One word per page from its own stated state alone: filled means the repository, blank or missing means the kit's default.
C. No word per page: only the place of each section.

## What I had to decide

The spec says `omni kb status` prints "each form, its state, its open questions, its stale evidence and its source (repository, pointer or kit default)". A form resolves per slot, and one form can hold repository text, a `See:` line and blank slots at once, so a form's source is not a single fact; the spec does not say how to name it.

## What I did meanwhile

`formSource` in `kit/lib/playbook/status.mjs` returns `pointer` for a pointer form or one whose every answered section is a `See:` line, `repo` when at least one section holds repository text, and `kit` otherwise (a missing, invalid or blank form, or one holding only `TODO(human)` lines). Each form also lists `sections: [{ slot, source }]`. Test: "--json lists each form with its state, source, open questions and stale evidence" in `kit/bin/kb.test.mjs`.

## What it costs to change later

A constant, before or after merge: the rule is one function of `resolveForm`'s sections, and nothing stores it. /omni:terraform --refresh (s5) reads `state` and `stale`, not `source`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person reading the map wants a page with holes named apart from a page nobody has touched: today both read as the kit's default, and the open questions are listed below the map.
