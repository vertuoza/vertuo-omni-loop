---
id: s1-03-jev-page-in-settings-trail
prd: 812
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Should the new Jev page also appear in the top bar's trail, like the other settings pages?

## The decision, in plain words

Yes: the Jev page is listed as a page of Settings, so the top bar reads Settings, then Jev. That meant updating one test outside this slice's area, the one that checks every settings page exists.

## The intro, for fun

A new room in the house deserves a sign on the door.

## The punchline, for fun

Even if it meant touching a test next door, politely.

## The options, in plain words

A. List the Jev page under Settings, and add its line to the page-exists test.
B. Show Jev only as a tab, so the top bar reads Settings alone on it and no test outside the slice changes.

## What I had to decide

Whether the Jev page is added to the Settings entry's pages (the trail and the page-exists test) or only to the Settings tabs.

## What I did meanwhile

It is added to both, and the list of expected pages in the page-exists test outside the slice's territory gained one line for the Jev page.

## What it costs to change later

One line in one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person wants Jev shown in the top bar trail was not asked (author)
