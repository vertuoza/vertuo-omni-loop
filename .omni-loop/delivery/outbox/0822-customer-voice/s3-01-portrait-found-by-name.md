---
id: s3-01-portrait-found-by-name
prd: 822
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

The voice record names each persona but does not point at the persona saved on the Business page. How should the User voice tab find the right portrait for each persona?

## The decision, in plain words

The tab looks up the workspace's persona with the same name and draws its portrait. When none has that name, or the personas cannot be read, it shows the first letter of the name instead.

## The intro, for fun

The voice record knows everyone's name but never took their photo.

## The punchline, for fun

So the tab asks the Business page who answers to Marc.

## The options, in plain words

A. A. Match by name in the workspace's personas, the initial when none matches (built).
B. B. Add the persona's id to each persona in the voice record and look the portrait up by id.
C. C. Draw no portraits on the tab, only names and stance chips.

## What I had to decide

Whether a portrait on the User voice tab is found by the persona's name, or the voice record must carry a link to the saved persona.

## What I did meanwhile

Portraits are matched by name across the workspace's personas, first match in the workspace's order; an unknown name, a renamed persona or an unreadable list draws the name's initial.

## What it costs to change later

A constant: adding a persona id to the voice record later only changes the lookup in one function; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for PRD 799's portrait but the voice record's shape, set by the step before, holds only the name and the stance.
- (author) Two personas with the same name on two products would show the first one's portrait.
