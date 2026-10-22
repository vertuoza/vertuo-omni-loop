---
id: s7-03-relaunch-refusals-in-the-runners-words
prd: 2425
slice: s7
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

When a key relaunches a job whose runner is gone, or whose line the runners no longer take, which refusal does it get, and in whose words?

## The decision, in plain words

A job whose runner is gone answers as a conflict and one whose line the runners no longer take answers as an invalid request, each in the runners' own words, the same words the page shows for them.

## The intro, for fun

A key presses Send again on a job whose runner has left.

## The punchline, for fun

The job is still there, so the answer says conflict, not missing.

## The options, in plain words

A. A gone runner answers as a conflict and a refused line as an invalid request, both in the runners' words.
B. A gone runner answers as not found and a refused line as a conflict, both in the runners' words.

## What I had to decide

The spec names 409 for a job the page offers neither Send again nor Resume for and for a job already carried on; it names no answer for a runner that is gone or a line the runners no longer take. Once the job is read, a missing runner is no 'no such job', so the runners' missing answer becomes 409 for a relaunch (404 stays for jobs a key may not see), and their malformed answer becomes 422 in their words with no field named, since a relaunch sends none (an answer's malformed message names answers). The 409 words are the page's own: This job has ended, and the runners' neither Send again nor Resume sentence.

## What I did meanwhile

Mapped the runners' refusals for a relaunch in one small function beside the close refusals, and held each with a service test and a route test.

## What it costs to change later

Changing it later means changing one mapping function and the tests that name the codes; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a gone runner should read as not found instead, as a key reading the job would not then learn that the job's runner left.
