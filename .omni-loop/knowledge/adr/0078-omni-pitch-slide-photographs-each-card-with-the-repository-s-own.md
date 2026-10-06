# ADR-0078 — omni pitch slide photographs each card with the repository's own Playwright, loading typefaces from Google Fonts at render time

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #859 · **Decided:** nobody — adopted when raised (medium), 2026-10-01 · **Merged:** @pierrederval, 2026-10-06, PR #860

## Context

Keep loading the typefaces from Google Fonts when a card is drawn, or ship the typeface files inside the kit so a card always looks the same offline.

## Decision

Each slide card is drawn as a web page and photographed by the Playwright the proof videos already use; typefaces load from Google Fonts at that moment, and offline a system lookalike is used, with the card still fitting.

The option chosen: A. The repository's Playwright draws each card; typefaces from Google Fonts, a system lookalike offline (built).

## Consequences

Shipping the typefaces later is adding the files and changing one link per page; nothing stored changes.

## Source

`.omni-loop/delivery/shipped/0859-pitch/outbox/settled.md`, entry `s4-03-slide-rendering-and-fonts`
