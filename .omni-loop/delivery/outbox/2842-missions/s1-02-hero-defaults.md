---
id: s1-02-hero-defaults
prd: 2842
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

What does each new hero start with: which preferred model, which limits, and which one line says whether it works alone?

## The decision, in plain words

Every hero prefers Claude, Sonnet for the Engineer and the QA and Opus for the others, and never merges or answers for a person, plus one limit of its own role. The drawer says what the Engineer and the QA do alone, and that a person does the others' work today.

## The intro, for fun

Five heroes signed up, and someone had to write their job descriptions.

## The punchline, for fun

Nobody asked for a raise: the agent and model are only written down.

## The options, in plain words

A. A. Claude for all; Sonnet for the Engineer and the QA, Opus for the others; the shared and per-role limits as built.
B. B. Other models or limits per role, named by a person.
C. C. No model recorded until routing by model exists.

## What I had to decide

Keep these defaults (A), or name other models and limits per role (B).

## What I did meanwhile

The defaults are recorded on each hero and change nothing yet: the runner's accounts still decide the model, as the spec says.

## What it costs to change later

A constant: two lists kept equal by a test, kit/lib/virtual-fleet/roles.ts and virtual_hero_roles() in the migration; heroes already made keep what they were given.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names each role's skills but no model, no limit sentence and no wording for the drawer's lines; the mockup's Reviewer line `A person, until its skill` was replaced by `A person does this today`, as the spec words it. (author)
- The why line for a role that does not work alone (s6's Heroes tab) is written too: `Its review skill is not built yet.`, `Its brainstorm and roadmap need a person.`, `Its plan needs a person.` (author)
