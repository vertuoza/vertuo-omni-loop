# Plan: Select your app at sign-in

PRD #932, spec beside this plan (`spec.md`). The feature branch `feat/app-selector` merges into
`main` through the feature PR (`Closes #932`). Each slice is a sub-PR from
`feat/app-selector--<slice>` into the feature branch (`Part of #932`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | An Omni app sign-up lands on `/app`: `signUp` takes the pick and puts `next=app` on the callback address (the demo goes straight to `/app` or `/play`), and the callback's allowlisted landing turns `app` into `/app` and anything else into `/play`, with `/signup`, `link` and `ask-cli` unchanged | `apps/galaxy/src/home/sign-up` `apps/galaxy/src/data/sign-in.ts` `apps/galaxy/src/data/sign-in.test.ts` `apps/galaxy/app/auth/callback/` `apps/galaxy/src/home/home.test.ts` | — | 1 |
| s2 | The two sprites exist in `@omni/design`: `code-mark`, a sober two-tone `</>` (cyan on slate, no face), and `arcade-cabinet`, a cabinet with marquee, screen, joystick and buttons, two frames each, palette colours only, listed in the README's table | `packages/design/src/sprites` `packages/design/README.md` | — | 1 |
| s3 | Clicking SIGN UP WITH GITHUB opens SELECT YOUR APP: two pedestals with the sprites, the ▼ P1 cursor on OMNI APP, the stat bars, REMEMBER MY CHOICE off, ← → Tab Enter Esc, focus kept in the dialog, reduced motion respected, and a pick starting the sign-in with that pick (saved under `omni-loop:app-choice` when the toggle is on) | `apps/galaxy/src/home/selector/` `apps/galaxy/src/home/Controls.tsx` `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/poster/contrast.test.ts` `apps/galaxy/src/home/poster/Poster.tsx` `apps/galaxy/src/home/home.test.ts` | s1, s2 | 2 |
| s4 | A remembered pick skips the overlay: the click goes straight to GitHub with the saved pick, the line under the button reads `Opens the Omni app · change` (or the Arcade), and **change** clears the pick and opens the overlay | `apps/galaxy/src/home/selector/` `apps/galaxy/src/home/Controls.tsx` `apps/galaxy/src/home/poster/Poster.tsx` `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/home.test.ts` | s3 | 3 |

**Shared ground.**
- `apps/galaxy/src/home/home.test.ts` renders HOME and stubs the callback's `afterSignIn`, so the
  callback change (s1), the overlay (s3) and the hint line (s4) can all touch it. s3 is blocked by
  s1, and s4 by s3, so the three never share a wave.
- `apps/galaxy/src/home/selector/`, `Controls.tsx`, `Poster.tsx` and `home.css` are declared by s3
  and s4. s4 is blocked by s3, so it lands in the next wave.
- `apps/galaxy/src/home/sign-up.ts` and its test are s1's alone. s3 and s4 call `signUp` with a pick
  and never change it.

## Per slice: done when

**s1**
- `sign-up.test.ts`: an Omni app pick starts GitHub with the callback address ending in `?next=app`,
  and an Arcade pick with the bare `/auth/callback`.
- `sign-up.test.ts`: without Supabase, the Omni app pick goes to `/app` and the Arcade pick to
  `/play`.
- `sign-in.test.ts`: the landing function maps `app` to `/app`. `null`, `arcade`, `link`,
  `//evil.example`, `https://evil.example` and `/app/../x` all map to `/play`.
- The callback lands a signed-in member on `/app` with `next=app` and on `/play` without it. Someone
  in no workspace still goes to `/signup`, and a failed sign-in returns to
  `/play?signin_error=…`. The `ask-cli` and `link` flows are unchanged, as their existing tests
  show.

**s2**
- `sprites.test.mjs`: `code-mark` and `arcade-cabinet` are in `SPRITE_DEFS`, each with two frames
  of its declared size, using palette colours only.
- `sprites.test.mjs`: `code-mark` uses at most two tones besides its outline.
- The README's sprites row names both.

**s3**
- `selector/state.test.ts` covers the reducer:
  - it opens with the cursor on `app` and the toggle off;
  - ← and → move the cursor and wrap around;
  - Enter picks the selected app, and Esc closes;
  - a pick with the toggle on returns save-and-go, and with it off returns go only.
- `selector/choice.test.ts` covers the saved pick:
  - it is saved, read and cleared;
  - an unknown stored value reads as no pick;
  - storage that throws reads as no pick and saves nothing, without throwing.
- `contrast.test.ts`: every text colour the overlay sets reads at 4.5:1 or better on its
  background.
- `home.test.ts`: HOME's server markup still reaches no Supabase, and the overlay is not in it.
- A manual browser path: click SIGN UP WITH GITHUB, then press Enter, and GitHub opens. Esc closes
  the overlay. With reduced motion, the cursor does not blink.

**s4**
- `selector/choice.test.ts`: the hint line reads `Opens the Omni app · change` for `app` and
  `Opens the Arcade · change` for `arcade`, and there is no hint line without a saved pick.
- A test through the ports: with a saved pick, a click starts the sign-in with that pick and never
  opens the overlay. **change** clears the pick and opens the overlay.
- `home.test.ts`: the server markup carries no hint line, which is drawn only in the browser.
