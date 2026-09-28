# Settled outbox items — PRD 394

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-planet-tested-without-a-browser -->

## s2-01-planet-tested-without-a-browser — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-planet-tested-without-a-browser
prd: 394
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The plan asked for a test that mounts the turning planet in a fake browser, but the app's tests run with no browser at all. How should the turning planet be tested?

## The decision, in plain words

The planet's clock, its choice to stay still under reduced motion, and its stop when the tab hides are tested on their own with stand-ins for the canvas and the page; the planet's markup is tested as the server draws it. No browser library was added.

## The intro, for fun

The plan wanted a browser in the test room, and the test room has no windows.

## The punchline, for fun

So the planet was tested in the dark, one tick at a time.

## The options, in plain words

A. Test the clock, the motion check and the markup apart, with stand-ins; no new test library.
B. Add a fake-browser library to the app's tests and mount the planet component in it.

## What I had to decide

Whether testing the planet's logic and its server markup apart is enough, or the app should gain a fake browser for tests.

## What I did meanwhile

The planet's logic and markup are covered; the few lines that wire them together in the browser are checked by hand only.

## What it costs to change later

Adding a fake-browser library later is one dev dependency and one test file; nothing built here has to change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The browser wiring (the effect that mounts the canvas and hides the frames) was not seen running in a real browser by this slice (author)

```

<!-- /omni-outbox-settled: s2-01-planet-tested-without-a-browser -->
