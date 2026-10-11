---
screen: berths
status: draft
mock: berths.html
implements: []
reads: []
routes: [/berths]
supersedes: null
---

## Purpose

Every berth of the marina on one screen, for the harbourmaster at the desk: its code, its length,
its status today, the boat in it and until when. A reference screen of DESIGN.md: the list a builder
copies.

## Regions

- **The top bar:** Berthline, then the tabs Berths, Arrivals and Bookings, Berths current.
- **The head:** Berths, the day and time, and the one primary action, Book a berth.
- **The filters:** Pontoon (All, A to D), Free only, Show.
- **The berth table:** Berth, Length, Status, Boat, Until; a held berth's row selected.

## States

- **Loading:** the table's header with three rows of bones, busy.
- **Empty:** a notice, "No free berth on pontoon D.", with Show all pontoons.
- **Error:** an error notice, "Berths did not load.", with Try again.

## Words

Berthline · Berths · Arrivals · Bookings · Book a berth · Pontoon · All · Free only · Show · Berth ·
Length · Status · Boat · Until · Free · Booked · Held · Out of service · No free berth on pontoon D. ·
Show all pontoons · Berths did not load. · Try again.

## Refusals

- No card per berth: berths are rows.
- No colour without its word on a status.

## Open questions

- Does the harbourmaster need the arrivals of the day on this screen, or only under Arrivals?

## Source

- /omni:pixel-perfect init, starter A picked by the agent (PRD 1559 dogfood) on 2026-10-11
