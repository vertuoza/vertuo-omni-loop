---
id: s1-03-prose-label-literals
prd: 7
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the guard against repository-specific words in skill text also catch a label name written in plain text?

## The decision, in plain words

No, for now the skill text is checked with exactly the same patterns as the code, as asked. A label name written without quotes therefore passes.

## The options, in plain words

A. Check skill text with exactly the code's patterns, the option built.
B. Also forbid the default label names written without quotes, in skill text only.

## What I had to decide

Which patterns `kit/test/no-literals.test.mjs` applies to `kit/plugin/**/*.md`.

## What I did meanwhile

Applied the same `FORBIDDEN` list to skill prose; a Markdown provenance line (`<!-- Ported from vertuo-ai-domain@… -->`) is exempt like a `// Ported from` line.

The label patterns are `'outbox:go'` and `'pr:feature'` — quoted, as they would appear in JS. In prose a label is written `` `outbox:go` ``, which these patterns do not catch (the fixture in the test pins that behaviour). The `vertuo` and `docs/` patterns do catch prose.

## What it costs to change later

Two regexes in `kit/test/no-literals.test.mjs`, and one fixture line flipped.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a skill will ever legitimately need to write a label name in prose (for example, to explain a default) rather than read it through the config command.
