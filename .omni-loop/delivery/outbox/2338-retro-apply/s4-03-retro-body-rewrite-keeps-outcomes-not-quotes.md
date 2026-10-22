---
id: s4-03-retro-body-rewrite-keeps-outcomes-not-quotes
prd: 2338
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When the retro writes its pull request again, on a replay or two weeks after the merge, its new text keeps each lesson's outcome but not the exact rule words the settling skill quoted. Is that enough for the reviewer?

## The decision, in plain words

The rewritten text shows, under each finding, where the lesson went or why it stays, and closes the issue of each settled lesson. The rule's own words stay in the change itself, where the reviewer reads them, but not in the text.

## The intro, for fun

The retro came back two weeks later and tidied the notes.

## The punchline, for fun

It kept every verdict, just not the quotes.

## The options, in plain words

A. Rewrite the text, keeping each outcome and closing each settled lesson's issue (built)
B. Leave the text alone once the settling skill has written it

## What I had to decide

Keep the rewrite as built (A), or leave the pull request's text alone once the settling skill has written it (B).

## What I did meanwhile

The rewrite shows each outcome and closes each settled lesson's issue; the quoted rule is in the diff.

## What it costs to change later

B is a check in the publish step before it rewrites the text: no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The settling skill, built in a later slice, writes the quoted rules into the pull request's text, and the spec does not say what a later rewrite by the retro keeps of them. (author)
