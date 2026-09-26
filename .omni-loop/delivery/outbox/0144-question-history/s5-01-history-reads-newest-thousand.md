---
id: s5-01-history-reads-newest-thousand
prd: 144
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

The history has to filter and search every question the workspace was ever asked, and the database cannot search inside the stored questions directly. How far back should it look?

## The decision, in plain words

The history reads the newest thousand questions of your workspaces and filters and searches within them. Older ones stay kept and open by their link, but a filter or a search will not find them.

## The intro, for fun

A history that remembers everything still has to decide how far back to read.

## The punchline, for fun

A thousand questions back, for now; the attic can wait.

## The options, in plain words

A. Read the newest thousand questions and filter and search within them
B. Filter and search in the database over every question, with a text index
C. Read the newest thousand, and page further back on demand

## What I had to decide

Whether the history should look back only over the newest thousand questions, or search every question the database holds.

## What I did meanwhile

The page reads the newest 1000 rounds the caller may see, newest first, and applies every filter and the search to them in the app. The number is one constant.

## What it costs to change later

Raising the number is a one-line change. Searching everything means moving the filters and the search into the database (a view or a function with a text index), a migration and a new read, with the page unchanged.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the history lists every round and is searched over questions and answers, but not how many rounds it must reach, nor where the search runs (author)
- How many questions a workspace asks a month is not known yet, so the thousand is a guess (author)
