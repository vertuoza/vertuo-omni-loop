---
screen: booking-form
status: draft
mock: booking-form.html
implements: []
reads: []
routes: [/book]
supersedes: null
---

## Purpose

A skipper books a berth from a phone on the pontoon: the boat, its length, when it arrives and
leaves, a phone number, shore power. A reference screen of DESIGN.md: the form a builder copies.

## Regions

- **The top bar:** Berthline, then the tabs, Bookings current.
- **The head:** Book a berth, and a notice naming the berth and the dates.
- **The form:** Boat name, Length overall (m), Arrive, Leave, Phone, Shore power.
- **The actions:** Book berth B12, the one primary action, and Cancel.

## States

- **A field in error:** Length overall, "B12 takes up to 12 m.", under the field.
- **Empty:** every field blank, the berth not yet chosen.
- **Sent:** a success notice, "B12 is booked."

## Words

Book a berth · Boat name · Length overall (m) · Arrive · Leave · Phone · Shore power ·
Book berth B12 · Cancel · B12 takes up to 12 m. · B12 is booked.

## Refusals

- No placeholder in place of a label.
- No step-by-step wizard: one short form.

## Open questions

- Is payment taken on this form, or at the dock office?

## Source

- /omni:pixel-perfect init, starter A picked by the agent (PRD 1559 dogfood) on 2026-10-11
