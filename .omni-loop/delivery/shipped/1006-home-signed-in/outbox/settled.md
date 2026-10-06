# Settled outbox items — PRD 1006

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-home-pill-checks-session-with-server -->

## s1-01-home-pill-checks-session-with-server — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-home-pill-checks-session-with-server
prd: 1006
slice: s1
rank: medium
bears-on: none
raised: 2026-10-02
wave: 1
---

## The question, in plain words

When the home page checks whether someone is signed in, should it ask the sign-in service to confirm, or trust what the browser already holds?

## The decision, in plain words

It asks the sign-in service to confirm, as every other page of the galaxy does. That costs one short wait before the pill shows, and a stale sign-in never shows a pill.

## The intro, for fun

The front door now waves at people it knows.

## The punchline, for fun

It just double-checks their face with security first.

## The options, in plain words

A. A. Confirm with the sign-in service, as the rest of the galaxy does (built).
B. B. Trust the browser's stored session: the pill shows sooner, but an expired sign-in may show it until the game page asks again.

## What I had to decide

Whether the home page confirms the session with the sign-in service before drawing the pill, or trusts the browser's copy.

## What I did meanwhile

The pill appears after one confirmation round trip; the next slice's three-second limit covers a slow answer.

## What it costs to change later

Switching is one line in the session read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long the confirmation takes for real visitors was not measured (author).

```

<!-- /omni-outbox-settled: s1-01-home-pill-checks-session-with-server -->

<!-- omni-outbox-settled: s3-01-hero-wiring-touches-home-controls -->

## s3-01-hero-wiring-touches-home-controls — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-hero-wiring-touches-home-controls
prd: 1006
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

The plan said this step would leave the home page's interactive part untouched, but swapping the photo for the player's hero needs it to listen for a second answer. Should this step change it anyway?

## The decision, in plain words

It changes one line there, so the pill shows the photo at once and then the hero. Without that line the photo would show and the hero never would.

## The intro, for fun

The hero was ready to walk on stage, but nobody had left the door open.

## The punchline, for fun

So we oiled one hinge and wrote down that we did.

## The options, in plain words

A. A. Change that one line so the hero replaces the photo (built).
B. B. Leave the file untouched and let the no-flash slice wire the callback when it merges.
C. C. Wait for every read and draw only once: no photo first, the hero after a longer blank.

## What I had to decide

Whether this slice may change one line of the home page's interactive part, outside the paths its plan row lists, to draw the hero after the photo.

## What I did meanwhile

The session read takes an optional callback that receives the photo at once, then the hero; the home page passes it. Called without it, the read still resolves with the photo, as before. The parallel no-flash slice edits the same spot, so the wave merge may need to keep both changes.

## What it costs to change later

Reverting is one line: the home page goes back to drawing the photo only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan said this slice leaves that file unchanged, but the pill draws only what one answer returns, so a second face cannot reach it without that line.

```

<!-- /omni-outbox-settled: s3-01-hero-wiring-touches-home-controls -->
