---
id: s3-01-long-lines-cut-on-the-runner
prd: 1904
slice: s3
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

A job's log can hold a line longer than the app stores, such as raw install output. The spec says the app refuses such lines but not what the runner does with them, and a refused report would stop the runner.

## The decision, in plain words

The runner cuts any line longer than the app stores to that length before it sends it, so a report is never refused for a long line. The full line stays in the log on the machine.

## The intro, for fun

Some log lines arrive wearing a very long scarf.

## The punchline, for fun

We trim the scarf at the door; the rest stays in the closet.

## The options, in plain words

A. A. The runner cuts a line too long for the app to the app's length before sending it (as built).
B. B. The app accepts any line and cuts it itself, so an older runner never trips on a long line.

## What I had to decide

Whether a line too long for the app is cut by the runner (as built), or the app should accept and cut it itself.

## What I did meanwhile

Long lines show cut in the Terminal panel; the whole line is still in the job's log file on the runner.

## What it costs to change later

One constant on the runner: changing the length or moving the cut to the app is a small change, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The cut keeps the first 600 characters; whether a marker should show the line was cut was not decided (author).
