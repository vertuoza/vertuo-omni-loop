# Settled outbox items — PRD 400

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-mascot-choices -->

## s1-01-mascot-choices — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-mascot-choices
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Which pictures may an owner pick as a fleet's mascot?

## The decision, in plain words

The six fleet animals and characters the game already draws: the beaver, the octopus, the duck, the spy, the pirate and the invincible hero. The commander, the enemy, the plain heroes and the small icons are not offered.

## The intro, for fun

Six mascots walk into a fleet screen and ask to be picked.

## The punchline, for fun

The commander stays on the bridge, and the enemy stays outside.

## The options, in plain words

A. The six fleet mascots, kept as a list in the database, as built.
B. Every drawable sprite except the plain heroes and icons, the commander and the enemy included.
C. No list in the database: accept any short key and let the app draw a hero when it does not know it.

## What I had to decide

Which sprites count as mascots an owner may choose, and whether that list lives in the database or is read from the sprite library.

## What I did meanwhile

The database holds the six fleet mascots in one small list; adding a mascot later is one line in a new migration.

## What it costs to change later

One list in one migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the commander or the enemy should ever be a fleet mascot (author)
- whether the list should instead be generated from the sprite library at build time (author)

```

<!-- /omni-outbox-settled: s1-01-mascot-choices -->

<!-- omni-outbox-settled: s1-02-fleet-refusal-shape -->

## s1-02-fleet-refusal-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-fleet-refusal-shape
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

How does the fleet page learn which field a refusal is about?

## The decision, in plain words

Every refusal starts with the field's name, for example Label: 1 to 12 characters, and also carries the field on its own as a hint the page can read. A colour typed in capitals is accepted and stored in lowercase, and spaces around a label or motto are trimmed.

## The intro, for fun

The database says no, and politely points at the box you got wrong.

## The punchline, for fun

Label, colour, motto or mascot: it always names the culprit.

## The options, in plain words

A. A hint naming the field plus a message that starts with it, as built.
B. A separate error code per field, and no hint.
C. The functions answer a list of every problem at once instead of stopping at the first.

## What I had to decide

The shape of the fleet functions' answers and refusals, which the fleet page reads to show each refusal next to its field.

## What I did meanwhile

Each function answers the fleet as saved; a refusal carries the field as its hint and names it first in its message; the page maps the hint to the field.

## What it costs to change later

The wording and hints of four refusals, and the page's mapping.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the refusal messages should be written for people to read as they are, or be translated by the page (author)

```

<!-- /omni-outbox-settled: s1-02-fleet-refusal-shape -->

<!-- omni-outbox-settled: s1-03-fleet-key-from-label -->

## s1-03-fleet-key-from-label — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-fleet-key-from-label
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

How is a new fleet's permanent key made from the name its owner types?

## The decision, in plain words

The typed name is lowercased with dashes for anything that is not a letter or a digit, like c-i-a for the spy fleet. When that key is already used, even by a retired fleet, a number is added, like beaver-2.

## The intro, for fun

Two fleets both want to be called Beaver.

## The punchline, for fun

The second one gets a number, like a sequel nobody asked for.

## The options, in plain words

A. Lowercase with dashes and a counter when taken, as built.
B. A random short code, so a key never echoes the label at all.
C. Lowercase with dashes, and refuse a label whose key is taken instead of numbering it.

## What I had to decide

The rule that turns a fleet's label into its key, which never changes once made.

## What I did meanwhile

Lowercase, dashes for anything else, a counter when taken; keys already made stay as they are whatever rule comes later.

## What it costs to change later

A few lines in one function; existing keys never move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a key should ever be longer than the twelve characters a label allows, plus its number (author)

```

<!-- /omni-outbox-settled: s1-03-fleet-key-from-label -->

<!-- omni-outbox-settled: s2-01-fleets-menu-with-none -->

## s2-01-fleets-menu-with-none — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-fleets-menu-with-none
prd: 400
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a workspace has no fleets yet, should the FLEETS entry of the arcade's menu disappear, or stay and open the invitation to raise your own fleets?

## The decision, in plain words

It stays. With no fleets it opens the invitation screen, which tells the owner where to set fleets up and a member to ask the owner, instead of the empty fleets wall.

## The intro, for fun

An empty hangar can still have a sign on the door.

## The punchline, for fun

So the door stays, and the sign says: build your own ships.

## The options, in plain words

A. Keep FLEETS on the menu; with no fleets it opens the invitation screen.
B. Hide FLEETS from the menu with no fleets; the invitation shows only if the fleet step is reached some other way.
C. Hide FLEETS, and show the invitation once, right after the hero is built, for a workspace with no fleets.

## What I had to decide

The spec asks both to hide the fleets wall when there are no fleets and to show the invitation on the fleet screens. With the fleet step skipped when there are no fleets, hiding the menu entry too would leave the invitation nowhere a person could reach it.

## What I did meanwhile

The FLEETS entry stays on the menu, its hint reads that there are no fleets yet, and it opens the invitation screen in place of the wall. The fleet column in the Hall of Heroes and TOP FLEETS are hidden.

## What it costs to change later

A constant: dropping the entry when there are no fleets is one condition in the menu's list, and the invitation screen stays for the fleet step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say which screen a member of a workspace with no fleets reads the invitation on. (author)

```

<!-- /omni-outbox-settled: s2-01-fleets-menu-with-none -->

<!-- omni-outbox-settled: s2-02-disbanded-with-no-fleets -->

## s2-02-disbanded-with-no-fleets — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-disbanded-with-no-fleets
prd: 400
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

A player whose fleet was retired is asked to pick a new one. What happens when the workspace has no other fleet left to pick?

## The decision, in plain words

They play on. While another fleet flies they are sent to pick one, as today; when none does, they go straight to the menu, still shown under their retired fleet's name.

## The intro, for fun

The ship was retired, and the harbour is empty.

## The punchline, for fun

The captain keeps sailing the old flag until a new one is raised.

## The options, in plain words

A. Let them play on under their retired fleet's name until a fleet flies again.
B. Make them solo automatically, clearing their retired fleet.
C. Show them the invitation screen and let them go on to the menu from it.

## What I had to decide

The spec makes a fleet optional and says a player is ready once they have a player row, but also keeps sending a player whose fleet was retired to pick again. With no active fleet, that pick screen would be the invitation, a dead end.

## What I did meanwhile

A player whose fleet was retired counts as ready when no fleet is active, and is sent to pick again only while at least one fleet is active. Their stored fleet is left as it is.

## What it costs to change later

A constant: one condition in the rule that says who is ready.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether such a player should read SOLO instead of their retired fleet's name was not settled. (author)

```

<!-- /omni-outbox-settled: s2-02-disbanded-with-no-fleets -->

<!-- omni-outbox-settled: s5-01-dashboard-play-copy -->

## s5-01-dashboard-play-copy — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-dashboard-play-copy
prd: 400
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The dashboard used to tell someone who has not played yet to join a fleet. Now that fleets are optional, what should that line say instead?

## The decision, in plain words

It now reads "Play in the arcade to get your hero and your score", and still links to the arcade.

## The intro, for fun

The dashboard stopped asking newcomers to pick a crew before they even have a cape.

## The punchline, for fun

Heroes first, crews later, paperwork never.

## The options, in plain words

A. Play in the arcade to get your hero and your score (built).
B. Build your hero in the arcade to start scoring.
C. Start playing in the arcade: your hero and your score will show here.

## What I had to decide

Keep this wording, or give the exact sentence the card should show.

## What I did meanwhile

The card shows the new sentence; nothing else changes.

## What it costs to change later

One sentence and its test to change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks only that the card no longer tell a member to join a fleet; it gives no replacement words (author).

```

<!-- /omni-outbox-settled: s5-01-dashboard-play-copy -->
