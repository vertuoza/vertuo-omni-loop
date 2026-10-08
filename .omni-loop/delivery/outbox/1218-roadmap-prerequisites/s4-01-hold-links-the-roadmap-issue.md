---
id: s4-01-hold-links-the-roadmap-issue
prd: 1218
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When the loop pauses a piece of work because a setup step is missing, where should the link next to that pause take you?

## The decision, in plain words

It takes you to the roadmap's discussion on GitHub for now, because the loop cannot know the web address of the roadmap's page without asking the app on every round.

## The intro, for fun

Every pause deserves a signpost, even if it points down the old road.

## The punchline, for fun

The shiny new tab will have to wait until its address is known.

## The options, in plain words

A. A. Link the roadmap issue until the page's address is known here (built).
B. B. Have the roadmap push keep the page's address locally, and link its Prerequisites tab.
C. C. Let the app open a roadmap page by repository and roadmap number, and link that with the tab.

## What I had to decide

The spec asks the hold line to carry the Prerequisites tab's link. The roadmap page is addressed by the app's own id, which `omni next` never sees (only `omni roadmap push` gets it back). The gate takes a `prerequisitesLink` and falls back to the roadmap issue's link; the command passes null today.

## What I did meanwhile

Each prerequisite hold links the roadmap issue on GitHub, where `omni roadmap tick` posts and the answers live. The gate already accepts the tab's link, so filling it is one line in the command.

## What it costs to change later

A constant: once the page link is known locally (kept by `omni roadmap push` beside the last result, or the page addressed by repository and roadmap number), the command passes `<page>?tab=prerequisites` instead of null.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3's push keeps the page's id anywhere this machine can read (author)
- Whether the app will open a roadmap page by repository and number (author)
