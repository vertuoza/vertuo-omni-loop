---
id: s9-01-ready-panel-route-wiring
prd: 2898
slice: s9
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

The Ready panel is built and drawn by the PRD page, but nothing yet reads the saved verdict and hands it to the page, so no panel shows. Should a later change connect it?

## The decision, in plain words

I built the panel, its words and its read of the saved verdict, and gave the page a place for it. I did not connect the page's loader, because that file is outside this slice's area.

## The intro, for fun

A lamp is installed and the bulb is in the box.

## The punchline, for fun

Someone has to screw it in.

## The options, in plain words

A. A. Leave the route as it is; connect it in a follow-up slice or PR (what was built).
B. B. Widen this slice's area to the route file and connect it now.

## What I had to decide

Connect the page's route to the verdict read in a follow-up slice: call readLatestVerdict with the PRD's repository and number, pass readyView(row) as the ready prop of DossierPage.

## What I did meanwhile

The panel never shows: with no verdict handed to it, it draws nothing, as the spec says.

## What it costs to change later

One small edit in the page's route file and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which repository of a PRD with several repositories holds the feature PR (author)
