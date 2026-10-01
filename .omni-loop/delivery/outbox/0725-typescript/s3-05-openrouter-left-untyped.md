---
id: s3-05-openrouter-left-untyped
prd: 725
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

A few files this slice touched belong to no later step of the plan, so nobody would ever finish converting them. Who should?

## The decision, in plain words

This slice converted the two small ones fully. The one that talks to the language model, and the settings' own tests, stay unconverted and are flagged for the final step.

## The intro, for fun

Three files raised their hands when the plan called out who owns them, and only this slice did.

## The punchline, for fun

It adopted the two quiet ones and left a note on the loud one's door.

## The options, in plain words

A. Leave the three files for the final step's review to assign
B. Give them to the step that converts the tool's other language-model callers
C. Convert them in this slice before it merges

## What I had to decide

kit/lib/config, kit/lib/front-matter and kit/lib/openrouter are in s3's territory and in no later slice's, so the ratchet (s29) would find their @ts-nocheck still there. s3's own done-when asks for schemas, not for its files to be typed.

## What I did meanwhile

Typed kit/lib/config.ts and kit/lib/front-matter.ts (no @ts-nocheck). Left kit/lib/openrouter.ts (45 errors, and its network replies still to be parsed through a schema) and the tests kit/lib/config.test.ts and kit/lib/openrouter.test.ts (they drive kit/bin, typed by s17) with @ts-nocheck.

## What it costs to change later

Cheap: a follow-up slice, or s29's review, types the three files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which slice the plan meant to type kit/lib/openrouter (author)
