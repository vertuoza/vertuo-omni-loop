---
id: s7-02-section-pointer-prints-whole-page
prd: 45
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

A section of a knowledge page can send the reader to one heading of another page, but the tool that prints the page shows all of that other page, not the heading. Should this repository's pages still send sections to long pages that way?

## The decision, in plain words

Yes, where the plan's page shows it. But the setup page, which every build reads first, sends its section on running things locally to the short front page rather than the long arcade page, to keep what every build reads small.

## The options, in plain words

A. Point anyway, as the plan's page does, but keep the page read before every build pointed at the short front page.
B. Point every section at its exact heading, however long the page that gets printed.
C. Write a short sentence naming the page instead of a pointer, so nothing extra is printed.
D. Change the tool first so that a pointer prints only the heading's section, then point everywhere.

## What I had to decide

The spec's grammar for a section pointer is `See: <path>[#anchor]`, and its resolution table says `omni kb show` prints "the page it names". `resolveSlot` in `kit/lib/playbook/resolve.mjs` reads the whole target and keeps the anchor only in the label, so a pointer to one heading prints every line of the page. `/omni:terraform` step 2 says a page that answers one section is pointed at, never copied, and the before/after page makes `releasing#how` a pointer to `apps/galaxy/README.md#deploy-to-production`, a page of about 250 lines. The spec's Risks name "too much text in a skill's context". Nothing says which wins when a pointer's page is long.

## What I did meanwhile

`releasing#how` is `See: apps/galaxy/README.md#deploy-to-production`, as the page shows, so `omni kb show releasing` (read by `/omni:brainstorm` and `/omni:plan`) prints the whole arcade README. `setup#run`, read by `/omni:do-work` before every slice, is `See: README.md#open-the-galaxy`, the root README of about 100 lines, rather than `apps/galaxy/README.md#run-it-locally`. No kit code changed: `kit/` is outside this slice's territory.

## What it costs to change later

A constant for the forms: each pointer is one line. Printing only the anchored section is a change to the kit's resolver and its tests; every `See:` line then prints less without being rewritten, and `setup#run` can point at the arcade's own section.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec meant a section pointer to print only the section its anchor names; the resolution table says only "the page it names".
- (author) How much text a skill's context can take before a long pointed page costs more than it gives.
