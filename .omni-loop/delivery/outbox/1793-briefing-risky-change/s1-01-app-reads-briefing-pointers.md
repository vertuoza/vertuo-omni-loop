---
id: s1-01-app-reads-briefing-pointers
prd: 1793
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

On GitHub, the check only sees the files the briefing points to when it already downloads the playbook, which happens when the repository keeps its rules in the knowledge folder. Should the check also download the briefing in every other repository, so a change to a file it points to is always caught there?

## The decision, in plain words

The check on GitHub catches every change to the briefing itself in every repository. It catches a change to a file the briefing points to only where it already downloads the playbook; the terminal check catches it everywhere.

## The intro, for fun

A rulebook that says see page twelve is only as safe as whoever checks page twelve.

## The punchline, for fun

Here the terminal always turns the page; the GitHub check turns it when the folder is already open.

## The options, in plain words

A. A. Leave the App's download as it is: the briefing's own path is caught everywhere, its pointers where the playbook is already downloaded.
B. B. Also download the briefing form at the head of every checked pull request, so its pointers are read in every repository.
C. C. Catch the briefing's pointers only in the terminal check, and say so in the guide.

## What I had to decide

Whether the check on GitHub downloads the briefing on every pull request, so it reads its pointers in every repository.

## What I did meanwhile

The briefing's own file is caught everywhere. A file it points to is caught on GitHub where the laws live in the knowledge folder with the playbook inside it, as here, and always by the terminal check.

## What it costs to change later

Option B is one more downloaded file per checked pull request and a change to the App's check, outside this slice's ground.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many repositories keep a pointer briefing outside the knowledge folder is unknown (author).
