---
id: s2-01-security-report-summary-line
prd: 1717
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The spec says the daily watch titles its issue with what is wrong, but not where that wording comes from, nor how the check finds which repository to read.

## The decision, in plain words

The check ends its report with one summary line, green or red with what is wrong, for the watch to reuse as its issue title. It reads the repository name from the loop's settings file on its own, so the watch can run it without installing anything first.

## The intro, for fun

Every alarm needs a headline, and this one writes its own.

## The punchline, for fun

One line to read, and nothing to install before reading it.

## The options, in plain words

A. A. One summary line last, and the repository name read directly from the settings file, with nothing to install (built)
B. B. No summary line: the watch builds its own title from the report's lines
C. C. Read the settings file with the loop's shared reader, which needs an install before each daily run

## What I had to decide

Keep the summary line as the last line of the report, in the shape security settings: green, or security settings: red: followed by each problem; the watch slice uses it as its issue title. Keep reading the repository name directly from the settings file.

## What I did meanwhile

The watch slice can take the last line of the report as the issue title, after the words Security settings.

## What it costs to change later

Changing the wording later is one line in the check and one in its tests; switching to the shared settings reader means installing the tools before every daily run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The watch slice is not built yet, so whether it will use the summary line as its title is not proven here.
