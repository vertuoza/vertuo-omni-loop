# Plan: Fullscreen is opt-in on desktop

PRD #451, spec in `spec.md` beside this plan. Built on the feature branch `feat/fullscreen-opt-in`
into `main` (`Closes #451`), through sub-PRs from `feat/fullscreen-opt-in--<slice>` into the
feature branch (`Part of #451`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | On desktop no press asks for fullscreen on its own; phones still ask on the first press, F and Esc unchanged, and a `toggle` press enters and leaves | `apps/galaxy/src/arcade/fullscreen` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/README.md` | — | 1 |
| s2 | On desktop a dim ⛶ button named "Full screen (F)" in the page's bottom-right corner enters fullscreen, hides while fullscreen, and is absent on phones and where fullscreen is refused | `apps/galaxy/src/arcade/FullscreenButton` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/shell.css` `apps/galaxy/README.md` | s1 | 2 |

**Shared ground.** `apps/galaxy/src/arcade/ArcadeApp.tsx` (s1 passes the form to the fullscreen
hook; s2 renders the button) and `apps/galaxy/README.md` (s1 rewrites the fullscreen paragraph; s2
adds the button's line to it) are declared by both. s2 is blocked by s1 and sits in wave 2, so the
two never merge side by side.

## Per slice: done when

**s1**
- `fullscreen.test.ts`: on the `full` form, the first key press, the first click and the first
  touch press ask nothing, and no later press other than F or `toggle` asks (acceptance 1).
- On `handheld` and `advance`, the first press still asks and, after leaving, the next press does
  not (acceptance 2).
- Every existing F and Esc test still passes unchanged in intent (acceptance 3).
- A `toggle` press enters when off, leaves when on, is spent (the game does not read it), and asks
  nothing where fullscreen is not allowed.
- `ArcadeApp.tsx` gives the hook the current form; `pnpm test` is green.
- `apps/galaxy/README.md`'s fullscreen paragraph says desktop never asks on its own, phones do, F
  toggles (acceptance 8, first half).

**s2**
- A component test: on `full` with fullscreen allowed and off, a button named "Full screen (F)" is
  rendered; while fullscreen it is not; on `handheld` and `advance`, and where
  `document.fullscreenEnabled` is false, it is not (acceptances 4, 5, 6).
- Clicking it sends exactly one `toggle` press (acceptance 5).
- A mouse press on it prevents focus, as the key hints do, so Enter and Space still act as START
  and A (acceptance 7).
- `shell.css`: fixed to the page's bottom-right corner, outside the screen, about 40% opacity,
  fully opaque on hover and `:focus-visible`, with a visible focus ring; `pnpm test` is green
  (including the design-system test: colours from the theme's tokens only).
- `apps/galaxy/README.md` names the ⛶ button (acceptance 8, second half).
- Manual desktop check, noted in the sub-PR: clicks and keys keep the window; the ⛶ enters
  fullscreen; Esc leaves and the ⛶ comes back.
