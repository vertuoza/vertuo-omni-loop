---
id: s4-02-runners-count-stays-quiet
prd: 2255
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

Should a job waiting for an answer also move the bell, the number in the page title and the dot on the browser tab, or only the number beside Runners?

## The decision, in plain words

Only the number beside Runners shows it. The bell, the number in the page title and the dot on the tab stay as they are, and nobody gets an alert when a job starts waiting.

## The intro, for fun

Some news deserves a doorbell, and some is fine waiting on the shelf with a label.

## The punchline, for fun

This one gets the label, and the doorbell keeps its voice for the rest.

## The options, in plain words

A. The count shows beside Runners only: the bell, the page title and the dot on the tab ignore it, and no alert is raised.
B. The count joins the total the bell, the page title and the dot on the tab show, and a new waiting job alerts like a new question.
C. The count joins the total the bell, the page title and the dot on the tab show, but a new waiting job raises no alert.

## What I had to decide

Pick A to keep the Runners count out of the bell, the page title, the dot on the tab and the alerts, so it shows only beside Runners. Pick B to add it to the total those three show and alert on a new one. Pick C to add it to the total but raise no alert.

## What I did meanwhile

The count shows beside Runners alone. The bell, the number in the page title and the dot on the tab ignore it, and a job that starts waiting raises no alert.

## What it costs to change later

Switching to B or C means adding the count to the total in one place, and for B letting a new one alert like a new question. The number beside Runners stays as it is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The idea asks for a number beside Runners only; it does not say whether the bell, the page title, the dot on the tab or an alert should also react to it.
