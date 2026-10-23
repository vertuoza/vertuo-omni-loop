---
id: s7-01-finding-sent-as-a-plain-line
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

When a member approves a finding, the job a runner gets cannot carry the finding in quotes as the spec wrote it, because the runner refuses quotes and long lines. How should the finding travel to the job?

## The decision, in plain words

The job carries the finding as a plain description: the delivery it came from, then what happened (or the fix, for a knowledge finding), with every character a runner refuses dropped and the line cut at a word to fit.

## The intro, for fun

The runner only reads plain letters, and the finding arrived wearing quotes and dashes.

## The punchline, for fun

So it travels light: no quotes, no frills, just the story in one line.

## The options, in plain words

A. Send the finding as a plain description, cut to fit the runner's line (built).
B. Send a link to the finding, and teach the job to read it in full.
C. Let the runner's line take one quoted argument, as the spec wrote it.

## What I had to decide

Pick A to keep the plain description, B to send a link to the finding that the job reads in full, or C to let the runner take one quoted argument.

## What I did meanwhile

Approve on a repository finding queues /omni:bug-fix rewind of PRD <n>: <what happened>, and on another knowledge finding /omni:knowledge-add rewind of PRD <n>: <its fix>, each at most 200 characters, every character other than letters, digits, spaces and ._/:#- dropped, and a run of dashes made one, so the text never reads as a flag. The runner's own line check accepts every line built this way (rewind.approval.test.ts).

## What it costs to change later

B needs the job to read the finding back from the page (a read the runner's sign-in does not make today) and a change to the two skills' inputs; C changes the runner's line check in the kit and the app, which every runner then has to update to.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A finding longer than the line loses its tail: bug-fix opens its issue from the cut description, so its first words carry the whole bug.
- (author) Whether the job should also carry the finding's fix, and not only what happened, was not asked; the line has no room for both.
