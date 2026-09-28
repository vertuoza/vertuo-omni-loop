---
id: s3-01-one-open-item-waits
prd: 315
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When exactly one question of yours waits for an answer, how should the overview's row say it?

## The decision, in plain words

It says 1 open item waits for an answer, so the verb agrees with a single item. With two or more it says they wait, as the spec writes it.

## The intro, for fun

The spec wrote the row for a crowd of questions, never for one on its own.

## The punchline, for fun

One lonely question now waits, and a crowd of them still wait together.

## The options, in plain words

A. Make the verb agree: 1 open item waits, 2 open items wait: the option built.
B. Keep the spec's letter for every count: 1 open item wait for an answer.
C. Word it so no verb has to agree, such as open items: 1, waiting for an answer.

## What I had to decide

The words of an outbox row of yours when exactly one open item is left. The spec and the plan give them as `<k> open item(s) wait for an answer`: the `(s)` says the noun follows the count, but the verb is written only for many, so `1 open item wait for an answer` would follow the letter of the plan's check.

## What I did meanwhile

`standing` in `kit/lib/status/format.mjs` prints `1 open item waits for an answer` for one and `<k> open items wait for an answer` for more. Pinned in `kit/lib/status/format.test.mjs` and `kit/bin/status.test.mjs`.

## What it costs to change later

One condition in `kit/lib/status/format.mjs` and the lines of the tests that pin it. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan write the row as a template, `<k> open item(s) wait for an answer`, and never show it with one item.
