# ADR-0042 — The footer guard counts a skill as opening a pull request or issue by its commands, body rewrites or plain words

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #99 · **Decided:** nobody — adopted when raised (medium), 2026-09-26 · **Merged:** @pierrederval, 2026-09-26, PR #103

## Context

What the new rule in `kit/test/plugin.test.mjs` treats as "a SKILL.md that opens a pull request or an issue" (spec, Acceptance criteria 5; the plan's s2 "done when"). The spec lists the bodies that are signed and says a body a skill rewrites later keeps its footer, but not how a guard reading skill prose recognises them. `/omni:plan`, `/omni:terraform` and `/omni:do-work` open their pull requests through `/omni:pr` and never name `gh pr create` themselves, so a guard that reads commands alone would not hold them to the rule.

## Decision

The signature-footer check in kit/test/plugin.test.mjs counts a SKILL.md as opening a pull request or issue when it runs the opening command, rewrites a body with gh pr edit --body, or says in prose that it opens one. Comment-only skills are exempt, since comments are never signed.

The option chosen: A. Count a skill as opening one when it runs the opening command, rewrites a description, or says in words that it opens one, the option built.

## Consequences

Three regular expressions and their fixture cases in `kit/test/plugin.test.mjs`; no skill's prose changes. Narrowing the rule to commands only stops holding `/omni:plan`, `/omni:terraform` and `/omni:do-work` to it; holding every skill to both lines unconditionally needs no skill change today, since all eight already name both.

## Source

`.omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md`, entry `s2-01-footer-guard-what-counts-as-opening`
