---
id: s1-01-qa-line-carries-issues
prd: 3001
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

QA's last line says how many bugs it found, but the mission needs to know which bug reports to hand the Engineer. Where should those bug numbers come from?

## The decision, in plain words

QA's last line now lists the bug reports it filed after the count, so the mission reads which bugs to fix from the same line, without opening the comment on GitHub.

## The intro, for fun

Five bugs walk into a log line, and the mission asks for their names.

## The punchline, for fun

Now they sign the guest book on the way in.

## The options, in plain words

A. A. The line lists the bug report numbers right after the count, so one line carries the whole verdict.
B. B. The line stays as the spec quotes it; the mission reads the issues from QA's comment on GitHub.
C. C. The line stays as quoted, and QA prints a second JSON line holding the full verdict.

## What I had to decide

Keep the bug numbers in QA's line, or move them elsewhere before the skill and the mission are built.

## What I did meanwhile

The line reads `omni qa: posted round 1 (bugs, 2: #12 #13) on PR #7: <link>`; a pass reads as the spec wrote it. A bugs line without its numbers, or whose numbers do not match its count, reads as no verdict.

## What it costs to change later

A constant: the line's shape and its parser in one module, before any skill prints it or any mission reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec quotes the line as `(pass|bugs, <k>)` and does not say how the supervisor learns the issues it sends to `/omni:bug-fix` (author).
