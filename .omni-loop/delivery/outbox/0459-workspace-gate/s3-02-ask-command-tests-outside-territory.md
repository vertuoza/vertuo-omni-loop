---
id: s3-02-ask-command-tests-outside-territory
prd: 459
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The tests for switching ask mode on, and the pretend page they talk to, sit in two files the plan did not list for this piece of work. May this piece change them?

## The decision, in plain words

Yes: both were changed, only to teach the pretend page the new question and to check the new lines; nothing else in them moved.

## The intro, for fun

The plan drew the fence one step short of the vegetable patch.

## The punchline, for fun

We watered the tomatoes anyway and left the gate as we found it.

## The options, in plain words

A. Change the two test files, as done.
B. Move the new checks into a new test file inside the listed ground, with a stubbed page there.
C. Widen the plan's ground to name both files, then keep the change.

## What I had to decide

Whether changing the ask command's tests and the pretend page, outside the listed ground, is fine.

## What I did meanwhile

Both files carry the new checks; the other tests using the pretend page are untouched and pass.

## What it costs to change later

Nothing to undo: moving the checks elsewhere is a copy of a few tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names the ask command's folder, but its tests live one level up, beside the other command tests (author).
