---
id: s4-01-teammates-named-by-email
prd: 144
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

To share a question, the owner picks a teammate from a list; should that list, and the note saying who answered first, show each teammate's email address to everyone in the workspace?

## The decision, in plain words

Yes: every member of a workspace sees the others by their arcade name when they picked one, and otherwise by their email address. Nobody outside the workspace sees the list.

## The intro, for fun

Picking a teammate from a list works best when the list has names on it.

## The punchline, for fun

Some people only ever gave us their email, so that is the name they get.

## The options, in plain words

A. Arcade name when there is one, otherwise the email address, shown to members of the same workspace only
B. Arcade name only, and members without one are not offered for sharing
C. Email address always, for everyone the same way

## What I had to decide

Whether members of a workspace may see each other's email addresses when sharing a question and reading who answered it, or only a name.

## What I did meanwhile

The share list and the already-answered note name each member by their arcade name, or by their email address when they have none; the list is given only to members of the same workspace.

## What it costs to change later

Showing only arcade names is a change to one database function and one line of the page; a member with no arcade name would then need another label.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says to pick a workspace member but not how a member is named, and many members have never picked an arcade name (author)
- The access rules so far let a person read only their own membership, so no page showed another member's email before this (author)
