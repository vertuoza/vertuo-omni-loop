---
id: s3-03-members-and-fleets-read-twice
prd: 1030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The business page's people panel reads the team's members and crews the same way the shared people directory does, but that directory sits outside this work. Who owns the rules for those rows?

## The decision, in plain words

The business page states its own copy of the members and crews rules, matching the people directory's word for word, rather than changing a part of the app no step of this plan covers.

## The intro, for fun

Two pages reading the same roster is fine until one of them learns a new name.

## The punchline, for fun

For now they read from twin copies of the same list.

## The options, in plain words

A. A. Keep a copy beside the business page: the option built.
B. B. Have the people directory share its rules, a change outside every step of this plan.
C. C. Read the people through the directory's own loader, which reads the members a second time for the page.

## What I had to decide

Whether the business page reuses the people directory's rules for a member and a crew, which that directory keeps to itself, or states its own.

## What I did meanwhile

A small file beside the business page holds the member, crew and owner rules, the same as the people directory's, and the compiler checks that what they read is what the directory takes.

## What it costs to change later

Deleting the copy and importing the directory's once it shares its rules: one import, in a later change to the people directory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no step of this plan names the people directory, so its rules cannot be shared from here
- a column added to the members list must be added in both places until then
