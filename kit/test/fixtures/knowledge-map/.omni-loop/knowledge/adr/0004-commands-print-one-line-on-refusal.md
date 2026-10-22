# ADR-0004 — A command refuses with one line and exit code 2

**Status:** accepted · **Date:** 2026-10-01 · **PRD:** #7 · **Layers:** cli

## Context

Agents read a command's refusal to decide what to do next.

## Decision

One line on stderr, exit code 2.

## Consequences

A refusal never reads as a crash.
