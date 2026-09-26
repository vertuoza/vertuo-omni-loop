# ADR-0046 — Canvas scenes read every colour equal to a theme token from FrameState.theme; translucent shades and the uncrewed fleet colour stay literal

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #100 · **Decided:** nobody — adopted when raised (medium), 2026-09-26 · **Merged:** @pierrederval, 2026-09-26, PR #101

## Context

The spec makes every colour custom property on `:root` a token and says the canvas scenes read the same resolved values, but not which of the canvas's colours are tokens. The scenes wrote their colours as literals: some are a token's value (`#a45cff` for OmniMan's glow and the plasma trail, `#6a2fd0` in the trail, `#ff3b5c` for a distress pulse and the map's hyperlanes, `#6ff0ff` for the away bar and a terraformed planet's atmosphere, `#ffd84a` for the map's brackets, `#07061c` for space), others are no token's (nebulae, star layers, the `#0b0a26` outlines). The stylesheets also write translucent shades of tokens as `rgba()` (panels over `deep`, `void` and `navy`), and `fleets.ts` gives a planet no fleet holds `#8a90d6`, `dim`'s value, which the canvas draws too.

## Decision

Every part drawn in exactly one named colour, canvas scenes included, reads it from FrameState.theme, and a test fails if a scene writes a token's default again. Translucent rgba() shades and the uncrewed planet colour keep their literals.

The option chosen: A. Every part drawn in exactly one of the named colours follows it; see-through shading and a planet no fleet holds keep today's colours. This is what was built.

## Consequences

Constants: a literal swapped for a theme read, or back, in the scene files and `fleets.ts`, and their tests. Nothing stored changes.

## Source

`.omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md`, entry `s6-02-what-follows-a-theme`
