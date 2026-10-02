---
id: s16-03-fake-people-list
prd: 976
slice: s16
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The test stand-in for the database takes a list of people that it never reads, and the linter flags it. Remove it, though tests in other slices' ground still pass it?

## The decision, in plain words

The list stays accepted but is plainly documented as read by nothing, so no test outside this slice had to change and nothing a test checks moved.

## The intro, for fun

A guest list was handed to the doorman at every test, and he never once looked at it.

## The punchline, for fun

He still takes it politely, and now the sign says he does not read it.

## The options, in plain words

A. Keep the list accepted and documented as unread, editing no test outside this slice.
B. Remove the list and edit every test that passes it, across other slices' ground.
C. Make the stand-in refuse anyone not on the list, which changes what the tests check.

## What I had to decide

Whether to remove the unused people list from the test stand-in for the database, which would mean editing tests in other slices' ground.

## What I did meanwhile

The stand-in's signature keeps an optional people list as part of its declared type only; its body takes just the seed tables.

## What it costs to change later

A constant: dropping the list later means deleting one argument from about twenty test calls, in one change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the list was meant to be used, for instance to refuse a client for someone it does not name, is not written anywhere (author)
