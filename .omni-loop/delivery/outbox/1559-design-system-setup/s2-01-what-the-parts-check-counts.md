---
id: s2-01-what-the-parts-check-counts
prd: 1559
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The spec says the parts check flags controls with no part name and new component files no part covers, but not exactly which things count. Is the line drawn in the right place?

## The decision, in plain words

A control is a button, a text field, a dropdown, a text area, a link drawn as a button or the screen's main action, and a component is a new screen file in the usual front-end formats. Part names match whatever their capitals, spaces or dashes.

## The intro, for fun

Every button wants a name tag, but not every link is a button.

## The punchline, for fun

We drew the line; you get to move it.

## The options, in plain words

A. Keep the line as built: the controls, extensions and name matching above.
B. Count every link as a control too, so menus and inline links must carry a part tag.
C. Count any new source file under the screen folders as a component, plain TypeScript and JavaScript files included.

## What I had to decide

Which elements of a mockup count as controls that must carry a part tag, which added files count as new components, how a tag is matched to a listed part, and how the command tells a page from a git ref.

## What I did meanwhile

Controls: button, input (but a hidden one), select, textarea, a control role, a link classed btn or button, anything design.words.primary marks; a tag on an element around a control covers it. Component files: .tsx, .jsx, .vue, .svelte, .astro added under design.paths, design.ignore dropped. Names match with case, spaces, dashes and underscores ignored. An operand ending in .html or .htm is a page, anything else a ref.

## What it costs to change later

A constant each: the control tags and roles, the extension list and the name key live in kit/lib/design/parts/. Nothing is stored and nothing blocks, so a different line changes only what the check prints.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a plain navigation link should count as a part: left out, since a menu would flood the check (author)
- Whether a .ts or .js file under design.paths can be a component: left out, since it would name every helper (author)
