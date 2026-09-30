---
id: s2-01-which-twelve-files-first
prd: 774
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

A repository can hold more readable documents than the draft reads. When there are more than twelve, which ones come first, and which product write-ups count as the most recent?

## The decision, in plain words

The main readme first, then the documentation pages by name, then the most recent product write-ups, newest first, until twelve are read. The newest write-ups are the ones with the highest numbers.

## The intro, for fun

Twelve seats at the table, and more documents than chairs.

## The punchline, for fun

The readme sits first; the latest write-ups take what is left.

## The options, in plain words

A. A. Readme, then documentation pages, then the newest write-ups by number, up to twelve
B. B. Readme, then the newest write-ups, then documentation pages
C. C. Keep room for each kind, such as four documentation pages and seven write-ups
D. D. Find the write-ups that shipped last from their merge dates, at the price of more GitHub calls

## What I had to decide

Whether the readme and the documentation pages should come before the product write-ups when a repository holds more than twelve, and whether the highest number is a fair stand-in for the most recently shipped.

## What I did meanwhile

The draft reads the readme, then the documentation pages in name order, then the product write-ups from the highest number down, and stops at twelve files per repository.

## What it costs to change later

An ordering rule in one function; nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the three kinds of files and the cap of twelve, but not which kind wins when they do not all fit, nor how to tell which write-up shipped last without extra calls to GitHub.
