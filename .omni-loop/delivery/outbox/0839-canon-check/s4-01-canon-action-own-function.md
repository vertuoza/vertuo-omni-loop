---
id: s4-01-canon-action-own-function
prd: 839
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

Where should the App answer a click on the two buttons of a red canon check, and may that touch three files the slice did not own?

## The decision, in plain words

A click becomes one message the App answers in a small job of its own, next to the inbox check. Three lists outside the slice's own ground that name every job and every GitHub action were updated by one line each.

## The intro, for fun

Two new buttons need someone to answer the door.

## The punchline, for fun

We hired a doorman and told the building's directory.

## The options, in plain words

A. Answer each click in a small job of its own, and update the three lists that name every job and action.
B. Answer clicks inside the inbox check's own job, which waits five seconds and may swallow a click that lands during a push.
C. Post the comment straight from the webhook, which would then call GitHub itself for the first time.

## What I had to decide

Whether the button clicks get their own small job, which means updating the App's manifest note and two tests that list every job and action, all outside this slice's ground.

## What I did meanwhile

A new job answers each click and posts or edits one comment; the App's manifest note, its manifest test and the jobs list test each gained one line naming it.

## What it costs to change later

Moving the clicks into the inbox check itself is a small change to two modules and the same three lines back; nothing stored moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's ground for this slice names the webhook, the inbox check and the App's routes, but not the manifest or the two tests that list every job and action.
