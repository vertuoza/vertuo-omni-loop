---
id: s2-01-s2-law-proof-fixtures-renamed
prd: 2305
slice: s2
rank: high
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Twenty-six arcade tests that prove locked rules had fictional names swapped in for the maintainer's real repository names and email domain. Is that rename fine to keep?

## The decision, in plain words

I renamed the sample repositories, organisation and email addresses inside those tests, and the assertions that read them, and changed nothing else about what they check.

## The intro, for fun

Twenty-six tests changed their name tags, and none of them changed their minds.

## The punchline, for fun

The rules still get the same checks, only the guests list now reads like a fiction.

## The options, in plain words

A. A. Keep the renamed tests, as built.
B. B. Revert those tests to the old names and leave them on the guard's baseline until a person renames them.

## What I had to decide

Approve the feature PR on GitHub as the law's owner once you have read the renamed tests; the rename is mechanical (a name or an address, never an expected value's meaning).

## What I did meanwhile

The tests are green with the new names and prove the same behaviour.

## What it costs to change later

A reviewer reads twenty-six test files whose only change is a name.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which of the locked rules each renamed test proves was not traced one by one (author)
