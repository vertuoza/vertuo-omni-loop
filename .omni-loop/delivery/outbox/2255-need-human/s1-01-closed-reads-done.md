---
id: s1-01-closed-reads-done
prd: 2255
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When someone answers or dismisses the questions of a stopped job, should its row on the Runners page read Done, or keep reading Need human?

## The decision, in plain words

The row reads Done as soon as its questions are closed. The record of the stopped job still says it needed a human, so nothing is lost.

## The intro, for fun

A job that asked for help gets its answer, and then it should stop looking worried.

## The punchline, for fun

Once the question is closed, the badge retires too.

## The options, in plain words

A. A. The board reads a job with closed questions as Done, and its stored outcome stays as it ended.
B. B. The database functions clear the stored outcome when the questions close.

## What I had to decide

Pick A to keep reading a closed job as Done from whether its questions are still open, with nothing stored changing when someone answers. Pick B to clear the stored outcome when the questions close, which moves the clearing into the database functions.

## What I did meanwhile

The Runners board reads a job whose questions are closed as Done. It works that out from whether the questions are still open, and the stored outcome stays as the job ended.

## What it costs to change later

Switching to B is one change in the answer and dismiss database functions plus a small migration; the page and its words stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the badge leaves once the questions are closed, but not whether the stored outcome is cleared (author).
