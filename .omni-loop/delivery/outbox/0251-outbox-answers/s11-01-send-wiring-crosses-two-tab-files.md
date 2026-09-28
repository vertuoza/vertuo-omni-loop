---
id: s11-01-send-wiring-crosses-two-tab-files
prd: 251
slice: s11
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

To make Send work, this slice had to touch two small pieces owned by the slice that built the Outbox tab. Is that acceptable?

## The decision, in plain words

Yes. The page's reader gained a way to forget what it remembers about one PRD, so a sent answer shows at once, and the tab's disabled Send button was swapped for the working one, with nothing else changed.

## The intro, for fun

The Send button lived in a room this slice had no key to.

## The punchline, for fun

It knocked, stepped in, swapped one button, and left the furniture where it was.

## The options, in plain words

A. A. Keep the two small changes outside the territory, as built.
B. B. Move the Send slot into the pane: the answers component takes a render prop, and the pane supplies the Send component.
C. C. Leave the cache alone and let a sent answer show within the minute the cache already allows.

## What I had to decide

The plan gives this slice the new Send component and the tab's pane, but the Send button sits in the answers component (s9's `outbox-answers.tsx`), and clearing the dossier's cached summary needs the reader (`apps/galaxy/src/dossier/github/reader.ts`), neither in the territory. Without them Send cannot be wired and the answer cannot show as pending at once.

## What I did meanwhile

Added `forget(dossierId)` to the reader (three lines, with a test in `reader.test.ts`) and replaced the disabled button in `outbox-answers.tsx` with `<OutboxSend>`, plus a `drop` helper that removes picks the send answered. The fresh read for a send is `forget` then `summary` on the server's one reader, so the reader's cache and token are reused.

## What it costs to change later

A constant: reverting is deleting `forget` and putting the disabled button back. No stored shape or contract changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan may have meant `OutboxPane` to pass a Send slot into the answers component; that would still have needed a change to the answers component's props.
