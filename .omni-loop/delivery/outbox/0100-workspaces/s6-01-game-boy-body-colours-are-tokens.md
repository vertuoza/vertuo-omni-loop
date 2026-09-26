---
id: s6-01-game-boy-body-colours-are-tokens
prd: 100
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The Game Boy's body is drawn in seventeen colours of its own, not in the arcade's shared colours. Should a workspace be able to change those too?

## The decision, in plain words

Yes: each colour of the body is now a named colour a workspace can change, like the arcade's others, and the database accepts the same names. With nothing changed, the Game Boy looks exactly as it does today.

## The intro, for fun

The Game Boy arrived wearing seventeen colours that nobody had given a name.

## The punchline, for fun

Each one now wears a name tag, and the database checks it at the door.

## The options, in plain words

A. Every colour the Game Boy's body is drawn in becomes a named colour a workspace can change, and the database learns the names in the workspaces change itself. This is what was built.
B. Only the body colours that carry the brand's purple become named colours; the dark parts, the frame around the screen and the buttons' pad, keep today's colours.
C. The body keeps its own colours; a workspace's colours reach it only where it already used the arcade's shared ones, the ends of its shell and the A button.
D. Every body colour becomes a named colour, but the database learns the names in a separate, later change instead of the workspaces change.

## What I had to decide

The spec and the plan expected #94 to put its Game Boy body colours on `arcade.css`'s `:root`, where every colour custom property becomes a token ("Every colour custom property on `:root` must be a token, so the Game Boy's body colours are themeable the day #94 adds them"). #94 drew the body in literal colours in `shell.css` instead: seventeen opaque ones, and `--ink` declared on `.form-handheld, .form-advance`. So no body colour reached `:root`, and a theme would have moved only the shell's two gradient ends (`plasma`, `plasma-dark`) and A (`red`). Making them tokens changes the token list, and `valid_theme()` in `supabase/migrations/20260926120000_workspaces.sql`, written before #94, must list the same names (`theme.test.ts` holds the two equal); `supabase/` is outside s6's territory.

## What I did meanwhile

Every opaque colour of `shell.css` moved onto `arcade.css`'s `:root` as a `--body-*` custom property at its old value (`body-mid`, `body-ink`, `body-ink-soft`, `body-lens-1`, `body-lens-2`, `body-lens-text`, `body-led-off`, `body-pad-1`, `body-pad-2`, `body-pad-arrow`, `body-pad-down-1`, `body-pad-down-2`, `body-a-shine`, `body-b-shine`, `body-pill-1`, `body-pill-2`, `body-grille`; `--ink` became `--body-ink`), and each is a token in `apps/galaxy/src/arcade/theme.ts`. `valid_theme()`'s list was edited in place in the workspaces migration, which has never been applied anywhere, and `supabase/checks/access.sql` now also accepts a theme overriding `body-mid`. The light and shadow on the body (translucent white and black, and one translucent purple shadow under the buttons) stay literal. `theme.test.ts` fails if `shell.css` writes a colour of its own again. With the theme `{}`, `pnpm galaxy:shots` gives 72 of 72 screenshots pixel-identical to the feature branch's.

## What it costs to change later

Before the feature PR merges: renaming or dropping a body token is a constant in `theme.ts`, a line each in `arcade.css` and `shell.css`, and the list in the migration, edited in place. After it merges, the same plus a forward migration redefining `valid_theme()`, and a rewrite of any stored theme that uses an old name.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the seventeen names are the author's; PRD 3's settings page will show them to people, and nothing says how they should read there (author)
- a theme that overrides `plasma` and `plasma-dark` but not `body-mid` gets a body with a band of today's purple across its middle; whether `body-mid` should rather follow `plasma` unless it is set is not settled (author)
