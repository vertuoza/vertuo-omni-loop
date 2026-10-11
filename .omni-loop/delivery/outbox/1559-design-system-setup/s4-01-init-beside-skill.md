---
id: s4-01-init-beside-skill
prd: 1559
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The plan put the instructions for setting up a design system in the folder of design commands, but a guarded test only allows the existing commands in that folder. Where should they live?

## The decision, in plain words

They sit next to the main design instructions, as the mockup command already does, so the guarded test stays as it is.

## The intro, for fun

A new tenant arrived, but the building only had keys for the old ones.

## The punchline, for fun

So it moved in next door, like its sibling did last spring.

## The options, in plain words

A. A. Keep the setup instructions next to the main design instructions, where the mockup command already lives; the guarded test stays as it is.
B. B. Move them into the folder of design commands, and change the guarded test to allow them there.

## What I had to decide

Keep `init.md` beside `SKILL.md` (A), or move it under `reference/` and amend the proof that lists that folder (B).

## What I did meanwhile

The init command reads from `kit/plugin/skills/pixel-perfect/init.md`; the skill's tables link it there.

## What it costs to change later

Moving it later is a file rename and two link edits in SKILL.md, plus the porting note.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan named `reference/init.md` without noting that `kit/test/plugin.test.ts`, a law's proof, holds the `reference/` folder to its exact list (author).
