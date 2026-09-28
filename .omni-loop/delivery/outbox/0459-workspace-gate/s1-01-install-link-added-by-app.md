---
id: s1-01-install-link-added-by-app
prd: 459
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When nobody's workspace owns a repository yet, who writes the link to install the Omni App: the database or the web app?

## The decision, in plain words

The database says no workspace owns the repository yet and to install the Omni App; the web app adds the install link it already knows, so the link follows whichever App a deployment uses.

## The intro, for fun

Every refusal deserves a door, and every door deserves a doorknob.

## The punchline, for fun

The database names the door; the web app hands over the knob.

## The options, in plain words

A. The database ends with the hint and the web app adds its own install link, so preview and production each link their own App.
B. The database writes the whole sentence with the link fixed in the migration, so nothing is added after it.
C. Leave the link out everywhere and let the guide tell people where to install the App.

## What I had to decide

Whether the install link belongs in the database's message or is added by the web app from its own App setting.

## What I did meanwhile

Refusals for an unowned repository end with the install link wherever the web app knows the App's name, and with the hint alone where it does not.

## What it costs to change later

A constant: moving the link into the database is one follow-up migration and deleting a small helper.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The web app recognises the database's hint by its closing words, so rewording that sentence in the database means changing the helper's constant too (author).
