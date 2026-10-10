---
id: s1-02-unlink-refused-while-consumed
prd: 1364
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

What happens when an owner removes a repository from a product while another repository of that product still depends on it?

## The decision, in plain words

The removal is refused, naming the repository that depends on it, so a product never lists a dependency on a repository it no longer holds.

## The intro, for fun

Pulling the bottom block out of the tower is a bold move.

## The punchline, for fun

The tower now asks you to move the blocks above it first.

## The options, in plain words

A. Refuse the removal and name the repository that depends on it, the option built.
B. Remove it, and silently take it out of every other link's dependencies in that product.

## What I had to decide

Whether taking a repository out of a product is refused, or also removes it from what the other repositories consume.

## What I did meanwhile

Refused, with the dependent repository named; the owner edits that link first.

## What it costs to change later

One check in the remove function; switching to the silent clean-up is a small change of that function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- what the Repositories and approvers tab should offer when the removal is refused (author)
