# ADR-0039 — The retro finds the issue it opened before by listing issues carrying the retro label, not by GitHub search

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #72 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #75

## Context

The spec says: 'Before it creates an issue the app looks for one carrying the same PRD and finding id'. It does not say where. GitHub's issue search lags behind, so a retry seconds after a half-done step can miss an issue it just opened; listing every issue of a repository is slow on a large one.

## Decision

Before opening an issue, the retro lists issues carrying the retro label, open or closed, and matches its marker. It avoids GitHub search, which lags and could open a twin on a quick retry. An issue whose label was removed is not found.

The option chosen: A. Look among the issues carrying the retro label, the option built.

## Consequences

A constant: the list's filter. Widening it to every issue of the repository costs more reads per run and stores nothing.

## Source

`.omni-loop/delivery/shipped/0072-retro/outbox/settled.md`, entry `s7-03-retro-issues-found-by-their-label`
