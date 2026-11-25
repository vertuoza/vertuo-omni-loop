---
id: s1-01-build-line-proof-file
prd: 3304
slice: s1
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-25
wave: 1
---

## The question, in plain words

The test file that proves how a mission sends a PRD again also checks the line a mission sends to build a PRD of a product. One of its checks said a build with no repository to aim at goes out anyway; this fix turns that check into a refusal. Is that change to the file all right?

## The decision, in plain words

The fix changed that one check: a mission now refuses to send the build of a product PRD whose plan names no repository, and the test file says so. Nothing about when a mission sends a PRD again changed.

## The intro, for fun

A build with nowhere to land used to take off anyway.

## The punchline, for fun

Now it stays on the ground until someone draws the map.

## The options, in plain words

A. Change the check in that file to expect the refusal (built).
B. Keep the file as it was, move the line checks to a file of their own, and delete the old check there instead.

## What I had to decide

BR-PRODUCT-139 names `apps/omni-app/src/missions/supervisor.test.ts` in its `Enforced by:` line. The fix removes one assertion of that file (`lineOf` with an empty base list sent no `--base-of`) and adds a test that the build and the fix are refused then. None of the file's tests of BR-PRODUCT-139 changed.

## What I did meanwhile

The branch holds the changed assertion and the new test in that file, beside the fix.

## What it costs to change later

Moving the product line tests to their own file is one small test-only pull request.

## What I could not know

- Whether the rule's owner wants the product PRD's line tests kept beside its proof or moved out (author).
