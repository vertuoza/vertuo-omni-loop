---
id: s1-03-fixed-names-kept-rows
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

Should a repository's own runner skill that an owner allowed under a name the loop now uses for itself be removed?

## The decision, in plain words

No: such an allowance stays stored as it is. It can never run, since a line naming one of the loop's own skills without its prefix is refused on the server and on the runner.

## The intro, for fun

Seven names joined the loop's own list, and someone may have used one first.

## The punchline, for fun

The old key stays on the hook; it just opens nothing now.

## The options, in plain words

A. A. Keep the rows; they never run (built).
B. B. Delete them in the migration.

## What I had to decide

The database's list of the loop's own skills grew by seven names. A repository could have allowed a skill of its own under one of them before. The spec does not say whether those allowances are removed.

## What I did meanwhile

The migration changes the list and no row. Such a row can no longer be switched off from Settings, which refuses a name of the loop's own, so it stays until a migration removes it.

## What it costs to change later

A constant: a later migration could delete those rows in one statement.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any workspace holds such a row today (author): I could not read the production database from here.
