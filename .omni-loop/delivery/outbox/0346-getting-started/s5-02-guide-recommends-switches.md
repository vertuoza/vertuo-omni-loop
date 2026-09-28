---
id: s5-02-guide-recommends-switches
prd: 346
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

A fresh install leaves dossiers and release notes switched off, so a first run shows no follow-along link and writes no release note. Should the guide tell people how to switch them on?

## The decision, in plain words

The first-feature page ends with a short section giving the few settings that switch both on, and the troubleshooting page adds a handful of other errors a first run meets beyond the four the design named.

## The intro, for fun

Two good features were hiding behind switches nobody told the newcomer about.

## The punchline, for fun

We put up a small sign pointing at the switches, and left them for the newcomer to flip.

## The options, in plain words

A. Document the switches and the extra errors: What was built: a short section for the switches, and a few more errors on the troubleshooting page.
B. Only the four errors, no switches: Keep both pages to what the spec names, and leave the settings to the kit's own readme.
C. Move the switches to the Install page: Name them once where the kit is installed, and link to them from the first-feature page.

## What I had to decide

Whether the guide documents the config lines that turn dossiers and release notes on (ask.url, dossier.enabled, releaseNotes.enabled), which the spec does not mention, and whether When something goes wrong lists more than the four errors the spec names.

## What I did meanwhile

Your first PRD has a Two switches worth turning on section with the YAML; When something goes wrong has the four named errors, the ask.url and off lines beside the sign-in one, and an Other lines section (uncommitted changes, plugin missing, gh not signed in, needs-fix label).

## What it costs to change later

Cheap to change: one section in each of two pages of the guide.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Install page, written by another slice at the same time, also covers the switches was not known when this was written (author)
