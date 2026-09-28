---
id: s10-03-page-line-needs-repo-name
prd: 251
slice: s10
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When a repository's settings do not name the repository itself, should the question list on the pull request still point at the Omni page?

## The decision, in plain words

No: without the repository's name the short link cannot be written, so the list leaves the line out and people answer on the pull request as before.

## The intro, for fun

A link needs an address, and this one was missing a street name.

## The punchline, for fun

No address, no signpost; the old road still works.

## The options, in plain words

A. Leave the line out when the settings do not name the repository.
B. Have the GitHub helper pass the repository's name it already knows, so the line is always there.
C. Point at the plans list instead of the plan when the name is missing.

## What I had to decide

The spec says the list points at the Omni page when the answers switch is on and the page address is set. The short link also needs the repository's owner and name, which a repository's settings may leave out.

## What I did meanwhile

The line is written only when the switch is on, the page address is set, the settings name the repository and the plan's number is known; otherwise the comment reads exactly as before. Carried over from the first build, where the same decision was adopted.

## What it costs to change later

One condition in the kit's comment writer, and a rebuilt bundle. The helper could read the name from the pull request instead, which it knows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many installed repositories leave their own name out of their settings.
