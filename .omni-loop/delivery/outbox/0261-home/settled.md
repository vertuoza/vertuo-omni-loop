# Settled outbox items — PRD 261

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-forward-every-arcade-link -->

## s1-01-forward-every-arcade-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-forward-every-arcade-link
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec names five old game links that the new front page sends on to the game, but the app still points at three more (the star chart, the game menu and the game room): should those go on to the game as well?

## The decision, in plain words

Yes: every link that names a game screen is sent on to the game, the five from the spec and the three the app still uses, so the knowledge page's star chart link and the app's Game mode button keep landing in the game.

## The intro, for fun

Three old signposts still point at the front door, though the game moved out back.

## The punchline, for fun

So the front door now forwards their mail too.

## The options, in plain words

A. Forward every arcade screen link, from the arcade's own list: What is built: no link to a game screen ever lands on HOME.
B. Forward only the five links the spec names: The star chart and Game mode links land on HOME until those two files are changed to /play.
C. Forward every link, and also rewrite the app's own links to /play: A later slice touches the knowledge page and the app switch so they no longer rely on the forwarding.

## What I had to decide

Whether the front page forwards only the five links the spec names, or every link that names a game screen.

## What I did meanwhile

HOME forwards #map, #chart, #fleets, #heroes, #games, #briefing, #menu and #planet-<n> to /play, reading the list from the arcade's own deep-link table (src/arcade/deep-link.ts DEEP_LINKS), so a new arcade screen is forwarded without touching HOME.

## What it costs to change later

Narrowing it back to five is a one-line change in apps/galaxy/src/home/forward.ts plus its test, but then the knowledge page's 'Open the star chart' link (/#chart) and the app's Game mode button (GAME_HOME = '/#menu') would land on HOME instead of the game, unless those two are changed to /play too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the app's own links (/#chart in src/knowledge/KnowledgeScreen.tsx, /#menu in src/switch/switch.ts) should instead be rewritten to /play#… directly; both files are outside this slice's territory (author)

```

<!-- /omni-outbox-settled: s1-01-forward-every-arcade-link -->

<!-- omni-outbox-settled: s1-02-arcade-page-test-follows-the-move -->

## s1-02-arcade-page-test-follows-the-move — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-arcade-page-test-follows-the-move
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The game's page tests had to follow the game to its new address, but their file sits outside the area this piece of work was given: is it fine that it was changed?

## The decision, in plain words

Yes: only the line that says which page the tests open was changed, so the same tests now check the game at its new address.

## The intro, for fun

The game packed its bags for a new address and its inspectors had to follow.

## The punchline, for fun

They only changed the address on their clipboard.

## The options, in plain words

A. Change only the line in the existing test file that names the page: what is built.
B. Move the test file beside the game's new page: the test runner never looks there, so the page would lose its tests.
C. Copy the tests next to the front page's tests: two places would describe the game's page.

## What I had to decide

Whether moving the arcade page's existing tests to the new route may touch their file, which is outside the slice's territory.

## What I did meanwhile

apps/galaxy/src/arcade/page.test.ts imports app/play/page.tsx instead of app/page.tsx (the import and its comment, nothing else); its 13 tests pass unchanged.

## What it costs to change later

None to undo: the file must point at the moved page either way, or the tests would check HOME and fail.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan asks for the tests to move with the page but did not list their file in the territory (author)

```

<!-- /omni-outbox-settled: s1-02-arcade-page-test-follows-the-move -->

<!-- omni-outbox-settled: s1-03-session-refresh-still-runs-on-home -->

## s1-03-session-refresh-still-runs-on-home — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-session-refresh-still-runs-on-home
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The front page reads no account and no database, but the step that keeps a signed-in player's session fresh still runs before every page, the front page included: should the front page be taken out of it?

## The decision, in plain words

It was left as it is: a visitor with no session triggers no call, and a signed-in player's session is only refreshed, never read by the front page.

## The intro, for fun

The front page promised not to peek at anyone's badge.

## The punchline, for fun

The doorman still polishes badges on the way in, though.

## The options, in plain words

A. Leave the session refresh running on every page, the front page included: what is built.
B. Take the front page out of the session refresh, so it never reaches the database.
C. Take every public page out of the session refresh: the front page and the design page.

## What I had to decide

Whether the session-refresh proxy should skip `/` so HOME never causes a request to Supabase, even for a signed-in player.

## What I did meanwhile

apps/galaxy/proxy.ts is unchanged and still matches `/`. With no Supabase settings it does nothing, and with no session cookie Supabase's client answers without a network call; a signed-in player opening HOME still has their session refreshed. HOME itself (app/page.tsx) imports nothing from Supabase and builds as static.

## What it costs to change later

Excluding `/` later is one pattern added to the proxy's matcher in apps/galaxy/proxy.ts, outside this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether 'makes no request to Supabase' in the acceptance criteria covers the proxy's refresh for a signed-in visitor (author)
- Not checked against a live Supabase that a cookie-less getUser makes no request (author)

```

<!-- /omni-outbox-settled: s1-03-session-refresh-still-runs-on-home -->

<!-- omni-outbox-settled: s3-01-start-pause-lengths -->

## s3-01-start-pause-lengths — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-start-pause-lengths
prd: 261
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

How long should HOME wait after PRESS START or the cheat code before opening the game?

## The decision, in plain words

HOME lets the start sound ring for about half a second before opening the game, and first shows the cheat message for just under a second; muted, it opens the game at once.

## The intro, for fun

Leaving a page too fast cuts the jingle off mid-note.

## The punchline, for fun

So HOME waits half a beat, like a good drummer.

## The options, in plain words

A. Wait about half a second for the sound, and show the cheat message for just under a second first (built).
B. Open the game at once and let the sound be cut off.
C. Longer pauses, so the cheat message and the full jingle are unmistakable.

## What I had to decide

Whether the pause before the game opens should be longer, shorter, or skipped.

## What I did meanwhile

The start sound plays in full, then the game opens; the cheat message shows for just under a second before that.

## What it costs to change later

Changing either pause is one number each in the HOME code, with no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the sound plays and then the game opens, but gives no length for either pause. (author)

```

<!-- /omni-outbox-settled: s3-01-start-pause-lengths -->

<!-- omni-outbox-settled: s3-02-enter-on-focused-controls -->

## s3-02-enter-on-focused-controls — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-enter-on-focused-controls
prd: 261
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

When a visitor presses Enter while a button or link on HOME has the focus, should that start the game?

## The decision, in plain words

Enter starts the game anywhere on HOME except on a focused button, link or field, which keeps its own meaning; a focused PRESS START still starts the game.

## The intro, for fun

Enter means start, unless it already means something else.

## The punchline, for fun

A trading card asked to flip should not launch a spaceship instead.

## The options, in plain words

A. Leave Enter to a focused control, and start the game everywhere else (built).
B. Enter always starts the game, even over a focused card or link.
C. Only PRESS START itself answers Enter, never the page as a whole.

## What I had to decide

Whether Enter should start the game even when another button or link on HOME has the focus.

## What I did meanwhile

Enter on the page body starts the game, while Enter on a focused card, link or field does what that control does.

## What it costs to change later

One rule in the HOME code; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says Enter anywhere on HOME starts the game, and also that Enter flips a focused trading card; the two meet on a focused control and the spec does not say which wins. (author)

```

<!-- /omni-outbox-settled: s3-02-enter-on-focused-controls -->
