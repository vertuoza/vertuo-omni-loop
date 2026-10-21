---
id: s7-01-pitch-skill-test-outside-territory
prd: 2030
slice: s7
rank: medium
bears-on: none
raised: 2026-10-21
wave: 5
---

## The question, in plain words

The plan let this slice change only the video skill's own instructions, yet proving its example video plan passes the checker needs a test that lives elsewhere. Should that test stay?

## The decision, in plain words

A new test file was added next to the other skill tests. It reads the video skill, checks each new writing rule is there, and runs the checker on the example it shows.

## The intro, for fun

The plan drew a fence around one folder, and the proof lived just over it.

## The punchline, for fun

So the proof got a small house of its own next door.

## The options, in plain words

A. A. Keep the new test file beside the other skill tests (built).
B. B. Move its cases into the large plugin test that already reads the video skill.
C. C. Drop the test and rely on the skill text being read by a person.

## What I had to decide

Whether the skill's new rules and its example are pinned by a separate test file beside the other skill tests, or by no test at all.

## What I did meanwhile

The new test runs in the full suite; the skill's folder holds only its instructions, as before.

## What it costs to change later

Removing the test is deleting one file; keeping it costs a few milliseconds per run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's test seams name no test for the skill; whether the planner meant the skill to go untested, or forgot its test's path, is unknown (author).
