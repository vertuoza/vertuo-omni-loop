---
id: s3-02-no-chart-does-not-open
prd: 149
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When there is no star chart to show, because the knowledge is out of reach or the shared single page carries none, what does choosing it on the menu do?

## The decision, in plain words

It does not open: it buzzes and says why for a moment, and its line on the menu already says so. Only a direct link to the star chart lands on it, and the star chart then says why it is empty.

## The intro, for fun

A telescope with its cap on can still tell you why you see nothing.

## The punchline, for fun

It just says so politely, instead of showing you a very dark sky.

## The options, in plain words

A. Neither case opens: the row and a toast say why, and a direct link shows the reason on the chart, the option built.
B. The artifact's row opens the chart scene, which says NO STAR CHART IN THIS BUILD; only out of reach refuses.
C. Both open the chart scene, which says why it is empty.

## What I had to decide

The spec says that without a graph the item reads OUT OF REACH and the scenes are not reachable, and that the single-file artifact's star chart reads NO STAR CHART IN THIS BUILD. It does not say whether the artifact's item opens a scene to say that, or refuses like the out-of-reach one, nor what the menu line reads in the artifact.

## What I did meanwhile

Without a graph the STAR CHART row reads OUT OF REACH (NOT IN THIS BUILD in the artifact); A buzzes and toasts THE STAR CHART IS OUT OF REACH or NO STAR CHART IN THIS BUILD, and stays on the menu (`doorOf` in scenes/menu.tsx). The `#chart` deep link, which reaches the chart only past the sign-in gate, shows the same reason on the chart scene itself (`ChartOverlay`). A crew member whose galaxy could not be read gets no graph either: the page hands it over only where it hands over the galaxy.

## What it costs to change later

Letting the artifact's row open the chart scene instead is one branch in `doorOf`. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the artifact's star chart reads NO STAR CHART IN THIS BUILD, without saying whether that is its menu line, a scene, or both.
