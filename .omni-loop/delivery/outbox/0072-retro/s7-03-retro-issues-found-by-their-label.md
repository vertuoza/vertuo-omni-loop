---
id: s7-03-retro-issues-found-by-their-label
prd: 72
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

To avoid opening the same issue twice, the retro looks for the one it opened before. Where should it look?

## The decision, in plain words

It looks among the issues carrying the retro label, open or closed. An issue whose label was removed by hand is no longer found, and the next run opens a fresh one.

## The intro, for fun

Finding an old note is easy when it wears a name tag.

## The punchline, for fun

Take the tag off, and the retro writes a brand new note, very politely.

## The options, in plain words

A. Look among the issues carrying the retro label, the option built.
B. Look among every issue of the repository, slower on a large one but blind to labels.
C. Use GitHub's search, quick but sometimes a few seconds behind, so a quick retry could open a twin.

## What I had to decide

The spec says: 'Before it creates an issue the app looks for one carrying the same PRD and finding id'. It does not say where. GitHub's issue search lags behind, so a retry seconds after a half-done step can miss an issue it just opened; listing every issue of a repository is slow on a large one.

## What I did meanwhile

`publishIssues` lists `GET /repos/{owner}/{repo}/issues` with `labels` set to `labels.retro` and `state: all` (at most `MAX_PAGES` pages), leaves pull requests out, and matches the marker `<!-- <markers.prefix>-retro: prd=<n> finding=<id> -->`. With several matches the open one wins, then the oldest. An open match is rewritten only when its title or body changed; a closed one is not written to at all.

## What it costs to change later

A constant: the list's filter. Widening it to every issue of the repository costs more reads per run and stores nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How often a retro issue loses its label by hand while staying in use, which is when a second one would be opened.
