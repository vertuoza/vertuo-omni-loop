---
id: s1-04-skills-proof-later-names
prd: 2873
slice: s1
rank: medium
bears-on: BR-PRODUCT-140
raised: 2026-11-14
wave: 1
---

## The question, in plain words

May the test that proves a repository's own runner skills never take one of the loop's own names leave out the three new names, as it already leaves out the four added after it?

## The decision, in plain words

Yes: that test reads the first version of the database's list, which never held the new names, so it now leaves them out the way it leaves out the four added later. A new test holds the database's newest list equal to the app's whole list, the new names included.

## The intro, for fun

An old test checks an old list, and the list just grew again.

## The punchline, for fun

The first page of the guest book stays as it was signed.

## The options, in plain words

A. A. Leave the three new names out of the old test too, and check the newest list in a new test (built).
B. B. Rewrite the old test to read the newest migration itself, replacing the new test.

## What I had to decide

The test of the first migration that made the database's list compares it with the app's list minus the skills added later. Runners now take three more skills, so without a change it fails, though nothing it guards changed. The file is one of the proofs of a proposed rule, so a change to it is a person's to answer.

Decided by: Jev (hardToRevert 0.64) · agent said true

## What I did meanwhile

Added the three ultra skills to the names that test leaves out, with a comment naming the migration that adds them. The new test in its own file checks the newest list whole, so the database's list cannot fall behind the app's again unseen.

## What it costs to change later

A constant: one list in a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the rule's text is unchanged, and so is every other check of that test.
