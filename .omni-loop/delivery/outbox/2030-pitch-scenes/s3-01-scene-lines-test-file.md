---
id: s3-01-scene-lines-test-file
prd: 2030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The plan gave this piece no place for a test of how the scenes draw their new lines. Should that test live in a new file beside the scenes it checks?

## The decision, in plain words

We added one new test file beside the scenes, which draws each scene alone and checks that its small top line and its sentence show, in order and on time.

## The intro, for fun

The plan left the scenes a seat at the table, but forgot the chair for their test.

## The punchline, for fun

So we brought a folding chair and put it right beside them.

## The options, in plain words

A. Keep the new test file beside the scenes, outside the planned ground of this piece.
B. Drop it, and pin the new lines with reference pictures in the browser render tests instead.
C. Keep it, and give the later pieces that change the scenes the same file to extend.

## What I had to decide

Keep the new test file beside the scenes, or move its checks into the browser render tests of a later piece.

## What I did meanwhile

The new test file runs with the rest of the suite and no other piece of the plan touches it.

## What it costs to change later

Moving or deleting one test file; no product behaviour depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The browser render tests that compare frames with reference images could not run on this machine (its browser is not installed); the fixture holds no new field, so those frames should not move (author).
