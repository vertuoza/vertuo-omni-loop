---
id: s6-01-dashboard-screenshots-themes-and-width
prd: 328
slice: s6
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The plan asks for pictures of the dashboard at three screen sizes. Should they also show each of the three colour themes, and should the picture run stop when the page is too wide for a phone?

## The decision, in plain words

The run takes the dashboard in all three themes at every size, nine pictures in all. It stops with an error when the page is wider than the screen, naming what sticks out, and still saves the picture.

## The intro, for fun

Three sizes asked for, three themes on the switch, and nine pictures is a nicer number anyway.

## The punchline, for fun

And a page that sticks out past a phone's edge now gets caught before a person has to scroll for it.

## The options, in plain words

A. All three themes at every size, and a page wider than its window fails the run, the option built.
B. All three themes, and a page wider than its window only reported, like the small-text list.
C. Only the default theme at each size, as the plan words it, with no width check in the script.

## What I had to decide

What the /app screenshots in pnpm galaxy:shots cover beyond the plan's three sizes: whether they cover each theme, and whether a page wider than its window fails the run or is only reported.

## What I did meanwhile

scripts/shots.mjs opens /app in the demo at each size, picks Omni, Light and Dark on the app bar's switch (tap on the touch sizes, click on the computer), and saves the whole page each time as 34-app-omni, 35-app-light and 36-app-dark. When document.scrollingElement is wider than the window, the run exits 1 and names the innermost elements past the right edge; the screenshot is saved all the same. The text-size report now measures /app too. The README says all of it.

## What it costs to change later

A few lines of one script: the theme list is one constant, and turning the width failure into a report is one line. Nothing is stored, and pnpm test never runs the script.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan and the spec ask for the three sizes and a manual check of the three themes; they do not say whether the screenshots should cover the themes, nor whether the width check belongs in the script
- (author) Whether a sideways scroll at 852 or 1440 px, which the spec does not name, should fail the run as it does at 393 px was not asked
