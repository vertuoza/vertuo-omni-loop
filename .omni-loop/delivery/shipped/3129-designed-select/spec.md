---
prd: 3129
title: One designed Select for every dropdown
blocked-by: none
spec: file
phase0: server
---

## Problem

The app pages have no dropdown of their own. `Select` in `@omni/ui` wraps the browser's native
`<select>` (`packages/ui/src/Select.tsx`), so its open list is the operating system's picker: a grey
box that ignores our tokens, our type and our dark theme (the plain box beside "sorted by the model"
on the Ask page). Worse, 26 files under `apps/galaxy/src/` skip it and write a raw `<select>` with a
class of their own (`ask-category-pick`, `ask-share-pick`, `products-look-select`…), and
`products/pitch-form.tsx` keeps a private `Select` of eight uses. The design ratchet already counts a
raw `<select>` as a `raw-component` breach, but per file: a file the baseline lists for a raw
`<button>` can add a `<select>` and nothing fails.

## Solution

1. **A designed `Select` in `@omni/ui`,** rebuilt on Base UI's Select (`@base-ui/react/select`,
   the library Combobox and Menu already sit on). Base UI owns the behaviour: opening on click,
   Enter, Space or the arrows; moving with the arrows, Home and End; jumping by typing (type-ahead);
   picking with Enter; closing on Escape or an outside click, focus back on the trigger;
   `role="listbox"` and `role="option"` with `aria-selected`; and a hidden input, so a `<form>`
   posts `name=value` as the native one did.
   - **Props:** `label`, `options` (`{ value, label }[]`), `name`, `value`, `defaultValue`,
     `onValueChange(value: string)`, `placeholder`, `size` (`md` or `sm`), `disabled`, `required`,
     `invalid`. Inside a `Field` it takes its id, description and error from it, as today.
     `onChange(event)` is gone: every caller moves to `onValueChange` in this PRD.
   - **The trigger:** `md` wears the Input's look with the chevron (forms); `sm` is a compact
     trigger in `--type-2` for a chip, a toolbar or an inline sort (Ask's category chip, the share
     picker, the dossier's version picker).
   - **The list:** the Menu's panel and items (`omni-menu`, `omni-menu__item`), at least the
     trigger's width, at most `min(320px, 100vw − 2 × --space-4)` wide and 320 px tall with its own
     scroll; the picked option carries a **check** glyph and `aria-selected`, the highlighted one
     `--color-accent-soft`. Every option is at least 44 px tall, at both sizes. Only tokens, so the
     Omni, Light and Dark themes need no rule of their own.
   - **The check glyph** joins the 1-bit icon set of `@omni/design` (`packages/design/src/icons/icons.ts`),
     drawn like `chevron-down`.
   - `Select.meta.ts` drops "native select" and says what it is now; a specimen still shows the open
     list on `/design`; `Select.dom.test.ts` proves the keyboard, the dismissal, the form post and
     the roles.
2. **Every dropdown moves to it.** The 26 files with a raw `<select>`, `FilterBar` (in
   `@omni/ui`) and the private `Select` of `products/pitch-form.tsx` render `<Select>`; the inline
   ones take `size="sm"`. The classes that styled the old controls are deleted once nothing uses
   them, so `design/baseline.json` shrinks. Each migrated screen keeps or gains a test that picking
   an option calls its save (the F-E Developer's objection, accepted).
3. **The ratchet refuses a new one.** `scripts/design-ratchet.ts` gains a rule `raw-select`: any
   JSX `<select>` under `apps/galaxy/src/` (outside the arcade, `play-dock/` and HOME, as today) is a
   `raw-select` breach, and `raw-component` stops counting `<select>`. The baseline holds no
   `raw-select` line and may only shrink, so a new `<select>` fails `pnpm design`, even in a file
   listed for another rule.
4. **The screen library first.** A shared screen `select` (`kind: shared`) and its mockup are
   drawn in `.omni-loop/knowledge/design/screens/` as a draft: the closed trigger at `md` and `sm`,
   the open list with the check, a highlighted option, disabled and invalid, at 1280 and 390 px.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | ui | `Select` (kept), `onValueChange` | `onValueChange` ← packages/ui/src/Combobox.tsx:26 |
| vertuo-omni-loop | ui | `size: 'md' \| 'sm'` | no written convention: follows packages/ui/src/Icon.tsx (`size`) and `omni-button--md` in packages/ui/src/Menu.tsx:41 |
| vertuo-omni-loop | ui | `omni-select__trigger`, `omni-select__popup`, `omni-select__item`, `omni-select__check` | no written convention: follows `omni-combobox__*` in packages/ui/src/Combobox.css:6 |
| vertuo-omni-loop | design | glyph `check` | no written convention: follows `'chevron-down'` in packages/design/src/icons/icons.ts:189 |
| vertuo-omni-loop | ci | rule `raw-select` | no written convention: follows `raw-component` in scripts/design-ratchet.ts:169 |
| vertuo-omni-loop | design | screen `select` | no written convention: follows the shared screens `notifications` and `persona-drawer` in .omni-loop/knowledge/design/screens/ |

## Decisions

- **Built on Base UI's Select,** not drawn from scratch: Combobox and Menu already use Base UI
  1.9, which brings the listbox's keyboard, dismissal, ARIA and form post (person, in design).
- **`onValueChange(value: string)`** replaces `onChange(event)`, as Combobox does, rather than a
  faked change event (person, in design).
- **Two sizes, `md` and `sm`** (person, in design).
- **A rule of its own, `raw-select`, with no baseline line,** rather than leaving `<select>` in
  `raw-component` (person, in design).
- **The component first, then the migration in slices by area, the ratchet rule last** (person, in
  design).
- **The voice's objection, accepted.** F-E Developer (persona:F-E Developer): "Swapping 26 native
  dropdowns at once is exactly how a form quietly stops sending its value in production. I want proof
  each screen still saves what I pick." Settled `accepted`: each migrated screen proves its pick
  still saves, and the Select's DOM test proves the form post.
- **No proof video** (person).

## User stories

- As a member reading a dossier, I pick a version from a list that looks like the rest of the page,
  in my theme, with a check on the version I am reading.
- As a member on the Ask page, I change a round's category from a small chip that opens our own
  list, by mouse or by keyboard.
- As a member on a phone, the list opens inside the screen and every option is big enough to tap.
- As someone who uses a screen reader, the dropdown announces itself as a list box, its options and
  the one picked.
- As an engineer, `pnpm design` stops me when I write a raw `<select>`, and tells me to use
  `Select`.

## Scope

In: the `Select` of `@omni/ui` and its CSS, meta, specimen and DOM test; the `check` glyph of
`@omni/design`; `FilterBar`; the 26 files of `apps/galaxy/src/` that hold a raw `<select>` today
(listed in the plan) and `products/pitch-form.tsx`; the classes they no longer use; the `raw-select`
rule and its guard test; `design/baseline.json`; the draft screen `select` and its mockup.

Out: the arcade, `play-dock/` and HOME, which keep their own surface and never had a raw `<select>`;
`Combobox` and `Menu`, unchanged; a multi-select or grouped options (no screen uses either today); a
search box inside the list (that is the Combobox).

## Test seams

- `packages/ui/src/Select.dom.test.ts` (happy-dom, as `Combobox.dom.test.ts`): opens by click and by
  keyboard, arrows and type-ahead move the highlight, Enter picks and calls `onValueChange`, Escape
  and an outside click close it and focus returns to the trigger, the listbox and option roles with
  `aria-selected`, the hidden input posts `name=value` in a `<form>`, `Field` wiring, `disabled` and
  `invalid`.
- One test per migrated screen (its existing test file, or a new one beside it) that picking an
  option calls the screen's save with the right value.
- `scripts/design-ratchet.test.ts`: a `<select>` is a `raw-select` breach and no longer a
  `raw-component` one; a `<select>` in a file the baseline lists for `raw-component` still fails.
- The design-system tests that already read every `*.meta.ts` and the icon set run unchanged.
- No test calls GitHub or the network (testing form).

## Risks

- **What merging publishes:** every dropdown of the app pages changes at once on the next Vercel
  deployment of `@omni/galaxy-app`. No data, API or migration changes. Rollback: revert the feature
  PR; nothing is stored differently.
- **A screen that stops saving** what is picked: held by the per-screen tests and the form-post test.
- **A list cut off** inside a container with `overflow: hidden`: the popup renders in a portal, as
  Menu's and Combobox's do.
- **The Legal entries:** none touched.
- **The locked laws:** the Ask files (`CategoryChip.tsx`, `ShareButton.tsx`,
  `WorkspaceHistory.tsx`) put the change in the `ask` domain, so these locked laws apply; the design
  changes only the control, never what is read, written or answered, and keeps every one:
  - BR-PRODUCT-12: an answer would change after it was given, and nobody could tell what was decided.
    Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it
    needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-94: an agent could answer a question in a person's name. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
  - N-PRODUCT-7: a person could be locked out of their own terminal by a broken hook. Changing it
    needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - N-PRODUCT-8: a person's questions and answers could be sent to a server they never chose.
    Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

  The questions card (`agent-connect/`), the terminal tokens card (`profile/`) and the settings
  repository line (`omni-settings/`) put the change in the access area too, so these apply as well,
  and are kept the same way:
  - BR-PRODUCT-28: a stranger could link a GitHub account to a workspace. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-63: an agent link could read repositories of another workspace. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-64: a person who left could still act through an agent link. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
  - N-PRODUCT-17: anyone opening the app could read a secret sent to the browser. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-59: a member could copy the workspace's stored AI key. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The Select opens our own list and picks by keyboard
  Given a Select with the options "Developer", "Product" and "Design", "Product" picked
  When the person focuses it, presses the down arrow, then presses Enter
  Then a list box opens with "Product" marked picked and a check beside it
  And the highlight moves to "Design" and Enter calls onValueChange with its value
  And the list closes and focus is back on the Select
```

### AC-2 · test

```gherkin
Scenario: Typing jumps to an option, Escape and an outside click close it
  Given an open Select with the options "Alpha", "Beta" and "Gamma"
  When the person types "g"
  Then "Gamma" is highlighted
  When the person presses Escape
  Then the list closes with the value unchanged
  When the person opens it again and clicks outside it
  Then the list closes with the value unchanged
```

### AC-3 · test

```gherkin
Scenario: A form still posts the value picked
  Given a form holding a Select named "role" with "dev" picked
  When the person picks "pm" and the form is submitted
  Then the form data holds role=pm
```

### AC-4 · test

```gherkin
Scenario: The Select is a list box to assistive technology
  Given a Select inside a Field labelled "Role", with an error
  When its list is open
  Then the trigger is named "Role", described by the error, and marked invalid
  And the list has the role listbox and each option the role option
  And only the picked option is aria-selected
```

### AC-5 · test

```gherkin
Scenario: Every migrated screen still saves what is picked
  Given a screen of the app pages that held a dropdown before this PRD
  When the person picks another option in its Select
  Then the screen calls its save with that option's value
```

### AC-6 · test

```gherkin
Scenario: No native dropdown is left on the app pages
  Given the tracked files under apps/galaxy/src/, the arcade, play-dock and HOME left out
  When the design ratchet reads them
  Then none holds a raw select element
  And design/baseline.json holds no raw-select line
```

### AC-7 · test

```gherkin
Scenario: The ratchet refuses a new raw select
  Given a file the baseline lists for raw-component
  When a raw select element is added to it
  Then the design ratchet reports a raw-select breach for that file and fails
```
