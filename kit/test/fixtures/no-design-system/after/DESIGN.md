---
version: alpha
name: Berthline
description: >-
  Starter A, Chart room, picked on 2026-10-11 from three starter directions drawn by
  /omni:pixel-perfect init (PRD 1559 dogfood: picked by the agent, no person was asked).
colors:
  # Primitives: a screen never names one.
  paper-50: "#faf8f2"
  paper-100: "#f2eee2"
  paper-200: "#e4dcc8"
  white: "#ffffff"
  navy-950: "#0b1424"
  navy-900: "#13213b"
  navy-800: "#1c3159"
  navy-700: "#253f78"
  navy-600: "#30529b"
  navy-300: "#9db4e6"
  navy-200: "#c9d6f1"
  navy-100: "#e4eaf8"
  slate-700: "#4a5263"
  slate-500: "#737b8c"
  magenta-700: "#9b1b5a"
  magenta-300: "#f08cbf"
  green-700: "#1d6a39"
  green-300: "#86d6a0"
  green-100: "#e2f2e6"
  amber-700: "#8a5700"
  amber-300: "#f2c46b"
  amber-100: "#fbefd2"
  red-700: "#b0241b"
  red-300: "#ff9d92"
  red-100: "#fbe2de"
  night-950: "#060a12"
  night-900: "#0a0f1a"
  night-800: "#121a2a"
  night-700: "#1c2639"
  night-500: "#5c6882"
  night-300: "#9ba5b9"
  night-100: "#e3e8f2"
  night-navy: "#1e2c49"
  night-green: "#10301b"
  night-amber: "#33270a"
  night-red: "#3a1714"
  # Semantic tokens, light (the default: both scenes are in daylight).
  ground: "{colors.paper-50}"
  surface: "{colors.white}"
  sunk: "{colors.paper-100}"
  line: "{colors.paper-200}"
  line-strong: "{colors.slate-500}"
  ink: "{colors.navy-900}"
  muted: "{colors.slate-700}"
  primary: "{colors.navy-700}"
  primary-hover: "{colors.navy-800}"
  primary-active: "{colors.navy-900}"
  on-primary: "{colors.white}"
  primary-soft: "{colors.navy-100}"
  focus: "{colors.magenta-700}"
  link: "{colors.navy-600}"
  success: "{colors.green-700}"
  on-success: "{colors.white}"
  success-soft: "{colors.green-100}"
  warning: "{colors.amber-700}"
  on-warning: "{colors.white}"
  warning-soft: "{colors.amber-100}"
  error: "{colors.red-700}"
  on-error: "{colors.white}"
  error-soft: "{colors.red-100}"
  info: "{colors.navy-600}"
  on-info: "{colors.white}"
  info-soft: "{colors.navy-100}"
  disabled: "{colors.paper-200}"
  on-disabled: "{colors.slate-700}"
  selection: "{colors.navy-200}"
  scrim: "{colors.navy-950}"
  # Semantic tokens, dark (at dusk).
  dark-ground: "{colors.night-900}"
  dark-surface: "{colors.night-800}"
  dark-sunk: "{colors.night-950}"
  dark-line: "{colors.night-700}"
  dark-line-strong: "{colors.night-500}"
  dark-ink: "{colors.night-100}"
  dark-muted: "{colors.night-300}"
  dark-primary: "{colors.navy-300}"
  dark-primary-hover: "{colors.navy-200}"
  dark-primary-active: "{colors.navy-100}"
  dark-on-primary: "{colors.navy-950}"
  dark-primary-soft: "{colors.night-navy}"
  dark-focus: "{colors.magenta-300}"
  dark-link: "{colors.navy-300}"
  dark-success: "{colors.green-300}"
  dark-on-success: "{colors.night-950}"
  dark-success-soft: "{colors.night-green}"
  dark-warning: "{colors.amber-300}"
  dark-on-warning: "{colors.night-950}"
  dark-warning-soft: "{colors.night-amber}"
  dark-error: "{colors.red-300}"
  dark-on-error: "{colors.night-950}"
  dark-error-soft: "{colors.night-red}"
  dark-info: "{colors.navy-300}"
  dark-on-info: "{colors.night-950}"
  dark-info-soft: "{colors.night-navy}"
  dark-disabled: "{colors.night-700}"
  dark-on-disabled: "{colors.night-300}"
  dark-selection: "{colors.night-navy}"
  dark-scrim: "{colors.night-950}"
typography:
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.15
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.2
  headline-sm:
    fontFamily: Source Serif 4
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.2
  data-md:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
rounded:
  none: 0px
  sm: 2px
  md: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  control: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  button-quiet:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.link}"
  button-disabled:
    backgroundColor: "{colors.disabled}"
    textColor: "{colors.on-disabled}"
  text-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 40px
  text-field-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
  status-free:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label-sm}"
  status-booked:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
  status-held:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
  status-out:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.muted}"
  notice-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    rounded: "{rounded.md}"
  table-row-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
---

# Berthline

Written by `/omni:pixel-perfect init` on a repository with no design system: starter **A, Chart
room**, picked from three rendered directions (Chart room, Pontoon, Harbour office). Nothing is built
from it yet, so no part names a `Code` path: turning these tokens into CSS is the first ordinary slice after it
(`npx @google/design.md export --format css-vars DESIGN.md` writes the file).

## Overview

An Admiralty chart on the desk. Berthline is read by the harbourmaster at a desk by the window and
by skippers on a phone on the pontoon, in full sun or at dusk (`README.md`). It speaks like the
shipping forecast it admires: plain, dense, exact. So the screens are chart paper and navy ink,
dense enough to hold a whole pontoon at once, with berth codes, lengths and times set like a tide
table. Light is the default, since both scenes are in daylight; dark is for dusk.

## Colors

- **Ground (chart paper, `paper-50`) and Surface (white):** the page, and the table and fields on it.
- **Ink (navy, `navy-900`) and Muted (`slate-700`):** text, and labels and hints.
- **Primary (navy, `navy-700`):** the one action of a screen. Text on it is `on-primary`.
- **Focus (chart magenta, `magenta-700`):** the focus ring only, as a chart draws its lights.
- **Success, Info, Warning, Error:** a berth free, booked, held; an error. Each has a soft ground
  for its badge or notice.

Every text pair passes 4.5:1 and every edge 3:1, in light and in dark.

## Typography

- **Headlines:** Source Serif 4, semibold, like a chart's title block.
- **Body and labels:** IBM Plex Sans, 15 px on 1.5.
- **Data:** IBM Plex Mono with tabular figures, for berth codes, lengths and times only: data, never
  costume.

## Layout

Dense: 40 px controls, 8 and 12 px steps inside a group, 16 and 24 px between groups. A table holds
the whole pontoon; a form keeps a 560 px column.

## Elevation & Depth

Flat, like paper. Depth is tonal: ground, surface and sunk, edged by `line` and `line-strong`. No
shadow.

## Shapes

Near-square: 2 px on controls and badges, 4 px on a notice. Nothing is a pill.

## Components

### Button

- **Summary:** the action a screen asks for.
- **Variants:** primary, secondary, quiet
- **States:** default, hover, focus-visible, active, disabled, loading
- **Tokens:** {colors.primary}, {colors.primary-hover}, {colors.primary-active}, {colors.on-primary}, {colors.surface}, {colors.line-strong}, {colors.link}, {colors.disabled}, {colors.on-disabled}, {colors.focus}, {rounded.sm}, {typography.label-md}
- **Accessibility:** the label names the action; loading keeps the label and sets `aria-busy`.
- **Do:** one primary per screen.
- **Don't:** a button that only goes to another page: that is a link.
- **Code:** none

### Text field

- **Summary:** one value typed in, with its label above.
- **Variants:** text, number, date and time, phone
- **States:** default, focus-visible, filled, error, disabled
- **Tokens:** {colors.surface}, {colors.ink}, {colors.line-strong}, {colors.error}, {colors.error-soft}, {colors.focus}, {rounded.sm}, {typography.body-md}
- **Accessibility:** a visible label; the error is tied with `aria-describedby` and says the fix.
- **Do:** say the limit in the error ("B12 takes up to 12 m.").
- **Don't:** a placeholder standing in for a label.
- **Code:** none

### Select

- **Summary:** one value picked from a short list.
- **Variants:** none
- **States:** default, focus-visible, disabled
- **Tokens:** {colors.surface}, {colors.ink}, {colors.line-strong}, {colors.focus}, {rounded.sm}
- **Accessibility:** the native select, labelled.
- **Do:** keep the list short (the four pontoons).
- **Don't:** a select for two values: use a checkbox.
- **Code:** none

### Checkbox

- **Summary:** one yes or no.
- **Variants:** none
- **States:** default, checked, focus-visible, disabled
- **Tokens:** {colors.primary}, {colors.ink}, {colors.focus}, {colors.on-disabled}
- **Accessibility:** the native checkbox, its label clickable.
- **Do:** word it as the yes ("Free only", "Shore power").
- **Don't:** a negative label.
- **Code:** none

### Status badge

- **Summary:** a berth's status today.
- **Variants:** free, booked, held, out of service
- **States:** default
- **Tokens:** {colors.success}, {colors.success-soft}, {colors.info}, {colors.info-soft}, {colors.warning}, {colors.warning-soft}, {colors.muted}, {colors.sunk}, {rounded.sm}, {typography.label-sm}
- **Accessibility:** the word carries the status; the colour only repeats it.
- **Do:** one of the four words, always.
- **Don't:** a dot with no word.
- **Code:** none

### Tabs

- **Summary:** the app's sections, Berths, Arrivals and Bookings.
- **Variants:** none
- **States:** default, hover, current, focus-visible
- **Tokens:** {colors.ink}, {colors.muted}, {colors.primary}, {colors.line}, {colors.sunk}
- **Accessibility:** links in a named nav; the current one has `aria-current="page"`.
- **Do:** three or four sections.
- **Don't:** tabs that hide a form's fields.
- **Code:** none

### Notice

- **Summary:** one line the screen must say: a hold, a booking made, a warning, an error.
- **Variants:** info, success, warning, error
- **States:** default
- **Tokens:** {colors.info}, {colors.info-soft}, {colors.success}, {colors.success-soft}, {colors.warning}, {colors.warning-soft}, {colors.error}, {colors.error-soft}, {rounded.md}
- **Accessibility:** an error notice is an alert; its action is a real button.
- **Do:** say what happened and the next step.
- **Don't:** a notice for what the screen already shows.
- **Code:** none

### Berth table

- **Summary:** berths in rows: code, length, status, boat, until.
- **Variants:** none
- **States:** default, selected row, loading, empty, error
- **Tokens:** {colors.surface}, {colors.line}, {colors.line-strong}, {colors.muted}, {colors.primary-soft}, {typography.data-md}
- **Accessibility:** a real table with header cells; loading sets `aria-busy`.
- **Do:** right-align lengths; set codes and times in the data face.
- **Don't:** cards in place of rows.
- **Code:** none

## Do's and Don'ts

- Do name a semantic token on a screen (`colors.primary`), never a primitive or a hex value.
- Do write times on the 24-hour clock and lengths in metres.
- Do keep one primary action per screen.
- Don't use the data face for prose.
- Don't add a shadow, a gradient or a pill: the chart is flat and square.

## Reference screens

- `berths` — a list: every berth with its status, and its loading, empty and error states.
- `booking-form` — a form: a skipper books a berth, one field in error.
