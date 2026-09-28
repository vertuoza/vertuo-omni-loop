---
id: s1-03-slug-collision-numbered
prd: 359
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

A new workspace takes its short web name from the GitHub account's name. When that name is already taken by another workspace, or is too short or too long to be one, what should it get instead?

## The decision, in plain words

It gets the name with a number added, like acme-2, trimmed to fit. The workspace's shown name stays the GitHub account's name either way.

## The intro, for fun

Two companies named Acme walk into a sign-up page.

## The punchline, for fun

The second one leaves as acme-2 and pretends it chose that.

## The options, in plain words

A. A: add -2, -3 and so on to the lowercased login (built)
B. B: refuse the install and show an error screen
C. C: add a short random suffix

## What I had to decide

How create_workspace_from_installation picks a slug when the lowercased login is taken or invalid, and what it answers.

## What I did meanwhile

Slug candidates are the lowercased login, then login-2, login-3 and so on, cut to 32 characters; a one-letter login becomes x-2. The function answers workspace_id, slug, role and created, for s4 to redirect with.

## What it costs to change later

A constant: the slug rule lives in one loop; existing slugs never change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the collision case as a test seam but not its rule (author)
