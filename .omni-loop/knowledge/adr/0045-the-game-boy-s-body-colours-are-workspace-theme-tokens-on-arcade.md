# ADR-0045 — The Game Boy's body colours are workspace theme tokens on arcade.css's :root, and valid_theme() accepts the same names

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #100 · **Decided:** nobody — adopted when raised (medium), 2026-09-26 · **Merged:** @pierrederval, 2026-09-26, PR #101

## Context

The spec and the plan expected #94 to put its Game Boy body colours on `arcade.css`'s `:root`, where every colour custom property becomes a token ("Every colour custom property on `:root` must be a token, so the Game Boy's body colours are themeable the day #94 adds them"). #94 drew the body in literal colours in `shell.css` instead: seventeen opaque ones, and `--ink` declared on `.form-handheld, .form-advance`. So no body colour reached `:root`, and a theme would have moved only the shell's two gradient ends (`plasma`, `plasma-dark`) and A (`red`). Making them tokens changes the token list, and `valid_theme()` in `supabase/migrations/20260926120000_workspaces.sql`, written before #94, must list the same names (`theme.test.ts` holds the two equal); `supabase/` is outside s6's territory.

## Decision

Every opaque colour of the Game Boy's body is a --body-* custom property on arcade.css's :root and a token in theme.ts, and valid_theme() lists the same names. shell.css writes no colour of its own; only translucent light and shadow stay literal.

The option chosen: A. Every colour the Game Boy's body is drawn in becomes a named colour a workspace can change, and the database learns the names in the workspaces change itself. This is what was built.

## Consequences

Before the feature PR merges: renaming or dropping a body token is a constant in `theme.ts`, a line each in `arcade.css` and `shell.css`, and the list in the migration, edited in place. After it merges, the same plus a forward migration redefining `valid_theme()`, and a rewrite of any stored theme that uses an old name.

## Source

`.omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md`, entry `s6-01-game-boy-body-colours-are-tokens`
