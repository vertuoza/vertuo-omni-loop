# ADR-0165 — The mission's supervisor names the round of each repair, and the database caps three per cause per round and nine per mission

**Status:** adopted · **Date:** 2026-11-17 · **PRD:** #2980 · **Decided:** nobody — adopted when raised (medium), 2026-11-17 · **Merged:** @pierrederval, 2026-11-17, PR #2981

## Context

Whether the round stays a number the supervisor gives, or becomes the mission's own counter that the database moves on each Resume.

## Decision

The supervisor gives the round number on each repair it records, and a person's Resume passes the next one. The database refuses a fourth repair of one cause in a round and a tenth repair of a mission across all rounds, so a wrong round never allows more than nine.

The option chosen: A. A. The supervisor names the round, and the database caps three per cause within it and nine in all: the option built.

## Consequences

A small migration: a repair_round column on missions, moved by Resume, and the budget trigger reading it instead of the caller's number. The rows already written keep their round.

## Source

`.omni-loop/delivery/shipped/2980-mission-repairs/outbox/settled.md`, entry `s2-02-repair-round-given-by-the-supervisor`
