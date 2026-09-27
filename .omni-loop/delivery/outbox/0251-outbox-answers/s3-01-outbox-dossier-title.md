---
id: s3-01-outbox-dossier-title
prd: 251
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

When the questions of a plan reach the Omni page before its documents do, what should the new page for that plan be called?

## The decision, in plain words

It is called after the plan's number, like "PRD 7", until the plan's documents arrive and give it their own title.

## The intro, for fun

Every page needs a name, even one that shows up early.

## The punchline, for fun

"PRD 7" is no poem, but it will answer to it until the spec arrives.

## The options, in plain words

A. Name it after the plan's number until its documents arrive (as built).
B. Have the App send the plan's own title along with its questions.
C. Refuse the questions until the plan's documents have reached the page.

## What I had to decide

The spec says the outbox route finds or creates the PRD's dossier by its key, but a dossier needs a title (1 to 200 characters) and the App's body carries none. I had to pick the title of a dossier the outbox creates.

## What I did meanwhile

dossier_outbox_put() titles a dossier it creates `PRD <n>`. The next kit push or PRD 216's fallback retitles it from the spec, as they already do; a dossier that already exists keeps its title.

## What it costs to change later

One string in the migration's function (and the fake store). A later title rule is a follow-up migration replacing the function; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the relay should carry the spec's title instead, which the App could read from the head's delivery folder.
