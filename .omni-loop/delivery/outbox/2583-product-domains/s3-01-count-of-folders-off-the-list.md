---
id: s3-01-count-of-folders-off-the-list
prd: 2583
slice: s3
rank: medium
bears-on: none
raised: 2026-11-02
wave: 3
---

## The question, in plain words

The number on the Domains tab says how many folders are not on the list. Should it count a folder whose name cannot be a key, and a retired domain still found in a repository?

## The decision, in plain words

The number counts every folder the list does not hold, including one whose name cannot be a key, because the owner needs to know it exists. A retired domain still in a repository is shown but not counted, and a repository that was not read yet adds nothing.

## The intro, for fun

Counting what is missing turns out to need a rule of its own.

## The punchline, for fun

The tab now counts the strays, and only the strays.

## The options, in plain words

A. A. Count every folder off the list, a name that cannot be a key included; leave out retired domains and unread repositories.
B. B. Count the retired domains still in a repository as well.
C. C. Count only the folders that can be added, leaving out those whose name cannot be a key.

## What I had to decide

Answer A to keep the count as built; answer B to count retired domains still in a repository too; answer C to leave out folders whose name cannot be a key.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

The tab counts every folder off the list, the ones that cannot be a key included, and leaves retired ones out.

## What it costs to change later

Changing it is one line in the module that works out the folders; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the number not on the list is shown, but not whether a folder that cannot be a key, or a retired domain still in a repository, belongs to it.
