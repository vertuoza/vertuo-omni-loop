---
id: s9-13-design-paths-ignore-tests
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The check that says whether a change touches a screen counts test files as screens, because they live in the same folders: this very feature reads as a screen change only because of two test files. Should the check be able to leave some files out?

## The decision, in plain words

The folders are listed whole, as the spec asks, and test-only changes read as screen changes.

## The intro, for fun

The smoke alarm goes off every time someone makes toast.

## The punchline, for fun

Soon everyone learns to ignore it, fire included.

## The options, in plain words

A. List the folders whole, tests included (built)
B. Let the paths leave out tests and other files that hold no screen
C. List only the files that render a screen, one pattern each

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: design.paths accepts exclusions (a leading ! or a design.ignore list), so a repository leaves out tests, fixtures and server-only files; invade proposes the exclusions it can prove.

## What I did meanwhile

Nothing of the kit changed in this slice. omni design touched origin/main on this branch prints ui: yes for apps/galaxy/src/docs/docs.test.ts and guide.test.ts only. A replay of eight past commits found tests in every match, 341 of 670 paths in PRD 976's. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) apps/omni-app/src/ holds no screen at all (it is the GitHub App's server); it is listed because the spec names it
