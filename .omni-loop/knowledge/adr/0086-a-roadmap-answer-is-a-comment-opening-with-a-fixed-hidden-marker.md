# ADR-0086 — A roadmap answer is a comment opening with a fixed hidden marker naming the question, and the latest one wins

**Status:** adopted · **Date:** 2026-10-07 · **PRD:** #1162 · **Decided:** nobody — adopted when raised (medium), 2026-10-07 · **Merged:** @pierrederval, 2026-10-07, PR #1163

## Context

The answer comment opens with `<!-- omni-roadmap-answer: <question> -->`, a fixed marker rather than one derived from `markers.prefix` (which is the outbox's), so the roadmap's page can write the same comment without reading the repository's config. `readAnswers` keeps the latest marked comment per question in GitHub's order and ignores unmarked ones. `omni roadmap answer` refuses a question the roadmap's Open questions do not list, and an empty or over-1000-character answer, exit 2. `omni roadmap push` is `off` when `ask.url` is unset, as `omni loop push` is; `dossier.enabled` is not read.

## Decision

A roadmap answer is a comment on the roadmap's issue opening with a fixed hidden marker naming the question, not the configured prefix, so the page can write it without the config. The latest marked comment wins; only listed questions and answers up to 1000 characters are accepted.

The option chosen: A. A fixed tag, the latest answer wins, only listed questions accepted (built)

## Consequences

Small: a different marker is one constant in `answers.ts` and in the page's future Send route; answers already posted would need reading under both.

## Source

`.omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md`, entry `s6-03-roadmap-answer-comment-shape`
