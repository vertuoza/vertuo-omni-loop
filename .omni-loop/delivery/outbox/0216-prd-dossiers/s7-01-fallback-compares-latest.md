---
id: s7-01-fallback-compares-latest
prd: 216
slice: s7
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The background reader that copies each PRD's files from the main branch fetches a file only when the PRD's record does not hold it yet. Should that mean the last version kept, or any version ever kept?

## The decision, in plain words

The last version kept, so a file that goes back to an earlier wording is kept as a new version, as the record's rule asks. When that last version came from someone's terminal, the reader compares it with the file without fetching the file again.

## The intro, for fun

A file changed its mind and went back to how it read last Tuesday.

## The punchline, for fun

The record noticed, and kept Tuesday's words as its newest page.

## The options, in plain words

A. Compare each file with the latest version of its kind, and hash a terminal upload's stored text when the sizes match
B. Compare with any version ever kept: fewer fetches, but a file that returns to an earlier wording is never recorded again
C. Fetch every file at every run and let the record's rule decide: simplest, but many more requests to GitHub

## What I had to decide

Whether the reader compares each file on the main branch with the latest version of its kind, or with every version the record already holds.

## What I did meanwhile

The reader compares each file with the latest version of its kind. A version uploaded from a terminal carries no file hash from the repository, so when the sizes match the reader hashes the stored text itself, instead of asking GitHub for the file again.

## What it costs to change later

One comparison and its tests change; nothing stored changes, and the next run follows the new rule.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the reader fetches only the files the record has not stored, and also that content going back to an earlier state is still a new version. Read literally, the first rule would skip that return, so I followed the version rule.
