---
id: s1-02-statistics-keys-per-workspace
prd: 612
slice: s1
rank: high
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Two workspaces could track the same repository. Should each keep its own copy of that repository's pull requests, or should they share one?

## The decision, in plain words

Each workspace keeps its own copy: a pull request is stored once per workspace that tracks its repository, and only for a repository that workspace lists.

## The intro, for fun

Two workspaces walk into the same repository.

## The punchline, for fun

Each leaves with its own receipt.

## The options, in plain words

A. One copy per workspace, keyed with workspace_id, the option built.
B. One shared copy per repository, keyed on repo and number, read through the workspaces that track it.

## What I had to decide

The keys of pull_requests (workspace_id, repo, number) and pull_request_reviews (workspace_id, repo, number, reviewer), and their foreign keys to repositories and pull_requests, where the spec says unique on repo and number.

## What I did meanwhile

Keys include workspace_id, so row-level security stays one is_member check per row, and a foreign key ties each pull request to a listed repository (lower-case owner/name), with cascade on delete.

## What it costs to change later

Changing the keys later is a migration on two tables the collector writes; while they are empty, a cheap one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's unique on repo and number meant across workspaces (author)
