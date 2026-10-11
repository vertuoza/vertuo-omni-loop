---
version: alpha
name: Omni Loop
description: >-
  Read from @omni/design (packages/design/) and the app pages' stylesheets by /omni:pixel-perfect
  init on 2026-10-11. Colours from packages/design/src/palette.ts and src/tokens.ts (ASK), type from
  packages/design/src/fonts.ts (TYPE_SCALE), shapes and spacing from apps/galaxy/src/ask/ask.css.
colors:
  # Primitives, read from INK and ARCADE (packages/design/src/palette.ts, src/tokens.ts). A screen
  # never names one: it names a semantic token below.
  void: "#07061c"
  deep: "#0e0d33"
  cab: "#120f3a"
  navy: "#2f3fc4"
  navy-dark: "#1a2170"
  white: "#f2f4ff"
  dim: "#8a90d6"
  plasma: "#a45cff"
  plasma-dark: "#6a2fd0"
  yellow: "#ffd84a"
  gold: "#d99a14"
  red: "#ff3b5c"
  cyan: "#6ff0ff"
  green: "#4ee08a"
  magenta: "#ff3ea5"
  ad-purple: "#5b1a86"
  starfield: "#05040f"
  # Semantic tokens, theme Omni, the app pages' default (ASK.omni in packages/design/src/tokens.ts,
  # the CSS custom properties --ask-<name> of apps/galaxy/src/ask/theme-tokens.ts).
  primary: "{colors.yellow}"
  on-primary: "{colors.void}"
  primary-soft: "#2a2350"
  accent: "{colors.magenta}"
  on-accent: "{colors.void}"
  neutral: "{colors.void}"
  surface: "{colors.cab}"
  sunk: "{colors.deep}"
  line: "{colors.navy-dark}"
  line-strong: "#5a60c4"
  on-surface: "{colors.white}"
  muted: "{colors.dim}"
  link: "{colors.cyan}"
  success: "{colors.green}"
  error: "#ff6b86"
  # Theme Light (ASK.light).
  light-primary: "{colors.plasma-dark}"
  light-on-primary: "#ffffff"
  light-primary-soft: "#efe7ff"
  light-accent: "{colors.yellow}"
  light-on-accent: "#3a2c00"
  light-neutral: "#f5f4fc"
  light-surface: "#ffffff"
  light-sunk: "#eceaf8"
  light-line: "#d9d6ee"
  light-line-strong: "#85819f"
  light-on-surface: "#17153d"
  light-muted: "#4f5486"
  light-link: "#0b6f86"
  light-success: "#15703f"
  light-error: "#b3122f"
  # Theme Dark (ASK.dark).
  dark-primary: "#b37cff"
  dark-on-primary: "{colors.deep}"
  dark-primary-soft: "#2a1d66"
  dark-accent: "{colors.yellow}"
  dark-on-accent: "#3a2c00"
  dark-neutral: "{colors.deep}"
  dark-surface: "#16144a"
  dark-sunk: "#1d1a58"
  dark-line: "#2f2c78"
  dark-line-strong: "#6d6acc"
  dark-on-surface: "{colors.white}"
  dark-muted: "#a9aee6"
  dark-link: "{colors.cyan}"
  dark-success: "{colors.green}"
  dark-error: "#ff6b86"
typography:
  # TYPE_SCALE in packages/design/src/fonts.ts, written to packages/design/fonts.css as
  # --type-<name>-*. The display steps lean 12° (skewX), which the format cannot say: see Typography.
  display-xl:
    fontFamily: Anton
    fontSize: 96px
    fontWeight: 400
    lineHeight: 0.9
  display-l:
    fontFamily: Anton
    fontSize: 72px
    fontWeight: 400
    lineHeight: 0.9
  display-m:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: 400
    lineHeight: 0.95
  display-s:
    fontFamily: Anton
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1
  pixel-l:
    fontFamily: Press Start 2P
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.25
  pixel-m:
    fontFamily: Press Start 2P
    fontSize: 8px
    fontWeight: 400
    lineHeight: 1.5
  pixel-s:
    fontFamily: Jersey 10
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.05
  body-l:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  # Read from apps/galaxy/src/ask/ask.css: the button's label and the chip's capitals.
  label-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1
  label-caps:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.08em
rounded:
  # apps/galaxy/src/ask/ask.css (chip 4, button 8, card 12, switch 999) and nav/app-bar.css (6).
  sm: 4px
  control: 6px
  md: 8px
  lg: 12px
  full: 999px
spacing:
  # The steps apps/galaxy/src/ask/ask.css uses most; the prose column and the breakpoint are held by
  # apps/galaxy/src/page-width.test.ts and ask.css.
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  column: 900px
  breakpoint: 900px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 13px
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 13px
  button-disabled:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.muted}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  chip:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.muted}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  theme-switch-pressed:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  recommended-badge:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
---

# Omni Loop

Read from the design system the repository has, `@omni/design` (`packages/design/`, its README), and
from the app pages' stylesheets that draw with it. Each section names the file it was read from. What
the files do not say is a `TODO(human)` question, written where the answer goes.

## Overview

Omni Loop turns product plans into delivered software, and a game sits on top of it: each PRD is a
planet the fleets terraform together (`README.md`, `apps/galaxy/README.md`). One package,
`@omni/design`, holds the whole look: the colour tokens, the four font roles, the 16-bit crest, the
brand and the pixel sprites (`packages/design/README.md`). `/design` renders all of it
(`apps/galaxy/app/design/page.tsx`).

It is worn on three surfaces, and this file's closed list of parts is the **app pages'**, the reading
surface under `/app`, `/prd`, `/ask`, `/docs` and `/knowledge`:

- **The app pages** are a reading surface for the people who run the loop: a face drawn for legibility
  at 17 px on 1.6, the galaxy's colours used only as signals (`apps/galaxy/src/ask/ask.css`).
- **HOME** at `/` is a retro print ad, a text column in the ad's purple beside a starfield
  (`apps/galaxy/src/home/poster/Poster.tsx`, `apps/galaxy/src/home/home.css`).
- **The arcade** at `/play` is the game, drawn on a 640×360 or a 320×288 grid, a Game Boy on a phone
  (`apps/galaxy/README.md`, `apps/galaxy/src/arcade/arcade.css`).

TODO(human): HOME and the arcade use the named primitives as they are, not these semantic tokens, and
draw controls of their own (the SIGN UP WITH GITHUB button, the game room's cabinets) that no
component holds. Are they areas with a system of their own, or should their parts join this list?

## Colors

Read from `packages/design/src/palette.ts` (`INK`) and `packages/design/src/tokens.ts` (`ARCADE`,
`ASK`); `packages/design/tokens.css` is generated from them (`pnpm --filter @omni/design tokens`). The
app pages name these tokens through `apps/galaxy/src/ask/theme-tokens.ts`, as the custom properties
`--ask-<name>`, and `apps/galaxy/src/ask/ask.css` names no colour of its own.

The app pages have three themes, picked by the person (`apps/galaxy/src/ask/theme.ts`): **Omni**, the
default and HOME's palette on the reading surface, then **Light** and **Dark**. The unprefixed
semantic tokens are Omni's; `light-` and `dark-` name the same role in the other two. Each role, and
its `ASK` name:

- **Primary (comic yellow in Omni, `plasma`):** the signal — the selected option, the pressed theme,
  Send, the wordmark. Text on it is `on-primary`.
- **Primary soft (`plasmaSoft`):** the selected option's ground.
- **Accent (magenta in Omni, `yellow`):** the Recommended badge only. In Omni it holds magenta so it
  never reads as the yellow signal (`tokens.ts`).
- **Neutral (`ground`), Surface (`surface`), Sunk (`sunk`):** the page, a card or an option, the
  preview panel and the key caps.
- **Line (`line`) and Line strong (`lineStrong`):** the quiet divider, and the edge of a chip, a card
  or a control (3:1, PRD 476).
- **On surface (`ink`) and Muted (`muted`):** text, and hints and descriptions.
- **Link (`cyan`):** links and the focus ring. **Success (`green`):** what is answered. **Error
  (`red`):** errors only.

Every text pair (`ASK_TEXT_PAIRS`) reaches 4.5:1 and every edge pair (`ASK_UI_PAIRS`) 3:1, in each
theme: `packages/design/src/tokens.test.ts` fails otherwise.

## Typography

Read from `packages/design/src/fonts.ts` (`FACES`, `TYPE_SCALE`), written to
`packages/design/fonts.css`. Four roles, every face under the SIL Open Font License and served from
the app's own origin, never from Google Fonts (`apps/galaxy/src/design-system.test.ts`):

- **Display:** Anton, slanted 12° by the type scale (`--type-display-*-slant`), for ad headlines and
  taglines beside the logo.
- **Pixel:** Press Start 2P for labels and the HUD, Jersey 10 for longer game text. On the app pages
  it appears in the header wordmark only (`apps/galaxy/src/ask/ask.css`).
- **Body:** Atkinson Hyperlegible Next (400, 700, 400 italic), the reading copy at 17 px on 1.6.
- **Mono:** JetBrains Mono (400, 600), for code and commands.

`label-md` and `label-caps` are read from `ask.css` (the button's label, the chip's capitals). The
scale's `body-m` and `body-s` are `body-md` and `body-sm` here.

## Layout

Read from `apps/galaxy/src/ask/ask.css` and `apps/galaxy/src/page-width.test.ts`. Every app page but
the PRD page uses the full width; prose keeps a 900 px column, and a form field is never wider than
900 px. The pages change at 900 px: the sidebar becomes a drawer, and from 900 × 700 the PRD page's
header pins (`apps/galaxy/src/nav/sidebar.css`, `ask.css`).

TODO(human): `ask.css` spaces in 4, 8, 10, 12, 14, 16, 20, 24, 28 and 32 px. Is there a scale meant
here, or should the odd steps go?

## Elevation & Depth

Flat. Depth on the app pages is tonal: the page on `neutral`, cards and options on `surface`, panels
and key caps on `sunk`, each edged by `line-strong` (`ask.css`). No shadow is written for a card.

## Shapes

Read from `apps/galaxy/src/ask/ask.css` and `apps/galaxy/src/nav/app-bar.css`: a chip's corner is
4 px, the shell's square buttons 6 px, a button 8 px, a card 12 px, and the theme switch and every
count badge are pills. Pixel art — the crest and every sprite — is drawn at whole-number scales only,
never smoothed, rendered `pixelated` (`packages/design/README.md` › Brand rules).

## Components

The closed list of the app pages' parts. Each is a component or a shared class in the code, and names
it under `Code`. A part not on the list is proposed by an outbox item, never invented.

### Button

- **Summary:** the action on a card or a page; a link that acts as one wears the same class.
- **Variants:** primary, quiet
- **States:** default, focus-visible, disabled
- **Tokens:** {colors.primary}, {colors.on-primary}, {colors.surface}, {colors.line-strong}, {colors.sunk}, {colors.muted}, {rounded.md}, {typography.label-md}
- **Accessibility:** focus shows the cyan ring of `.ask :focus-visible`; a link drawn as a button keeps the on-primary text, never the link's cyan (PRD 476).
- **Do:** one primary per screen, marked `data-primary` in a mockup.
- **Don't:** paint a link as a button with the link's colours.
- **Code:** `apps/galaxy/src/ask/ask.css`

TODO(human): `ask.css` writes no hover, active or loading state for `.ask-button`. Which does it have?

### Card

- **Summary:** one block of the reading column: not found, not available here, sign-in, a notice.
- **Variants:** plain, error
- **States:** default, error
- **Tokens:** {colors.surface}, {colors.on-surface}, {colors.line-strong}, {colors.muted}, {colors.error}, {rounded.lg}
- **Accessibility:** the error card is an alert (`role="alert"`).
- **Do:** one heading, then the words that say what is not there and why.
- **Don't:** nest a card in a card.
- **Code:** `apps/galaxy/src/ask/page/Notice.tsx`, `apps/galaxy/src/ask/ask.css`

### Chip

- **Summary:** a short label in capitals: a round's category, a kind.
- **Variants:** label, category (a select)
- **States:** default, disabled
- **Tokens:** {colors.sunk}, {colors.muted}, {rounded.sm}, {typography.label-caps}
- **Accessibility:** the category chip is a select named "Category", off while a change saves.
- **Do:** one or two words.
- **Don't:** use a chip as a button.
- **Code:** `apps/galaxy/src/ask/page/CategoryChip.tsx`, `apps/galaxy/src/ask/ask.css`

### Theme switch

- **Summary:** Omni, Light or Dark, in the top bar; the choice is the theme, never the system's.
- **Variants:** none
- **States:** default, pressed, focus-visible
- **Tokens:** {colors.surface}, {colors.line-strong}, {colors.muted}, {colors.primary}, {colors.on-primary}, {rounded.full}
- **Accessibility:** three buttons in a group named Theme, the chosen one `aria-pressed="true"`.
- **Do:** keep the three names as they are.
- **Don't:** follow the system's preference.
- **Code:** `apps/galaxy/src/ask/theme-switch.tsx`

### Game mode button

- **Summary:** the way from an app page to the arcade, after a question.
- **Variants:** none
- **States:** default, focus-visible, open (its modal dialog)
- **Tokens:** {colors.sunk}, {colors.on-surface}, {colors.line-strong}, {rounded.control}, {typography.pixel-m}
- **Accessibility:** the dialog is modal; Switch has the focus as it opens, Esc and Stay close it.
- **Do:** ask before leaving the page.
- **Don't:** leave the page on the first click.
- **Code:** `apps/galaxy/src/switch/GameModeButton.tsx`, `apps/galaxy/src/switch/switch.css`

### Section tabs

- **Summary:** one row of tabs at the top of a page a menu entry opens, a link per page.
- **Variants:** none
- **States:** default, current, with a count
- **Tokens:** {colors.on-surface}, {colors.muted}, {colors.primary}, {colors.line-strong}
- **Accessibility:** the current tab carries `aria-current="page"`; a count is spoken with its tab.
- **Do:** show a count only above 0.
- **Don't:** put an entry's own pages in the sidebar as nested lines.
- **Code:** `apps/galaxy/src/nav/SectionTabs.tsx`, `apps/galaxy/src/nav/section-tabs.css`

### Skeleton

- **Summary:** what the server sends at once, in a block's place and of its size, while it streams.
- **Variants:** line, tile, table
- **States:** loading
- **Tokens:** {colors.sunk}, {colors.line}
- **Accessibility:** busy for assistive technology, saying what is loading; the bones are hidden.
- **Do:** borrow the box of the block it stands for, so the page does not shift.
- **Don't:** animate it for its own sake.
- **Code:** `apps/galaxy/src/skeleton/Skeleton.tsx`, `apps/galaxy/src/skeleton/skeleton.css`

### Copy link

- **Summary:** the page's own address to the clipboard, in the PRD page's header.
- **Variants:** none
- **States:** default, copied, selected (where the browser refuses)
- **Tokens:** {colors.primary}, {colors.on-primary}, {colors.muted}
- **Accessibility:** "Copied." is a status; refused, the link shows selected for the person to copy.
- **Do:** copy the address on the host it was opened on.
- **Don't:** hide the link when the clipboard refuses.
- **Code:** `apps/galaxy/src/dossier/page/CopyLink.tsx`

### Version picker

- **Summary:** a tab's versions, newest first, as a GET form that works before any script runs.
- **Variants:** version, round, run
- **States:** default, focus-visible
- **Tokens:** {colors.surface}, {colors.on-surface}, {colors.line-strong}, {colors.muted}
- **Accessibility:** a labelled select, with a Show button for a page with no script.
- **Do:** keep the tab when a version is picked.
- **Don't:** need a script to change version.
- **Code:** `apps/galaxy/src/dossier/page/VersionPicker.tsx`

### Person chip

- **Summary:** a person as every screen names them: their face inline, then their name.
- **Variants:** table, inline
- **States:** default, hover, focus-visible
- **Tokens:** {colors.on-surface}, {colors.link}
- **Accessibility:** the face is decorative; a chip with a login is a link to the profile.
- **Do:** pass `link={false}` inside another link or button.
- **Don't:** nest a link in a link.
- **Code:** `apps/galaxy/src/people/PersonChip.tsx`, `apps/galaxy/src/people/people.css`

### Brand logo

- **Summary:** the OMNI LOOP crest and wordmark, at a whole-number scale.
- **Variants:** full, lockup, mark, favicon
- **States:** default
- **Tokens:** {colors.primary}, {typography.pixel-m}
- **Accessibility:** named by the product's name.
- **Do:** the full-colour crest on a dark ground, the one-colour one on a light ground.
- **Don't:** recolour it, smooth it or shrink it below 1×.
- **Code:** `apps/galaxy/src/nav/BrandLogo.tsx`, `apps/galaxy/src/nav/brand-logo.css`, `packages/design/src/logo.ts`

### User menu

- **Summary:** you, at the end of the top bar: your face on a button that opens your menu.
- **Variants:** signed in, signed out (Sign in with GitHub)
- **States:** default, open, focus-visible, busy
- **Tokens:** {colors.surface}, {colors.line-strong}, {colors.on-surface}, {rounded.full}
- **Accessibility:** the WAI-ARIA menu-button pattern: arrows move, Escape closes and refocuses.
- **Do:** name and login first, then My profile, then Sign out.
- **Don't:** draw the menu without its keyboard pattern.
- **Code:** `apps/galaxy/src/nav/UserMenu.tsx`, `apps/galaxy/src/nav/user-menu.css`

### Waiting tile

- **Summary:** a label and a number on the dashboard, linking to where it sends you.
- **Variants:** none
- **States:** default, error (out of reach, it links nowhere)
- **Tokens:** {colors.surface}, {colors.on-surface}, {colors.primary}, {colors.line-strong}
- **Accessibility:** a section named by its label; a 0 is shown as 0.
- **Do:** say "could not load" under the label when it cannot read.
- **Don't:** hide the tile at 0.
- **Code:** `apps/galaxy/src/dashboard/counts/WaitingTile.tsx`, `apps/galaxy/src/dashboard/counts/counts.css`

TODO(human): the shell's square buttons (fold, ☰, the bell, the avatar: 36 px, a 6 px corner, edged
`line-strong`) are drawn alike in four stylesheets, and the bell's Desktop alerts and Chime are
checkboxes drawn as switches; no component holds either. Should each become a part?

## Do's and Don'ts

- Do name a semantic token on a screen (`--ask-plasma`), never a hex value or a primitive
  (`ask.css` names no colour of its own; `design-system.test.ts` refuses a colour on `:root`).
- Do keep every text pair at 4.5:1 and every edge at 3:1, in each of the three themes.
- Do serve every face from the app's own origin.
- Do draw pixel art at whole-number scales only.
- Don't use the pixel face for reading copy on the app pages: the header wordmark only.
- Don't let a workspace's theme write on `:root`: it overrides on the arcade's root element
  (`apps/galaxy/src/arcade/theme.ts`).

## Reference screens

- `prd-dossier` — a detail page: its head, its facts, its tabs and one pane, with the version picker.
- `dashboard` — a dashboard of streamed blocks: you, Waiting for you and the board, each with its
  loading and could-not-load state.
- `app-shell` — the shell every app page is built inside: the sidebar and the top bar.
