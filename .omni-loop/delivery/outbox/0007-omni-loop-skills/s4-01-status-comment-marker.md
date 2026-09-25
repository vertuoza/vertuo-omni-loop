---
id: s4-01-status-comment-marker
prd: 7
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

How should the agent find its own status comment on a pull request, so it rewrites that one and never another?

## The decision, in plain words

It looks for a hidden marker built from the configured marker prefix, and rewrites the first comment that carries it, or posts a new one when none does. Because the marker shares the outbox prefix, the reply reader already ignores it.

## The options, in plain words

A. Match the marker alone, first comment wins, the option built.
B. Match the marker and the configured bot user, so a pasted marker is never overwritten.
C. Add an omni command that upserts the status comment, and have the skill call it.

## What I had to decide

The status comment's marker and how `/omni:pr` upserts it, replacing upstream's `gh pr comment --edit-last`.

## What I did meanwhile

The marker is `<!-- <markers.prefix>-status -->`. The skill lists the PR's issue comments with `gh api ... --paginate --jq`, takes the first whose body contains the marker, and PATCHes it; otherwise `gh pr comment --body-file`. It does not filter by author. Sharing the prefix means `kit/lib/outbox/replies.mjs` skips it (it drops comments containing `markers.any`), so a status comment is never read as a reply.

## What it costs to change later

A few lines of `kit/plugin/skills/pr/SKILL.md`; existing comments with the old marker would be orphaned and a new one posted.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a second agent or a person might paste the marker into a comment, which an author filter on `github.user` would guard against.
- Whether a later `omni` command should own the upsert instead of skill prose.
