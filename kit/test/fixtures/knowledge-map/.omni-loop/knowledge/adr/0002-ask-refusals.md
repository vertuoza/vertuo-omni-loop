# ADR-0002 — The ask API answers each refusal with a standard HTTP code and a status field

**Status:** accepted · **Date:** 2026-10-01 · **PRD:** #71 · **Domain:** ask · **Layers:** api

## Context

The terminal tells a refusal from an outage.

## Decision

Each refusal carries its HTTP code and a status field.

## Consequences

A caller never parses a message to know what happened.
