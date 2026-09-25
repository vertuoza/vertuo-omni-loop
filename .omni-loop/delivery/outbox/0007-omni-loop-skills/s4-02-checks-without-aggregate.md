---
id: s4-02-checks-without-aggregate
prd: 7
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When the repository has no branch protection and names no single summary check, which checks decide that a pull request is green?

## The decision, in plain words

Every check the pull request reports counts, except the outbox check, which is handled on its own. With a named summary check, only that one and the outbox check count.

## The options, in plain words

A. Every reported check except the outbox check counts, the option built.
B. Only the outbox check counts, so a repository without a summary check has no CI gate for agents.
C. Refuse to finish and report a human step asking for a summary check to be configured.

## What I had to decide

What `/omni:pr` counts as green when `ci.branchProtection` is false and `ci.aggregateCheck` is null (this repository's own case).

## What I did meanwhile

The lifecycle reads `gh pr checks <n> --json name,state,bucket`; with `ci.aggregateCheck` null, every reported check except `ci.outboxContext` stands in for it. An empty check list is read as a conflict, as upstream did.

## What it costs to change later

One paragraph of `kit/plugin/skills/pr/SKILL.md`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether repositories without an aggregate check run optional checks that should never block an agent.
