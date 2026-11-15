---
id: s2-01-now-json-status-test
prd: 2906
slice: s2
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Adding the status to the session answer made one older test, in a file this step does not own, fail. May this step loosen that one test so it ignores the new part?

## The decision, in plain words

The test now checks the parts it always checked and no longer insists the answer has nothing else. Nothing about what the status line shows changed.

## The intro, for fun

A new guest arrived at a table set for exactly four.

## The punchline, for fun

We added a chair instead of sending the guest home.

## The options, in plain words

A. A. Loosen that one assertion to ignore the new status key (built).
B. B. Keep the strict assertion and add the full status to its expected answer, which ties that test to every word of the status.

## What I had to decide

Changed one assertion of kit/bin/statusline.test.ts from toEqual to toMatchObject, since omni now --json carries the new status key as the spec asks. Taken alone as the most reversible: restoring toEqual later means listing the status in that test.

## What I did meanwhile

The test keeps proving the work, its stage, its links and what it is doing.

## What it costs to change later

One line in a test outside this step's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No written rule says whether a step may touch a test outside its territory when its change breaks it (author).
