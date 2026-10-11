---
id: s3-04-label-rerun-reach
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When a PRD is approved or its approval is voided, which pull requests should get their approval check run again, and how does the App recognise the approved label?

## The decision, in plain words

The App reacts only to the kit's default approved label name, and reruns the PRD's open feature pull request plus the target pull requests it can find in the same GitHub account.

## The intro, for fun

One label flips, and every pull request of the PRD should hear about it.

## The punchline, for fun

Everyone in the same account gets the memo; pen pals abroad wait for their next push.

## The options, in plain words

A. A. Default label name only; targets searched within the same account.
B. B. Forward every label change, and match the repository's own approved label in the rerun.
C. C. Search targets across every account the installation reaches.

## What I had to decide

Confirm the rerun's reach: the default label name only, and target PRs in the same account only.

## What I did meanwhile

The webhook reads no repository config, so a repository that renames labels.approved gets no label rerun (its PR events still run the check). Target PRs are found with GitHub search 'Part of <owner/repo>#<n>' is:pr is:open user:<owner>, filtered to bodies that start with that line.

## What it costs to change later

A filter in apps/omni-app/src/webhook/webhook.ts and the search query in apps/omni-app/src/approved-check/github.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Cross-account targets and renamed labels were not measured: no repository is known to use either today.
