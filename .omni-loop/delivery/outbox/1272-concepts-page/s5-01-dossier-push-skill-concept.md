---
id: s5-01-dossier-push-skill-concept
prd: 1272
slice: s5
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

The helper that sends files to the Omni page still describes only plans and fixes. Should its own instructions also explain sending a concept?

## The decision, in plain words

The two concept steps call the helper with the concept kind, and the command already accepts it. The helper's own instructions were left as they are, because changing them was outside this part of the work.

## The intro, for fun

The messenger knows the new address, but its address book still lists only the old ones.

## The punchline, for fun

It delivers fine; it just cannot tell you it does.

## The options, in plain words

A. A. Leave the dossier-push skill's text as it is; the callers name the kind and the command accepts it.
B. B. Add --kind concept to the dossier-push skill's description, input and push section in a follow-up change.
C. C. Have the concept steps run omni dossier push directly instead of following the skill.

## What I had to decide

Whether the dossier-push skill's text should name --kind concept in its description, its input and its push section, in a follow-up change.

## What I did meanwhile

/omni:think-big and /omni:brainstorm --concept follow /omni:dossier-push <n> --kind concept; the skill says to pass the kind as given, and omni dossier push accepts concept, so the push runs. Only the skill's own wording lists visual and bug alone.

## What it costs to change later

One small text change to kit/plugin/skills/dossier-push/SKILL.md, in any later slice or fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an agent reading the dossier-push skill would refuse a kind its text does not list was not tested (author).
