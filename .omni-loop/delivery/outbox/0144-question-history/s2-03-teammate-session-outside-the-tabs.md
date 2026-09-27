---
id: s2-03-teammate-session-outside-the-tabs
prd: 144
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

Now that the ask page shows one tab per terminal, where should a teammate's session open when someone follows its link?

## The decision, in plain words

A teammate's session opens on its own, read-only, without the tab list. The tab list only ever shows the terminals the signed-in person opened, even though the whole workspace can now read every session.

## The intro, for fun

Two features met in a merge and both wanted the same page.

## The punchline, for fun

Your tabs stay yours; a teammate's session is a guest, not a roommate.

## The options, in plain words

A. Open a teammate's session alone, read-only, outside the tabs, the option built.
B. Show it as an extra read-only tab after the person's own terminals.
C. Show every workspace session as a tab, marked by owner.

## What I had to decide

PRD 142 turned the session page into one page with a tab per terminal, built on the idea that only the owner could read a session. PRD 144 lets every workspace member read every session, read-only for non-owners. Merging the two needed a choice about how a teammate's session sits next to the person's own tabs.

## What I did meanwhile

The tab list reads only sessions the person owns. A link to a teammate's session renders that session alone, read-only, with the context line and category chip, no answer form, no Share, no delete. The person's own tabs keep the answer form, Share on the open round, and delete.

## What it costs to change later

Small: showing a teammate's session as an extra tab later is a change to the route and the tab list only; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether people would rather see a teammate's session as a visiting tab beside their own terminals
- whether the history page planned in PRD 144 will become the usual way into a teammate's session, which would make this choice moot
