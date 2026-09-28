# ADR-0050 — Fleet function refusals name the field first in the message and carry it as a hint

**Status:** adopted · **Date:** 2026-09-28 · **PRD:** #400 · **Decided:** nobody — adopted when raised (medium), 2026-09-28 · **Merged:** @pierrederval, 2026-09-28, PR #403

## Context

The shape of the fleet functions' answers and refusals, which the fleet page reads to show each refusal next to its field.

## Decision

Each fleet function refusal carries the refused field as its hint and starts its message with that field's name, for example 'Label: 1 to 12 characters'. The fleet page maps the hint to the field so it can show the refusal beside it.

The option chosen: A. A hint naming the field plus a message that starts with it, as built.

## Consequences

The wording and hints of four refusals, and the page's mapping.

## Source

`.omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md`, entry `s1-02-fleet-refusal-shape`
