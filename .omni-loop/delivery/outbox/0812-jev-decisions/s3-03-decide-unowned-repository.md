---
id: s3-03-decide-unowned-repository
prd: 812
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When a terminal asks Jev about a repository that no workspace has claimed, whose settings apply?

## The decision, in plain words

We follow the same rule as the question pages: the repository goes to the first workspace the person joined, so that workspace's Jev settings apply; a repository another workspace owns is refused.

## The intro, for fun

A stray repository knocks on the door, and someone has to let it in.

## The punchline, for fun

It moves in with whoever you met first.

## The options, in plain words

A. Keep it as built: the same rule as ask mode, the first workspace joined.
B. Refuse any repository whose organisation no workspace owns, so no Jev settings apply to it.

## What I had to decide

POST /api/decide asks repo_workspace() (PRD 459), which falls back to the caller's first-joined workspace when no workspace owns the repository, and refuses (403) when another workspace owns it. The route refuses only when repo_workspace() names no workspace.

## What I did meanwhile

Built on repo_workspace() as ask mode and dossiers do.

## What it costs to change later

One check in the route: refuse when the repository's org matches no workspace.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an owner expects their Jev settings to reach repositories of organisations the app is not installed on (author)
