---
id: s3-01-notice-in-the-plugin
prd: 1369
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The credit and the full licence text for the imported design craft sit in the kit's notice file, but repositories install only the plugin folder, which carries a credit line in every imported file and none of the licence text. Should the plugin carry its own copy of the notice too?

## The decision, in plain words

The full notice and licence text stay in the kit's notice file, as the spec asked, and each imported file opens with a line saying where it came from, under which licence, and that it was changed.

## The intro, for fun

The credits roll in the cinema, but the DVD box only says based on a true story.

## The punchline, for fun

One more file in the box would settle it.

## The options, in plain words

A. Keep the notice in the kit only, with a credit line in every imported file (built).
B. Also copy the notice and licence text into the skill folder, so it travels with the plugin.
C. Move the notice into the plugin folder, and leave the kit pointing at it.

## What I had to decide

Whether the skill folder gets its own copy of the notice and licence text.

## What I did meanwhile

Each imported file names its source, its licence and that it was modified; the skill's opening paragraph credits impeccable and Anthropic's frontend-design skill; the full text is in kit/NOTICE.md.

## What it costs to change later

Adding the copy later is one file in the skill folder and one test line; nothing else moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Apache-2.0 duty to hand recipients a copy of the licence is met by the plugin as installed was not checked with anyone who owns licensing (author).
