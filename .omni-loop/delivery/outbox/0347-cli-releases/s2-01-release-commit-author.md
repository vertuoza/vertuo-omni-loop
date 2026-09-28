---
id: s2-01-release-commit-author
prd: 347
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Whose name should the automatic release commit on the main branch carry as its author?

## The decision, in plain words

The release commit is authored by the standard GitHub Actions bot account, and also names Omni-man as co-author. The hosting of the two web apps may refuse to deploy a commit whose author is not a team member, which would leave their production one step behind until someone deploys by hand.

## The intro, for fun

Every merge now ends with a tiny commit nobody typed.

## The punchline, for fun

Somebody has to sign the guest book, even a robot.

## The options, in plain words

A. The GitHub Actions bot authors it, the account the workflow's token pushes as (built).
B. Omni-man authors it: the signature's name and address as author and committer, the trailer kept.
C. The person whose merge started the run authors it, read from the push event, so the hosting sees a team member.

## What I had to decide

Keep the Actions bot as the release commit's author, or author it as Omni-man, or as the person whose merge started the run.

## What I did meanwhile

The release workflow authors and commits as github-actions[bot] (GIT_AUTHOR_* and GIT_COMMITTER_* in .github/workflows/release.yml), with the Omni-man trailer in the message.

## What it costs to change later

A constant: four environment lines in the workflow. Nothing stored changes; past release commits keep their author.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Vercel projects of apps/galaxy and apps/omni-app block a deployment of a commit authored by github-actions[bot] was not checked (author).
- Whether Vercel deploys a push made with the workflow's own token at all was not checked (author).
