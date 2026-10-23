---
id: s7-03-edit-whole-page-text
prd: 2417
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 4
---

## The question, in plain words

When an owner edits a playbook page on the Omni page, do they edit the whole file, its header lines included, or only the words below the header?

## The decision, in plain words

The owner edits the whole file, header included, and a text that the next sync would not read as a page is refused with the reason, so no pull request is opened for a page every repository would then skip.

## The intro, for fun

The page has a small label stuck on top, and someone has to decide who may peel it.

## The punchline, for fun

We handed over the whole page, label and all, and a checker who says when the label fell off.

## The options, in plain words

A. The whole file is edited, header included, and a text the sync would skip is refused (built).
B. Only the body is edited; the server keeps the header the settings repository holds, or the kit's for a new page.

## What I had to decide

Whether the edit field holds the page's whole text (built) or only its body, with the header kept on the server.

## What I did meanwhile

PlaybookEditor.tsx fills the field with the page's whole text; omni-settings.service.ts runs the kit's own page reader (readSettingsPage) on the text before anything is written, and the route answers 422 with its reason; the page's read-only view still hides the header, as s6 drew it.

## What it costs to change later

Editing the body only later means the service re-attaches the page's current header before writing; the route's body shape stays the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a page's header (its owner line among it) is the owner's to edit on the Omni page.
