---
id: s5-01-no-notifications-reads-blocked
prd: 499
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When a browser cannot show desktop alerts at all, what should the Desktop alerts switch say?

## The decision, in plain words

It says Blocked by the browser and cannot be turned on, the same as when the person refused the browser's permission.

## The intro, for fun

Some browsers simply have no idea what a desktop alert is.

## The punchline, for fun

So the switch tells the truth and stays off.

## The options, in plain words

A. Show the switch as Blocked by the browser, unusable (built).
B. Hide the Desktop alerts switch, leaving only Chime.
C. Show the switch, and say the browser does not support desktop alerts.

## What I had to decide

Whether a browser without desktop alerts shows the switch as blocked, or hides the switch altogether.

## What I did meanwhile

The switch shows Blocked by the browser and cannot be switched on; the Chime switch still works.

## What it costs to change later

One line in the switch's starting state and one in the panel's foot to hide it instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the blocked state only for a denied permission; it says nothing of a browser that has no desktop alerts.
