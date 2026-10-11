# Dogfood: PRD 1559 on omni-loop and on a repository with no design system

**Slice:** s8 · **Date:** 2026-10-11 · **Run by:** an agent following `/omni:pixel-perfect init`
(`kit/plugin/skills/pixel-perfect/init.md`) by hand, non-interactively, inside `/omni:do-work --in-wave`.

Two runs: the **reading path** on omni-loop itself, and the **starter path** on a fixture repository
with no design system. Each says what it wrote, what each check printed, and what each tool got
wrong. Every follow-up is a medium outbox item of this PRD, named at the end.

## Run 1: reading path, on omni-loop

**What it read.** `@omni/design` (`packages/design/`: its README, `src/palette.ts`, `src/tokens.ts`,
`src/fonts.ts`, `src/logo.ts`), then the app pages that draw with it (`apps/galaxy/src/ask/ask.css`,
`theme-tokens.ts`, `nav/*.css`, `page-width.test.ts`) and the component files a mockup control points
at. No Storybook, shadcn `components.json` or Figma link exists here.

**What it wrote.**

- `DESIGN.md` at the root, in Google's format: 17 primitives and the app pages' semantic tokens in
  their three themes (Omni unprefixed, `light-*`, `dark-*`, read from `ASK`), the 11 steps of
  `TYPE_SCALE` plus two labels read from `ask.css`, five corners, eight spacing steps, seven
  `components` token groups; prose sections in the format's order, each naming the file it was read
  from; **13 parts** (Button, Card, Chip, Theme switch, Game mode button, Section tabs, Skeleton,
  Copy link, Version picker, Person chip, Brand logo, User menu, Waiting tile), each with its `Code`;
  and three **reference screens** the library already held (`prd-dossier`, `dashboard`,
  `app-shell`), named, not redrawn.
- Four `TODO(human)` questions where the files are silent: whether HOME and the arcade are areas
  with a system of their own; whether `ask.css`'s spacing steps are a scale; which hover, active and
  loading states the button has; whether the shell's square buttons and the bell's switches become
  parts.
- The design form's System slot became `See: DESIGN.md`; `omni kb show design` now prints DESIGN.md
  in its place. What the slot said moved into DESIGN.md's prose, with its sources.
- The six library mockups tag their parts with `data-part`; four name their off-list parts under
  the marked screen.

**What the checks printed.**

| check | result |
|---|---|
| `omni design parts` | 13 parts, `reference screens: prd-dossier, dashboard, app-shell`, no line that does not read |
| `omni check design` | exit 0, green: 6 screens, 0 locked. **218 warnings**, every one `is a component file no part names and no screen implements` (item s8-01) |
| `omni design parts --check` on each mockup | no `untagged:` on any of the six. `parts: all listed` on `dashboard` and `prd-dossier`; `off-list: icon-button` on `app-shell`; `off-list: icon-button`, `toggle` on `notifications`; `off-list: cabinet` on `game-room`; `off-list: sign-up-button` on `home` |
| `omni design words` on each mockup | unchanged: no new finding. `home` keeps its three `explains-at-rest` findings, which are what HOME shows now |
| `omni check kb` | no new warning on the design form |
| `npx @google/design.md lint DESIGN.md` (v0.4.0, fetched by npx here) | exit 0, **0 errors**, 40 warnings, all `orphaned-tokens` (item s8-04) |

**Which parts are listed, and why.** A part is what the code holds as a component, or a shared class
every page uses (`.ask-button`, `.ask-card`, `.ask-chip`). The controls a mockup draws that no
component holds stay off the list and are proposed: the shell's four square buttons and the bell's
two switches (item s8-02), HOME's SIGN UP WITH GITHUB and the game room's cabinets (item s8-03).

## Run 2: starter path, on `kit/test/fixtures/no-design-system/`

**The repository.** `repo/` is Berthline, a marina's berth booking: a README, a design form invade
would leave (Product filled, System a `TODO(human)`), two pages with no stylesheet, and a config with
design on. `omni design parts` printed `parts: no DESIGN.md (run /omni:pixel-perfect init)` and
`omni design screens` an empty library.

**The questions.** init asks four, one at a time. Run non-interactively, the answers came from the
README and the form's Product slot, already written there: who (the harbourmaster at a desk by the
window, skippers on a phone on the pontoon, in full sun or at dusk), the voice (a shipping forecast:
plain, exact, 24-hour times), and the product admired (the Met Office shipping forecast). Nothing
was asked again.

**The page.** `starters.html` (kept beside `repo/`) draws three directions, each a full set: 30
semantic tokens in light and dark, eight parts in every state (Button, Text field, Select, Checkbox,
Status badge, Tabs, Notice, Berth table), and two reference screens built only from them, plus the
list's loading, empty and error states and the list in dark: 12 marked screens.

- **A, Chart room:** chart paper and navy ink, chart magenta for focus, Source Serif 4 titles, IBM
  Plex Sans, berth codes and times in IBM Plex Mono, 2 px corners, dense.
- **B, Pontoon:** white and black, signal yellow, Archivo Narrow capitals, square corners, 52 px
  targets.
- **C, Harbour office:** cool grey and sea green, Source Sans 3, 8 px corners, roomy.

Every text pair passes 4.5:1 and every edge 3:1, in light and dark, computed before drawing (two
pairs in B's and C's dark themes failed at first and were fixed). Checked against the craft floor's
refuse list: no card grid as the page, no hero metric, no kicker, no gradient text, no glass, no
coloured side border, no hard offset shadow, no glyph for an icon, monospace only for data. The page
was screenshotted at 1440 in a headless Chromium and looked at: the table cells wrapped in the
narrow frames, and were set not to.

**The pick: A, Chart room — chosen by the agent, since no person was asked.** It draws on both
scenes the product names: the density the harbourmaster needs for a whole pontoon at a desk, and
dark ink on light paper for a phone in full sun. Its voice is the shipping forecast the README
admires. B serves the phone alone, and its signal yellow sits too close to the warning colour a
held berth needs. C is the calm office look the category reaches for by habit, the generic look
init exists to avoid. In a real run this is the person's pick, and "another round" is open.

**What it wrote** (in `after/`, at the repository's paths): `DESIGN.md` (A's tokens, light unprefixed
and `dark-*`, eight type steps, the eight parts with `Code: none`, two reference screens); the draft
screens `berths` (a list, its loading, empty and error states) and `booking-form` (a form, one field
in error), each `status: draft` with empty `implements` and `reads`, its mockup drawn from DESIGN.md's
parts and semantic tokens; and the form's System slot as `See: DESIGN.md`. No lock, no code.

**What the checks printed** (on a copy of `repo/` with `after/` laid over it):

| check | result |
|---|---|
| `omni design parts` | 8 parts, `reference screens: berths, booking-form` |
| `omni check design` | exit 0, no warning (after the fix of item s8-05) |
| `omni design screens` | `berths draft /berths`, `booking-form draft /book` |
| `omni design parts --check` | `parts: all listed` on both mockups; no `untagged:` or `off-list:` on any of the 12 screens of `starters.html` |
| `omni design words` | `findings: none` on both mockups and on all 12 screens of `starters.html` |
| `omni check kb` | the form reads; only the forms the fixture does not hold are missing |
| `npx @google/design.md lint DESIGN.md` | exit 0, **0 errors**, 53 warnings, all `orphaned-tokens` |

The pull request step (a branch, `/omni:pr`, a person merges) did not run: inside a slice, the
fixture is committed on the slice branch instead.

## What each tool got wrong

- **init.md and the DESIGN.md reader disagree on a starter's `Code`.** init.md asks a starter's
  parts to say they have no code yet; written `Code: none yet (starter)`, the reader keeps it as a
  path and `omni check design` warns that eight code paths are gone. Only a bare `none` reads as
  nothing (item s8-05).
- **The drift check is loud on a repository whose components are pages.** 218 warnings on omni-loop,
  where `design.paths` covers the route and area folders and most `.tsx` files are page sections,
  not parts (item s8-01).
- **The DESIGN.md format holds one colour list.** Themes become prefixed tokens, and its lint calls
  every token no `components` entry names an orphan: 40 and 53 warnings on files it accepts (item
  s8-04). Its typography has no slant, so Anton's 12° lean lives in the prose only.
- **The parts check names a primary-marked element inside an untagged control twice** (the cabinet
  button, then its `A · PLAY` span); tagging the control quiets both. Not raised: tagging is the fix.
- **`omni` needs a git repository** even for `design parts` on a fixture folder: the copy had to be
  `git init`ed first. Not raised: a fixture run is not the loop's own path.

## Follow-ups, each a medium outbox item

- `s8-01-drift-warnings-flood` — should `omni check design` count fewer files on omni-loop?
- `s8-02-shell-icon-button-and-toggle` — should the shell's square button and the bell's switch
  become parts?
- `s8-03-home-and-arcade-parts` — does HOME or the arcade get a list of its own, or join this one?
- `s8-04-themes-in-one-colour-list` — keep the other themes as prefixed tokens, with the lint's
  orphan warnings?
- `s8-05-starter-code-line` — a bare `none`, or a reader that accepts `none yet`?
