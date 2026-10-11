---
id: s8-02-shell-icon-button-and-toggle
prd: 1559
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

The app's top bar draws four small square buttons alike, and the bell's panel draws two on and off switches, but no shared piece of code holds either. Should each become a listed part of our design system?

## The decision, in plain words

I tagged them in the mockups as icon button and toggle, left them off the list, and named them under each mockup as proposed parts.

## The intro, for fun

Four square buttons walk into a top bar, all dressed the same, none of them family.

## The punchline, for fun

The list only takes parts with a home in the code.

## The options, in plain words

A. A. Leave both off the list for now; the mockups name them as proposed.
B. B. Add the square button and the switch to the list now, naming the stylesheets that draw them.
C. C. Add them to the list and plan a slice that makes each one shared component first.

## What I had to decide

The fold, menu, bell and avatar buttons are 36 px squares, a 6 px corner, edged line-strong, written separately in sidebar.css, app-bar.css, bell.css and user-menu.css. Desktop alerts and Chime are checkboxes drawn as switches inside Bell.tsx. init.md: a component that exists only on a screen is an open question, never a part made up to fill the list. So they stay off-list, `data-part="icon-button"` and `data-part="toggle"`, and `omni design parts --check` prints them as `off-list:` on app-shell.html and notifications.html. DESIGN.md asks it as a TODO(human).

## What I did meanwhile

The mockups carry the two off-list tags and a note under the marked screen; DESIGN.md lists 13 parts without them.

## What it costs to change later

A constant: one entry in DESIGN.md each, and later a slice that turns each into one component.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the four square buttons are meant to be one thing, or only look alike by accident (author).
