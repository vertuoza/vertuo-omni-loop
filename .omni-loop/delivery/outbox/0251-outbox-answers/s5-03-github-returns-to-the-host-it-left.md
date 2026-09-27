---
id: s5-03-github-returns-to-the-host-it-left
prd: 251
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

When the page sends a person to GitHub to post their answers, should GitHub bring them back to the address they left from, or always to the one main address?

## The decision, in plain words

GitHub is asked to bring them back to the address they left from. That address must be listed in the omni-loop App's settings, or GitHub refuses and nothing is posted.

## The intro, for fun

Every round trip needs a return ticket with the right station on it.

## The punchline, for fun

GitHub only stops at the stations it was told about.

## The options, in plain words

A. Ask GitHub to return to the host the person left from.
B. Let GitHub return to the first way back the App lists.

## What I had to decide

The spec names the way back and says a person adds it to the App's settings, but not whether a send names that way back itself or leaves GitHub to use the first one listed.

## What I did meanwhile

The send asks GitHub to return to the same host the person used, so the sign-in cookie and the send's cookie are there when they come back.

## What it costs to change later

One line in the send: leaving the way back to GitHub's default instead is a one-line change, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which addresses the omni-loop App's settings will list; a preview deployment will not work unless it is listed.
