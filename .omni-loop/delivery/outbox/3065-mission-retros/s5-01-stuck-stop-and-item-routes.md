---
id: s5-01-stuck-stop-and-item-routes
prd: 3065
slice: s5
rank: medium
bears-on: none
raised: 2026-11-18
wave: 3
---

## The question, in plain words

The page needs a way to stop a mission paused by stuck and a way to adopt or decline a question, and only Resume had a route. Should this slice add those two routes?

## The decision, in plain words

The slice added one route that stops a stuck mission, saying it was stuck, and one that adopts or declines a question once through the database. Each records the person's own event, and Resume keeps its existing route.

## The intro, for fun

Two buttons on the page needed two doors in the wall.

## The punchline, for fun

Adopt knocks, the database answers once, and nobody opens it twice.

## The options, in plain words

A. A. Add a stop route and an answer route, each recording the person's event (as built).
B. B. Reuse the budget stop's answer route for the stuck pause and the question, in one shared route.
C. C. Leave Stop and the answers to a later slice and show the buttons disabled.

## What I had to decide

Kept the answer written once by the database (BR-PRODUCT-12) and never by the page. A name that cannot be read shows as a member.

## What I did meanwhile

Without the two routes the page would show Stop the mission, Adopt and Decline with nothing behind them.

## What it costs to change later

Removing a route is a small change; the events they record stay in the ledger, which is only ever added to.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether Stop the mission records its own event or only moves the mission; it records one so the room shows who stopped it.
- (author) The name of who answered a question is read from the players table; if a member's name cannot be read the card says a member.
