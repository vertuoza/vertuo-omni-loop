---
id: s2-02-always-runs-the-recording-policy
prd: 7
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the command only run the recording policy when the file names a risk, or run it every time and let the safe defaults speak for a file that names none?

## The decision, in plain words

It always runs the recording policy, even for a file that names no risk at all, because every one of that policy's own inputs already has a safe default.

## The options, in plain words

A. Run the recording policy on every file, filling in its safe defaults, the option built.
B. Let a file name its own rank directly and skip the recording policy entirely when it does.

## What I had to decide

How a plain decision file, one naming no risk and no rank, still ends up with a rank.

## What I did meanwhile

The recording policy runs on every file, filling in its own safe defaults for whatever the file leaves out, rather than only running when a rank is missing.

## What it costs to change later

One condition to add back, guarding the policy call, if a later reviewer wants a file to be able to name its own rank directly instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the instruction naming this policy said it applies only when the file carries what it needs, and every one of that policy's inputs already defaults safely, so nothing rules out running it on every file
