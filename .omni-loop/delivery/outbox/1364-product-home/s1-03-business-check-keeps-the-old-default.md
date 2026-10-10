---
id: s1-03-business-check-keeps-the-old-default
prd: 1364
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

An older database check still expects a repository added later to land in the first product, which this slice stops on purpose. Who updates that check?

## The decision, in plain words

This slice leaves that check alone because it belongs to the third slice's territory, so the database checks of the expand landing stay red on that one line until the third slice rewrites it.

## The intro, for fun

The old rule left, but its farewell card is still pinned to the fridge.

## The punchline, for fun

Someone in the third slice gets to take it down.

## The options, in plain words

A. Leave the business check to the third slice, which owns it, the option built.
B. Edit the business check in this slice, outside its territory, so the landing is green at once.

## What I had to decide

Whether this slice edits the business check outside its territory, or leaves it to the slice the plan gives it to.

## What I did meanwhile

Left to the third slice, which owns the business check: it must drop the assertion that a repository added later points at the first product, or turn it into the opposite.

## What it costs to change later

One assertion in one check; until it changes, the expand landing's database checks are red on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan should have given the business check to this slice (author)
