---
id: s4-01-ask-members-carry-faces
prd: 652
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Where should the ask screens get each person's picture from: from the member list they already read, or from a separate read on each screen?

## The decision, in plain words

The member list the ask screens already read now also brings each person's picture, so every screen that reads it (ask, dossier, the waiting list) gets the pictures without asking twice.

## The intro, for fun

Everyone on the ask screens now shows a face, but someone had to fetch the photos.

## The punchline, for fun

The member list went shopping once and came back with pictures for everybody.

## The options, in plain words

A. The shared member list brings the pictures for every screen that reads it (built).
B. Only the ask pages fetch the pictures, with a reader of their own.

## What I had to decide

Whether the shared member read should also read the people directory for every screen that uses it.

## What I did meanwhile

readMembers reads ask_members and the people directory in parallel and adds a face to each member; the dossier and waiting callers get the extra field and one extra roster and fleets read per workspace.

## What it costs to change later

Undoing it is moving the directory read into the ask entry points; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The question page's route under app/ is outside this slice's territory, so the face had to ride on readMembers, which that route already calls (author).
