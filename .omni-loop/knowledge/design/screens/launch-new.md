---
screen: launch-new
status: draft
kind: page
mock: launch-new.html
implements: []
reads: []
routes: []
supersedes: null
---

## Purpose

New video: a launch built from scratch for a feature with nothing filmed (mobile, behind sign-in, no
UI) or with no PRD at all. Screenshots and/or a prompt go into the same storyboard, check, render
and post as a PRD's launch. The words come only from what was given plus the linked spec and
release note.

## Regions

- **The head:** the breadcrumb (`Products › <product> › Launches › New video` in the vision tour),
  the title `New video`, and `Render in CI` as the one primary.
- **Inputs:** Screenshots (a drop zone with each file's still and name, `+ Drop or add`); Prompt (a
  text field); the linked PRD, when there is one (`Linked: PRD #<n>`), and the format with its
  length; the rule `Words from your inputs only.`
- **Storyboard:** the generated stills in a fixed format, each with its number, its name, `(screenshot)`
  when it is one, and the line saying where it came from (`from your prompt`, `list.png · zoom on
  Source`, `spec §4`, `Pitch settings`).

## States

- **Generating:** the storyboard says `Generating…` while Omni builds it.
- **Generated:** the stills, each sourced; `Render in CI` enabled.
- **Rendering:** `Rendering…`, then `Rendered · v1` and `Ready on Launches`.
- **Render failed:** nothing posts, as on the Launch tab (see `launch`).

## Words

New video · Render in CI · Screenshots · + Drop or add · Prompt · Linked: PRD #<n> ·
Words from your inputs only. · Storyboard · Generated · Generating… · Rendering… · Rendered · v1 ·
Ready on Launches.

## Refusals

- No word that is not in the screenshots, the prompt, or the linked spec and release note; the check
  refuses an unsourced claim.
- A fixed format only, in the product's Pitch look; no editor.
- No video, no post.

## Open questions

- Its route. The vision tour reaches it at `Products › <product> › Launches › New video`; the Craft
  area map puts it at `Products › <product> › New video`. No `Launches` page is drawn or named
  elsewhere in the concept.
- Whether it is also the PRD Launch tab's "Start from" (filmed walk, screenshots or a prompt), or only
  a page for launches without a PRD.
- How the check judges a claim when only a prompt backs it.
- Where a launch without a PRD is approved and posted, since the Launch tab belongs to a PRD.

## Source

/omni:think-big, concept #2024, crowned L on 2026-10-15: .omni-loop/delivery/inbox/concepts/2024-launch/vision.html
