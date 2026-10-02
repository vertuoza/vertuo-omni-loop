---
id: s17-01-sidebar-name
prd: 976
slice: s17
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

When a page of the guide is named by something other than plain text, should its link in the guide's side menu keep showing the odd placeholder it showed before, or show no name?

## The decision, in plain words

Such a name now shows as empty, the way the tool already reads any value that is not text. Every page of the guide today is named by plain text, so nothing a reader sees changes.

## The intro, for fun

A page of the guide could, in theory, be named by a picture instead of a word.

## The punchline, for fun

The side menu now leaves that link blank rather than printing the picture's packaging.

## The options, in plain words

A. Show a page name that is not text as empty, as the tool reads any value that is not text.
B. Keep writing such a name out as before, through a helper that stringifies whatever it is given.
C. Render such a name as the React node it is, so the side menu could show a styled name.

## What I had to decide

How `sidebarItems` in apps/galaxy/src/docs/tree.ts writes a page's name, where `String(node.name)` would write a page tree name that is not text (fumadocs types it as any React node) out as `[object Object]`, and the linter refuses that stringification.

## What I did meanwhile

`sidebarItems` reads the name through `plainText` (kit/lib/outbox/plain-text.ts, the helper item s4-01-outside-text settled on): text as it is, a number written out, anything else as ''. The guide's names all come from its pages' titles, which are text, so every link reads exactly as before.

## What it costs to change later

One line in apps/galaxy/src/docs/tree.ts: writing a non-text name out again, or rendering it as a React node, is a change to that line alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a fix changes no output; it does not say what a page name that is not text should show as, the one case where the output moves, and no page of the guide has such a name today.
