---
screen: select
status: draft
kind: shared
mock: select.html
implements: [packages/ui/src/Select.tsx, packages/ui/src/Select.css, packages/ui/src/Select.meta.ts]
reads: [packages/ui/src/Menu.css, packages/ui/src/Input.css, packages/ui/src/Field.tsx, packages/design/tokens.css, packages/design/src/icons/icons.ts]
routes: [/ask, /prd/<id>, /app/runners, /app/fleet, /knowledge, /app/settings/business, /app/products/<id>/knowledge/personas]
supersedes: null
---

## Purpose

The one dropdown of the app pages: one choice out of a short list, in the product's own list rather
than the browser's picker. Every page that asks for one choice out of a list draws it; none draws a
raw `<select>`.

## Regions

- **Trigger:** the picked option's label (or the placeholder) and a chevron. `md` wears the Input's
  look, for forms; `sm` is compact, in `--type-2`, for a chip, a toolbar or an inline sort.
- **List:** the Menu's panel (`--color-raised`, `--color-border-subtle`, `--radius-2`,
  `--elevation-overlay`), at least the trigger's width, at most `min(320px, 100vw − 2 × --space-4)`
  wide and 320 px tall, with its own scroll.
- **Option:** its label, at least 44 px tall; the picked one bold with a `check` glyph before it, the
  highlighted one on `--color-accent-soft`.
- **Field wiring:** inside a Field, the Field's label, hint and error.

## States

- **1.A · Open, in a form:** the list under the trigger, the picked option checked, the next one
  highlighted.
- **1.B · Closed, in a form.**
- **1.C · Small, inline:** Ask's category chip, open, beside "sorted by the model".
- **1.D · Phone, dark theme:** the dossier's version picker, open, inside a 390 px screen.
- **1.E · Disabled and invalid:** disabled at half opacity; invalid with a 2 px danger border and
  the Field's error under it.

## Words

The options' own labels, and the Field's label, hint and error. The Select adds no words of its own
beyond an optional placeholder.

## Refusals

- Never the browser's native picker on the app pages: a raw `<select>` is a `raw-select` breach of
  the design ratchet.
- Never a search box inside the list: that is the Combobox.
- Never an option shorter than 44 px, at either size.
- Never a colour outside the tokens.

## Open questions

- Should the list open over the trigger with the picked option aligned on it (the macOS way), or
  always below it, as drawn?
- Does the `sm` trigger keep the uppercase look of Ask's category chip, or take the sentence case
  drawn here?

## Source

/omni:brainstorm, PRD 3129: .omni-loop/delivery/inbox/3129-designed-select/before-after.html
