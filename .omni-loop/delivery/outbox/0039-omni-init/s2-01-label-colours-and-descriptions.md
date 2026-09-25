---
id: s2-01-label-colours-and-descriptions
prd: 39
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When the installer creates the tags the loop puts on its requests and plans, which colour and which short description should each tag get?

## The decision, in plain words

Each tag gets one fixed colour and a one-line description starting with the loop's name, so a person browsing a repository's tags can tell the loop's tags apart. Tags a repository already has are never changed.

## The options, in plain words

A. One fixed colour per label, grouped by role, and a description starting with the loop's name (built).
B. One single colour for every loop label, so they read as one family.
C. No colour or description passed, leaving GitHub's random colour and an empty description.

## What I had to decide

The colour and the description `omni init` gives each loop label it creates (the spec only asks for a fixed colour and a description), and that a label which cannot be created is left for a person rather than retried.

## What I did meanwhile

kit/lib/init/labels.mjs holds one LABEL_STYLES entry per labels.* key: prd purple 5319e7, pr:phase-0 light blue c5def5, pr:feature green 0e8a16, pr:sub pale teal bfdadc, pr:in-progress yellow fbca04, pr:needs-fix orange d93f0b, outbox:go blue 1d76db, each with a description beginning `Omni Loop:` (prd: `A PRD the Omni Loop builds`). A test keeps LABEL_STYLES in step with the schema's labels keys.

## What it costs to change later

Editing one table in one file. Labels already created on a repository keep their first colour, since init never recolours; changing them there is a manual step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Neither the spec nor the plan names the colours or the description wording; no existing Vertuoza label palette was found to follow.
