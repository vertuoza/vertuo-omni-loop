# Settled outbox items — PRD 238

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-signed-out-links-land-on-coin -->

## s1-01-signed-out-links-land-on-coin — adopted

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
id: s1-01-signed-out-links-land-on-coin
prd: 238
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Someone who is not signed in opens a link to one screen of the arcade, such as its menu or its map. Should they go straight to the sign-in screen, on the live site too?

## The decision, in plain words

Yes: every such link now goes straight to the sign-in screen when nobody is signed in. Before, the live site started these links from the game's intro, and only the demo went straight to sign-in.

## The intro, for fun

A visitor knocked on the menu's door without a coin, and the door pointed at the coin slot.

## The punchline, for fun

No coin, no menu, and no intro to sit through before hearing so.

## The options, in plain words

A. Every link goes straight to sign-in when nobody is signed in, the option built.
B. Only the menu's link does; the older links start with the intro, as before.

## What I had to decide

Where a deep link to one of the arcade's screens lands for someone signed out, when the page holds no galaxy for them (the live and the closed builds).

## What I did meanwhile

In src/arcade/deep-link.ts, every scene link (#menu and the six that were there before: #map, #chart, #fleets, #heroes, #games, #briefing) goes through the one door (onboarding's allowed) whether the page holds a galaxy or not, so signed out it lands on INSERT COIN. Before, the live build ignored every link for a signed-out visitor, because the page holds no galaxy for them, and started at the boot. A planet's link still needs the galaxy, and starts at the boot without it.

## What it costs to change later

One condition in landing(); nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a signed-out /#menu lands on INSERT COIN "through the one door every deep link goes through", as if the older links already did; on the live build they started at the boot. It does not say whether the older links should change with it.

```

<!-- /omni-outbox-settled: s1-01-signed-out-links-land-on-coin -->

<!-- omni-outbox-settled: s1-02-level-up-before-menu-link -->

## s1-02-level-up-before-menu-link — adopted

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
id: s1-02-level-up-before-menu-link
prd: 238
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

A player follows the link back to the game's menu with a new level this device has not celebrated yet. Should the level-up screen play first, or should the menu open at once?

## The decision, in plain words

The level-up screen plays first, as it does on every other way into the menu, and the menu follows once it is done.

## The intro, for fun

The menu was ready to open, but the fanfare had been waiting all week for its moment.

## The punchline, for fun

One press later the menu is there, and the new level got its applause.

## The options, in plain words

A. The level-up plays first, then the menu, the option built.
B. The menu opens at once, and the level-up waits for the next way into the menu.

## What I had to decide

Whether the #menu deep link skips a level-up the player has not seen on this device.

## What I did meanwhile

ArcadeApp.tsx opens a deep link through go(), the path every route to the menu takes, so a level not yet celebrated on this device plays LEVEL UP first; the menu follows from there.

## What it costs to change later

One line in ArcadeApp.tsx: set the scene directly instead of through go().

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says /#menu opens SELECT MODE "at once", and ArcadeApp.tsx says every route to the menu plays a waiting level-up first; neither names the other.

```

<!-- /omni-outbox-settled: s1-02-level-up-before-menu-link -->

<!-- omni-outbox-settled: s1-03-menu-link-without-galaxy -->

## s1-03-menu-link-without-galaxy — adopted

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
id: s1-03-menu-link-without-galaxy
prd: 238
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Someone signed in whose page has no galaxy to show, because their account is outside the crew or the galaxy could not be read, follows the link to the game's menu. Where should they land?

## The decision, in plain words

The game starts from its intro, as its home address does, and then takes them where it always would: the screen for an account outside the crew, or the menu with the galaxy marked out of reach.

## The intro, for fun

The link promised a menu, but the galaxy had wandered off for the afternoon.

## The punchline, for fun

So the arcade starts from the top, and the intro walks them to the right door.

## The options, in plain words

A. Start from the intro, as the home address does, the option built.
B. Open the menu for the crew even with the galaxy out of reach, and the intro for an account outside the crew.
C. Open the menu for everyone signed in.

## What I had to decide

What a deep link opens for someone signed in whose page holds no galaxy: an account outside the crew, or a crew member whose galaxy is out of reach.

## What I did meanwhile

landing() in src/arcade/deep-link.ts returns nothing for a signed-in session without a galaxy, as readHash did before for every link, so the arcade starts at the boot. The door (allowed) cannot tell an account outside the crew, so opening the menu for them would show a menu they cannot use in place of their own screen.

## What it costs to change later

One condition in landing(); nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Acceptance criterion 9 says /#menu opens SELECT MODE for a signed-in person, without naming an account outside the crew or a galaxy out of reach.

```

<!-- /omni-outbox-settled: s1-03-menu-link-without-galaxy -->

<!-- omni-outbox-settled: s1-04-switch-is-a-link -->

## s1-04-switch-is-a-link — adopted

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
id: s1-04-switch-is-a-link
prd: 238
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The box that asks whether to switch to game mode has two answers, Stay and Switch, which the spec calls buttons. Should Switch be a real button, or a link drawn as a button?

## The decision, in plain words

Switch is a link drawn as a button, because it opens another page, and a screen reader announces it as a link. Stay is a real button, because it only closes the box.

## The intro, for fun

Switch wanted to be a button, but it kept leaving for another page.

## The punchline, for fun

So it wears a button's clothes, and only a screen reader knows it is a link.

## The options, in plain words

A. A link drawn as a button, the option built.
B. A real button that opens the game when pressed.

## What I had to decide

Whether Switch in the Game mode dialog is a button or a link.

## What I did meanwhile

In src/switch/GameModeButton.tsx, Switch is an anchor to /#menu styled as the page's primary button (ask-button), and has the focus as the dialog opens; Stay is a button that closes the dialog.

## What it costs to change later

One element in the dialog, and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec calls Stay and Switch "two buttons", and its test seam says Switch "leads to /#menu"; it does not say which element Switch is.

```

<!-- /omni-outbox-settled: s1-04-switch-is-a-link -->

<!-- omni-outbox-settled: s2-01-game-mode-on-a-phone -->

## s2-01-game-mode-on-a-phone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-game-mode-on-a-phone
prd: 238
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

On a phone, the top bar of the questions and knowledge pages no longer fits on one line once Game mode joins it. Where should Game mode go?

## The decision, in plain words

The bar folds onto one more line, and Game mode takes the right end of it, just under the light and dark switch. Nothing else in the bar moves, and the page never scrolls sideways.

## The intro, for fun

Game mode reached the top bar on a phone, and every seat on the first row was taken.

## The punchline, for fun

So it took the corner seat one row down: still on the right, still the last.

## The options, in plain words

A. It folds under the light and dark switch, at the right end of its line, the option built.
B. It moves up beside the Omni Loop name, and the page's other links fold under it.
C. It folds to the left of its own line, as the other links do when they fold.

## What I had to decide

Where Game mode sits in the /ask header and the /knowledge bar when they wrap on a narrow screen.

## What I did meanwhile

In src/ask/ask.css the header's end (.ask-bar-end) now wraps, which also removes the 114 px sideways scroll Game mode caused at 393 px, and Game mode takes margin-left: auto there and in the /knowledge bar (src/knowledge/knowledge.css), so on a row of its own it sits at the right end, under the theme switch. src/switch/headers.test.ts pins both rules.

## What it costs to change later

Two CSS rules and their test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec puts Game mode at the top right and says that on a phone it keeps its glyph and its words; it does not say where it goes when a header wraps.
- (author) /app's header (s1) puts Game mode beside the theme switch on its second row, at the left: there the two share a row, so the question does not come up.

```

<!-- /omni-outbox-settled: s2-01-game-mode-on-a-phone -->

<!-- omni-outbox-settled: s2-02-knowledge-bar-sideways -->

## s2-02-knowledge-bar-sideways — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-knowledge-bar-sideways
prd: 238
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

On a phone held sideways, the knowledge map's top bar can no longer hold the name, the repository and all its buttons on one line once Game mode joins it. Which part should move to a second line?

## The decision, in plain words

The buttons move together to a second line, at the left, and the name and the repository keep the first line. On a computer's screen, everything still fits on one line.

## The intro, for fun

The knowledge map's top bar held a name, a repository and three buttons, then the phone turned sideways.

## The punchline, for fun

The buttons took the next line down together, and nobody was left behind.

## The options, in plain words

A. The buttons move together to a second line, at the left, the option built.
B. The repository's name moves under the Omni Loop name, so the buttons keep the first line.
C. The buttons move together to a second line, at the right.

## What I had to decide

Which part of the /knowledge bar wraps at 852×393, now that the bar is wider than the screen there.

## What I did meanwhile

No rule was added for it: the bar's end (.km-bar-end in src/knowledge/knowledge.css) wraps as it already did between 480 and 849 px wide, to the left of the header's second row. At 852×393 it sat on the first row at the right before Game mode joined it; it now wraps too.

## What it costs to change later

One CSS rule in src/knowledge/knowledge.css.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says nothing else in the headers moves; at 852 px wide something has to, and the spec does not say what.

```

<!-- /omni-outbox-settled: s2-02-knowledge-bar-sideways -->

<!-- omni-outbox-settled: s3-01-ready-screen-pauses-before-confirm -->

## s3-01-ready-screen-pauses-before-confirm — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-ready-screen-pauses-before-confirm
prd: 238
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

A player opens the question about leaving for the app while Entropy Invaders is still counting down to its first wave. Should the countdown pause, as a game in play does?

## The decision, in plain words

Yes: the countdown pauses too. Saying no brings the player back to the game's pause screen, and resuming picks the countdown up where it stopped.

## The intro, for fun

The aliens were still lining up when someone reached for the exit.

## The punchline, for fun

They wait politely on the pause screen until the player makes up their mind.

## The options, in plain words

A. The countdown pauses, and saying no brings back the pause screen, the option built.
B. The countdown keeps running under the question, and saying no brings back the countdown or the first wave.

## What I had to decide

Whether Entropy Invaders' ready screen (the countdown before the first wave) counts as a game in play when OPEN THE APP? opens over it.

## What I did meanwhile

pauseFirst() in src/arcade/leave.ts pauses any game that is neither paused nor over, the ready screen included, so B comes back to the pause; START then resumes the countdown with the time it had left.

## What it costs to change later

One condition in pauseFirst() in src/arcade/leave.ts, and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a game in play pauses first and that a paused or finished game is left as it is; it does not name the ready screen, which is neither.

```

<!-- /omni-outbox-settled: s3-01-ready-screen-pauses-before-confirm -->

<!-- omni-outbox-settled: s3-02-timed-screens-wait-under-confirm -->

## s3-02-timed-screens-wait-under-confirm — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-timed-screens-wait-under-confirm
prd: 238
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Some screens of the arcade move on by themselves after a few seconds, such as the start-up screen and the welcome back. If the question about leaving for the app is up over one of them, should they still move on underneath it?

## The decision, in plain words

No: they wait while the question is up, so saying no shows the same screen, which then starts its few seconds again.

## The intro, for fun

The start-up screen had three seconds to live, and then someone asked it a question.

## The punchline, for fun

It held its breath until the answer, then counted to three again.

## The options, in plain words

A. They wait, and start their few seconds again after a no, the option built.
B. They wait, and pick up where they stopped after a no.
C. They keep running, and a no shows whichever screen came next.

## What I had to decide

Whether the arcade's timed hand-overs (the boot to the title, the intro to the fleet select, the welcome to the menu, the fleet lock-in to the next step) keep running while OPEN THE APP? is open over their scene.

## What I did meanwhile

In src/arcade/ArcadeApp.tsx the timed hand-overs wait while the confirm is open, and each starts again in full once B closes it (the fleet lock-in still counts from when it began). Only the menu opens the confirm today; the Game Boy's switch will open it on every scene.

## What it costs to change later

One condition in ArcadeApp.tsx's timed hand-overs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says B leaves the scene exactly as it was, and that the switch works from the boot on; it does not say whether a screen that moves on by itself should move on under the question.

```

<!-- /omni-outbox-settled: s3-02-timed-screens-wait-under-confirm -->

<!-- omni-outbox-settled: s3-03-wide-menu-rows-tightened -->

## s3-03-wide-menu-rows-tightened — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-wide-menu-rows-tightened
prd: 238
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

With the new way to the app, a player's menu has ten rows, and on a computer or a phone held sideways the last one now touched the line at the bottom of the screen. Should the rows sit a little closer together there too, as they now do on a phone held upright?

## The decision, in plain words

Yes: on the wide screen the rows sit slightly closer together and start slightly higher, so all ten end clear of the bottom line. Nothing is dropped or split over pages.

## The intro, for fun

Ten rows walked into a menu built for nine, and the last one stood on the footer's toes.

## The punchline, for fun

Everyone shuffled up a couple of pixels, and there was room for all.

## The options, in plain words

A. The rows sit slightly closer together on the wide screen, the option built.
B. The rows keep their spacing, and the bottom line moves lower instead.

## What I had to decide

How a linked player's ten-row SELECT MODE fits the wide grid (640×360). The spec names only the tall grid as the tight fit, but on the wide one SIGN OUT's row overlapped the footer by about a pixel.

## What I did meanwhile

In src/arcade/scenes/menu.css the wide long menu's rows are 2px apart instead of 3px, under a 12px margin instead of 16px: SIGN OUT now ends about 12px above the footer, checked at 852×393 and 1440×900.

## What it costs to change later

Two numbers in menu.css.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the tall grid as the tightest fit and says how to tighten it there; it says nothing of the wide grid, which also overflowed.

```

<!-- /omni-outbox-settled: s3-03-wide-menu-rows-tightened -->
