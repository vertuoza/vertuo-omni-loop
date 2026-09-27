---
id: s5-01-settled-meanwhile-asks-before-github
prd: 251
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

When some answers are left out because their questions were settled while the person was answering, should the page stop and say so before going to GitHub, or go straight on?

## The decision, in plain words

The page stops, names the questions it left out, and offers one button to send the rest through GitHub. When nothing is left out, it goes straight to GitHub.

## The intro, for fun

Someone else answered while you were still thinking it over.

## The punchline, for fun

The page tells you before it posts, not after.

## The options, in plain words

A. Stop and say which questions were left out, then send the rest on one click.
B. Go straight to GitHub and say which were left out once the person comes back.
C. Refuse to send at all until the person reviews the page again.

## What I had to decide

The spec says a pick settled meanwhile is dropped and the tab says so, but the send then leaves the page for GitHub at once, so a note on the tab would never be seen.

## What I did meanwhile

The send answer lists the dropped question numbers; the tab removes those picks, shows which questions were left out, and waits for the person to press Send the rest through GitHub.

## What it costs to change later

One branch in the tab's send handler: going straight on instead is a few lines, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people would rather not have the extra click in the rare case a question is settled meanwhile.
