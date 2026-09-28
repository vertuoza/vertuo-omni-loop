---
id: s3-01-refused-repo-keeps-ask-mode-on
prd: 459
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When someone switches ask mode on in a repository whose questions cannot go to any page, should ask mode still switch on?

## The decision, in plain words

Ask mode switches on anyway and prints the reason under the page link; every question then comes back to the terminal, as it does whenever the page cannot take one. The page gives 'nowhere, and here is why' as a normal answer, not as an error.

## The intro, for fun

The letterbox is painted on a wall with no door behind it.

## The punchline, for fun

The post still arrives, it just lands back on your own desk.

## The options, in plain words

A. Switch ask mode on and print the reason; questions fall back to the terminal.
B. Leave ask mode off, print the reason as an error, and stop with a failure.
C. Switch ask mode on but print the reason as a warning on the error stream.

## What I had to decide

Whether a refused repository should keep ask mode off, or switch it on with the reason shown.

## What I did meanwhile

Ask mode switches on, the second line names the reason, and each question falls back to the terminal because the page refuses the session.

## What it costs to change later

Refusing instead is a few lines in the ask command and one test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says to print the reason but not whether ask mode should then stay off (author).
