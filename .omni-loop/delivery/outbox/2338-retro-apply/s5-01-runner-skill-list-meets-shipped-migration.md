---
id: s5-01-runner-skill-list-meets-shipped-migration
prd: 2338
slice: s5
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

The database's own copy of the list of skills a runner runs, written in a migration that already shipped, does not name the new retro skill: should a follow-up migration add it?

## The decision, in plain words

The new skill is on every list but the database's older copy, which only decides which names a repository's owner may not reuse for a skill of their own. Its test now expects the older list.

## The intro, for fun

The skill list grew a name; one old copy never got the memo.

## The punchline, for fun

A later migration can hand it the memo, and nothing runs in the meantime.

## The options, in plain words

A. A. Leave the shipped migration alone and let its test expect the list without retro-apply, with a comment saying why.
B. B. Add a follow-up migration, in a slice of its own, that adds retro-apply to the database's list, and restore the test's full expectation.

## What I had to decide

Keep A, or add the follow-up migration that redefines set_repository_runner_skill with retro-apply in its list (B).

## What I did meanwhile

Everything else names retro-apply; the line check of the kit and the app already refuse a repository skill of that name when a job runs.

## What it costs to change later

B is one new migration copying the function with one more name, plus the test's expectation going back to the full list; A is undone by deleting the filter in the test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The PRD names no migration for the skill list, and the slice's territory holds no supabase path, so a migration would leave it. (author)
