---
id: s2-01-front-door-page-filled-from-settings
prd: 45
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The page at the entrance of the knowledge folder must say where each kind of knowledge lives, even when some of it is kept elsewhere. Should the kit ship one such page, or one for each case?

## The decision, in plain words

One page, whose three locations are filled in from the repository's own settings when the page is written, so it names the right folders in every case.

## The options, in plain words

A. One plain page, whose locations are filled in from the repository's settings when it is written.
B. Two pages, one for knowledge kept in this folder and one pointing elsewhere; the install picks one.
C. The entrance page is a form like the others, with sections a repository can override, read the same way.

## What I had to decide

The spec says `omni kb init` writes the front door's `README.md` when it is missing, "pointing at `paths.knowledge` when the registers live elsewhere", and the plan gives s2 "the front door README template" under `kit/templates/`. Neither says whether that template is a form (front matter and slots, resolved per section) or a plain page, where it sits under `kit/templates/`, or how one text points elsewhere.

## What I did meanwhile

`kit/templates/README.md` is plain Markdown: a provenance line, a title, an opener, and no front matter or slots. It names the three places as `{config:paths.knowledge}`, `{config:paths.adr}` and `{config:paths.playbook}`, each a single string in every config, so the same text is right whether the registers live in the front door or elsewhere. Its path mirrors the front door: `kit/templates/` is the front door, `kit/templates/playbook/` the playbook. `frontDoorTemplate()` in `kit/lib/playbook/templates.mjs` returns it unfilled; s3's writer is expected to fill it with `fillConfig` (from `kit/lib/playbook/resolve.mjs`) when it writes the file. Test: "the front door’s README names the playbook, the knowledge registers and the decision records by config" in `kit/lib/playbook/templates.test.mjs`.

## What it costs to change later

A constant before s3 writes the file: the template's text, its path in `templates.mjs` and one test. After s3 merges, a repository that already holds its front door page keeps it, since `omni kb init` never changes an existing file; only new installs see a change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page should read differently when the registers live outside the front door, beyond naming that folder: the spec gives no wording for that case.
