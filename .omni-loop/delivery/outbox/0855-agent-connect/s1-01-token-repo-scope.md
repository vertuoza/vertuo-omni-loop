---
id: s1-01-token-repo-scope
prd: 855
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

Which repositories may an agent's link ask about: only the ones the workspace lists, or also any repository its GitHub organisation owns?

## The decision, in plain words

A link reads a repository the workspace lists, or any repository its GitHub organisation owns, which is exactly what a member's own read already allows; any other repository is refused.

## The intro, for fun

A link walks up to a repository it has never met and asks to come in.

## The punchline, for fun

It may, if the family name on the door matches the workspace's.

## The options, in plain words

A. A. Listed repositories, or any repository the workspace's GitHub organisation owns (as a member's read).
B. B. Only the repositories the workspace lists.
C. C. Only the repositories the workspace tracks.

## What I had to decide

Whether a link may read a repository the workspace does not list but its GitHub organisation owns.

## What I did meanwhile

Such a repository reads the business's own claims (the region), as a member's read does, and never another workspace's.

## What it costs to change later

One condition in the database function that reads through a link.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a team expects an unlisted repository of its organisation to be readable through a link has not been asked (author).
