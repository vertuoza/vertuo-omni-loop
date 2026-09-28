---
id: s1-02-fleet-refusal-shape
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

How does the fleet page learn which field a refusal is about?

## The decision, in plain words

Every refusal starts with the field's name, for example Label: 1 to 12 characters, and also carries the field on its own as a hint the page can read. A colour typed in capitals is accepted and stored in lowercase, and spaces around a label or motto are trimmed.

## The intro, for fun

The database says no, and politely points at the box you got wrong.

## The punchline, for fun

Label, colour, motto or mascot: it always names the culprit.

## The options, in plain words

A. A hint naming the field plus a message that starts with it, as built.
B. A separate error code per field, and no hint.
C. The functions answer a list of every problem at once instead of stopping at the first.

## What I had to decide

The shape of the fleet functions' answers and refusals, which the fleet page reads to show each refusal next to its field.

## What I did meanwhile

Each function answers the fleet as saved; a refusal carries the field as its hint and names it first in its message; the page maps the hint to the field.

## What it costs to change later

The wording and hints of four refusals, and the page's mapping.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the refusal messages should be written for people to read as they are, or be translated by the page (author)
