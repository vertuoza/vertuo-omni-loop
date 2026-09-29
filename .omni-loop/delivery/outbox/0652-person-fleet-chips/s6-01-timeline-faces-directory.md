---
id: s6-01-timeline-faces-directory
prd: 652
slice: s6
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

On a fix's page, the Timeline now shows a face beside each person, but that page belongs to the dossier screens. Should the Timeline show members' arcade heroes, or is their GitHub photo enough there for now?

## The decision, in plain words

The Timeline shows each person's GitHub photo for now. It is ready to show heroes as soon as the fix page hands it the workspace's list of people, a one-line change on the dossier side.

## The intro, for fun

Every face on the fix timeline showed up, but some forgot their costumes at home.

## The punchline, for fun

GitHub photos for now; the capes arrive once the page passes the guest list.

## The options, in plain words

A. Timeline takes an optional list of people and falls back to GitHub photos; the dossier page passes it in a follow-up.
B. Widen this slice into the dossier page to load the list of people and pass it now.
C. Keep GitHub photos on the Timeline for good; heroes only on the fix lists.

## What I had to decide

Whether the fix page should pass the workspace's people to its Timeline, so members appear as their heroes there too.

## What I did meanwhile

Every Timeline line shows the person's public GitHub photo beside the same words; nothing else changes.

## What it costs to change later

One line in the dossier page that draws the Timeline, plus one test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s5 (dossier screens, same wave) already loads the people directory on the fix page was not visible from this slice (author).
