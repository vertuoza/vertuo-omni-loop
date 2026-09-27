---
id: s4-02-search-every-word-of-title
prd: 216
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

The list of PRDs has a search over titles. When someone types several words, must a PRD's title hold all of them, or is one enough?

## The decision, in plain words

All of them, in any order and in any case, and a word also matches inside a longer one. This is how the question history's search already behaves, so the two searches feel the same.

## The intro, for fun

Someone typed three words into the search box and expected the list to listen to all three.

## The punchline, for fun

It did. Titles holding one word out of three stayed home.

## The options, in plain words

A. Keep a PRD when its title holds every word typed, as the question history's search does
B. Keep a PRD when its title holds any of the words typed
C. Match the words typed as one phrase, in that order

## What I had to decide

Whether a search with several words keeps the titles holding every word, or the titles holding any of them.

## What I did meanwhile

The search keeps a PRD when each word typed appears somewhere in its title, ignoring case, as the question history's search does with questions and answers.

## What it costs to change later

One line of the page's filtering; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a search finds a dossier by a word of its title, without saying what several words mean together.
