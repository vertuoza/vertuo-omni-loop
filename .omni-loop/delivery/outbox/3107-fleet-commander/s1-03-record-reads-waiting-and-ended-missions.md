---
id: s1-03-record-reads-waiting-and-ended-missions
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The spec has the Commander read the last events of each running mission. A mission waiting on a person, paused, or one that ended overnight is not running: should the Commander read its events too?

## The decision, in plain words

It reads the last 50 events of every mission that runs, waits or is paused, and of every mission that ended in the last 24 hours, with the jobs of all of them; the cap on one message's input still holds.

## The intro, for fun

A mission waiting on you is the one you most want to ask about.

## The punchline, for fun

Skipping it because it is not running would be like ignoring the patient in the waiting room.

## The options, in plain words

A. A. As built: missions that run, wait or are paused, and those that ended in the last 24 hours.
B. B. Running missions only, as the spec words it.
C. C. Running, waiting and paused missions, none that ended.

## What I had to decide

A answers what members ask most (what waits on me, what happened overnight, why did it stop), which a waiting, paused or just-ended mission holds; B reads running missions only, as the spec words it, and the Commander then answers that it found nothing about them.

## What I did meanwhile

The record holds every mission that runs, waits or is paused and those that ended in the last 24 hours, at most 50 events each, trimmed first when one message's input would pass 40,000 tokens.

## What it costs to change later

Narrowing it is one line of the rules; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's own example, PRD 2817 waiting on a review, is a mission that waits rather than runs. (author)
