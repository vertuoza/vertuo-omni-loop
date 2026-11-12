---
id: s3-01-edge-function-test-and-entry
prd: 2728
slice: s3
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

The new embed function's tests and its starting file sit in a folder the test runner and the unused-code audit did not know about. Should those two tools be told about that folder, though the plan did not list their settings for this slice?

## The decision, in plain words

Yes: one line tells the test runner to run the function's tests, and one line tells the unused-code audit that the function's starting file is started by Supabase, not imported by other code.

## The intro, for fun

A brand new folder showed up, and two tools had never heard of it.

## The punchline, for fun

Two short introductions later, everyone is on speaking terms.

## The options, in plain words

A. A. Tell the test runner and the unused-code audit about the new function's folder, two lines in all (built).
B. B. Leave both settings alone, so the function's tests never run and the audit calls its starting file unused.
C. C. Move the function's logic and tests into the kit's folder, leaving only its starting file with Supabase.

## What I had to decide

Keep the two lines (A), or move the function's tests elsewhere and leave the settings as they were (B).

## What I did meanwhile

The function's tests run in the preflight, and the audit counts its starting file as used.

## What it costs to change later

Undoing it is deleting two lines in two settings files; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gave this slice the function's folder, the database settings and the database workflow, not the test runner's or the audit's settings (author).
