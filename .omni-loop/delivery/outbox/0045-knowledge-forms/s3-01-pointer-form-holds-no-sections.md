---
id: s3-01-pointer-form-holds-no-sections
prd: 45
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When the setup writes a knowledge page that only points to a page kept elsewhere, should it still carry the empty sections of a full page?

## The decision, in plain words

No. A page that points elsewhere carries only its title and its opening line, and the check asks it for no section, because the page it points to answers the whole question.

## The options, in plain words

A. A pointing page carries its title and opening line only, and the check asks it for no section.
B. A pointing page carries every section heading, empty, like a blank page, and the check still asks for every required one.
C. A pointing page carries every section heading, empty, and the check asks for none of them.

## What I had to decide

The spec says `omni kb init` writes every missing form with "the front matter with `state: blank`, the title, the opener, every slot heading and marker, empty bodies", and writes the decisions form "as a pointer" when `paths.adr` is outside the front door's `adr/` (the glossary form when `paths.glossary` is set). It does not say whether a pointer form keeps the slot headings. `omni check kb` fails on "a required slot whose marker is missing" without saying whether that holds for a pointer form, whose target resolves the whole form (s1's `resolveForm` ignores its slots). The before/after page's one pointer example, the decisions form in the vertuo-ai-domain column, has no slot.

## What I did meanwhile

`blankForm` in `kit/lib/playbook/write-forms.mjs` writes a pointer form as its front matter (`state: pointer`, `points-to: <path>`), its title and its opener, with no slot. `gradeForm` in `kit/lib/playbook/check-playbook.mjs` asks a pointer form for no required slot and warns on no blank one, but still fails on an unknown slot id or a dead `See:` line, and still lists its `TODO(human)` lines. Tests: "writes decisions as a pointer when paths.adr is outside the front door’s adr/, and glossary when paths.glossary is set" and "asks no section of a pointer form, and lets a folder pointer without an index through" in `kit/bin/kb.test.mjs`; "lists the questions of a pointer form, and asks it for no section" in `kit/lib/playbook/check-playbook.test.mjs`.

## What it costs to change later

A constant before s5 and s7 write pointer forms: one branch in `blankForm` and one condition in `gradeForm`, with their tests. After s7 merges, a pointer form this repository already holds keeps its shape, since `omni kb init` never changes a file that exists; choosing B then turns such a form red until its headings are added by hand.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether /omni:terraform (s5) will ever turn a pointer form back into a filled one in place: if it does, it writes the section headings itself.
- (author) Whether a person reading a pointer form on GitHub needs a line of prose naming the target, beyond the front matter GitHub already shows.
