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
