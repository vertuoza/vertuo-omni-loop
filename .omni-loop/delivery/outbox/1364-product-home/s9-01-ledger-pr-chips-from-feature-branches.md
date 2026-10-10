---
id: s9-01-ledger-pr-chips-from-feature-branches
prd: 1364
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

On a product's Ledger, which pull requests show as the little chips beside each PRD?

## The decision, in plain words

Each PRD shows the open pull requests of its feature branch and of its landings, in any of the workspace's repositories, found by the branch name the loop uses by default.

## The intro, for fun

Every PRD row on the Ledger wants a few badges, and somebody has to pick which ones.

## The punchline, for fun

For now the badges follow the branch name, like ducklings follow the first thing they see.

## The options, in plain words

A. A. Match open pull requests by the default feature branch name and its landings, the option built.
B. B. Read each repository's committed config and match its own feature branch shape.
C. C. Show no PR chips until the stages sync stores each PRD's feature pull request.

## What I had to decide

Where the Ledger's PR chips come from, since the tables the spec names for the Ledger hold no pull request numbers.

## What I did meanwhile

The chips read the stored pull requests (pull_requests) that are open and whose head is feat/<topic> or a landing feat/<topic>-<k>of<n>-<name>, the topic being the one the stages sync learnt for the PRD (prd_topics). Slice pull requests are left out. A repository whose config changes the feature branch shape shows no chips.

## What it costs to change later

One pattern and one read in the product home's service and repository; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's Ledger row asks for PR chips but names only approval_requests, approvals, prd_stages and prd_outbox.waiting, none of which holds a pull request number
- (author) The server does not read each repository's branch shapes for this page, so a repository with a custom feature branch shape shows no chips
