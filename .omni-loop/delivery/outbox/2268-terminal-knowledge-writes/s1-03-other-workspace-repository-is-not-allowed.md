---
id: s1-03-other-workspace-repository-is-not-allowed
prd: 2268
slice: s1
rank: high
bears-on: BR-PRODUCT-63
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When someone changes knowledge from a repository that belongs to another team, should the terminal say the repository was not found, or that they are not allowed?

## The decision, in plain words

It says they are not allowed, in the database's own words naming the team that owns the repository, as the terminal's reading of the same product already does.

## The intro, for fun

Knocking on the neighbours' door gets a polite no rather than a shrug.

## The punchline, for fun

And the no names whose door it was, which beats wondering if the house exists.

## The options, in plain words

A. Not allowed, naming the team that owns the repository, as the reading already says, as built.
B. Not found, saying nothing of who owns it.

## What I had to decide

The status of a change sent from another workspace's repository: the spec lists 404 for no such repository and 403 for not allowed, and the database refuses such a repository as not allowed (42501).

## What I did meanwhile

Built: 403 with the database's reason (`you are not a member of <team>, which owns <repo>`), as GET /api/constituents answers the same repository; 404 is kept for a repository in no product, a product it is not in, an archived product and an unknown item. Nothing is read or written for another team either way (law BR-PRODUCT-63 holds).

## What it costs to change later

A constant: one line of the service's refusal mapping, and the kit prints either status as a refusal with exit 1.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person would rather not learn which team owns a repository they cannot see (author)
