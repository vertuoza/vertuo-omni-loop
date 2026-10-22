---
id: s7-01-cancel-twice-keeps-the-first-key
prd: 2425
slice: s7
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

When a key cancels a job that is still running and was already asked to stop, should the second cancel change anything: refuse it, record the second key, or leave the first one?

## The decision, in plain words

A second cancel of a job already asked to stop answers as a success and changes nothing: the job keeps the key that asked first, and nobody is told the job has ended when it has not.

## The intro, for fun

Two programs press the same stop button, a second apart.

## The punchline, for fun

The first press gets the credit; the second gets a calm yes.

## The options, in plain words

A. A second cancel of a running job already asked to stop answers as a success and changes nothing: the first key stays on the job.
B. A second cancel answers as a conflict, as a second answer does, and the job keeps the first key.
C. A second cancel replaces the key on the job: the last key to ask to stop is the one shown.

## What I had to decide

The spec says a running job is asked to stop and that only an ended job answers 409. A job asked to stop is still running, so cancelByKey reads it back as it stands, with cancelled_by unchanged, and answers 200; the page's own Cancel (the shared stop rule) is untouched. ADR-0029 treats a repeated close as success in the ask API, which guided this, while a second answer of a question is a conflict (BR-PRODUCT-12): the two read differently on purpose, since an answer closes a round once and a stop request can be repeated until the runner stops the job.

## What I did meanwhile

Built cancelByKey so a running job already asked to stop answers as it stands, the first key and whom it acted for kept, and held it with a test that cancels twice from two keys.

## What it costs to change later

Changing it later means changing one condition in the runners' service and the tests that hold it; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a repeated cancel should read as a conflict, like a second answer does: the spec names only the ended job as a conflict.
