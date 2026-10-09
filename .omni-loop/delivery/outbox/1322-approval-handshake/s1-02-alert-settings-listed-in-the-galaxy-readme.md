---
id: s1-02-alert-settings-listed-in-the-galaxy-readme
prd: 1322
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The four new settings for phone alerts and email must be listed in the page's setup guide, which the plan gives to a later step. Should this step add them to that list now?

## The decision, in plain words

This step adds the four settings to the setup guide's list of settings, two lines and nothing else, so the check that the guide and the code agree stays green.

## The intro, for fun

A new key on the ring, and the label maker is in the next room.

## The punchline, for fun

Two lines of label, borrowed early.

## The options, in plain words

A. A. List the four settings in the README now, the two lines only (built).
B. B. Leave the README to its later step and let the settings check fail until then.

## What I had to decide

Whether the galaxy README's list of settings gains the four alert settings in this step, outside its listed ground, or waits for the step that owns the README.

## What I did meanwhile

The README's marked settings list names VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, RESEND_API_KEY and RESEND_FROM; the later step that describes the handshake in the README keeps those two lines.

## What it costs to change later

Low: two lines in a list; the later step can reword them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s8, which owns apps/galaxy/README.md, wants these lines worded otherwise is not known (author).
