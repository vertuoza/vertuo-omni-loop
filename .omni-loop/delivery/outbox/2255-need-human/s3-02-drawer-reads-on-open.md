---
id: s3-02-drawer-reads-on-open
prd: 2255
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

Should the Need human drawer fetch a job's questions when it opens, or should the Runners page carry every waiting job's questions from the start?

## The decision, in plain words

The drawer asks the Omni app for the job's questions when it opens, so the page itself stays as light as it is today and a person always reads the current state, including who answered first.

## The intro, for fun

Why carry every question on your back when you can ask at the door?

## The punchline, for fun

The drawer knocks once, reads the answer, and only then pulls up a chair.

## The options, in plain words

A. A. The drawer reads the questions when it opens (built)
B. B. The page's server read carries the questions of every waiting job

## What I had to decide

Pick A to keep the read on open, or B to have the page's server read the questions of every waiting job and hand them to the drawer ready to show.

## What I did meanwhile

I built A: the drawer shows a short reading line, then the questions or who closed them. The demo page seeds its drawer from its own sample questions, so it shows the full form at once.

## What it costs to change later

Moderate to change: B means the page's server read joins the questions table for the waiting jobs, which touches the data layer another slice owns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the drawer holds the lead and the questions but not when they are read (author)
- I did not measure how many waiting jobs a busy workspace would carry at once (author)
