---
id: s7-02-one-pull-request-per-change
prd: 2417
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 4
---

## The question, in plain words

When a workspace owner changes the same playbook page twice before anyone merges the first change, does the second change join the first pull request or open a new one?

## The decision, in plain words

Each change opens its own pull request on a branch of its own, named after the page and the time it was sent, and the pull request names the owner who proposed it.

## The intro, for fun

Two drafts of the same page walk into the settings repository.

## The punchline, for fun

Each gets its own desk, and whoever merges picks the better one.

## The options, in plain words

A. Every change opens its own branch and pull request (built).
B. A change to a page with an open pull request from the Omni page adds a commit to that pull request instead.
C. A change to a page with an open pull request is refused until that pull request is merged or closed.

## What I had to decide

Whether a second change to a page with an open pull request opens a new pull request (built) or adds a commit to the open one.

## What I did meanwhile

omni-settings.service.ts names each branch `omni-settings/<form>-<UTC time>` (playbookChange) and the writer always cuts it from the default branch's head; nothing on the Omni page remembers an open pull request, since Never 6 keeps the text only in the pull request.

## What it costs to change later

Reusing an open pull request later means the writer first looks for an open branch of that page on GitHub; the branch name's shape is one constant.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan say a change opens a pull request, not what a second change to the same page does.
